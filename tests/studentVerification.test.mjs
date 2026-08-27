import assert from "node:assert/strict";
import test from "node:test";

import { assessStudentEmail } from "../lib/auth/studentEmail.ts";
import {
  generateSecureNumericCode,
  InMemoryStudentVerificationChallengeStore,
  StudentVerificationService,
} from "../lib/auth/studentVerification.ts";
import { createUnconfiguredStudentVerificationTransport } from "../lib/auth/studentVerificationTransport.ts";

function createHarness(options = {}) {
  let now = options.now ?? 1_800_000_000_000;
  let challengeSequence = 0;
  let saltSequence = 0;
  const codes = [...(options.codes ?? ["123456", "654321", "111222"])];
  const deliveries = [];
  const store = new InMemoryStudentVerificationChallengeStore();
  const transport = options.transport ?? {
    id: "test-recording-transport",
    kind: options.transportKind ?? "production",
    async sendStudentVerificationCode(message) {
      deliveries.push(message);
      return { ok: true };
    },
  };
  const service = new StudentVerificationService({
    store,
    transport,
    runtimeMode: options.runtimeMode ?? "test",
    hashSecret: "fixed-test-secret",
    exposeDevelopmentCode:
      options.exposeDevelopmentCode ?? false,
    now: () => now,
    codeGenerator: () => codes.shift() ?? "999999",
    challengeIdGenerator: () =>
      `challenge-${++challengeSequence}`,
    saltGenerator: () => `salt-${++saltSequence}`,
    challengeTtlMs: options.challengeTtlMs ?? 60_000,
    resendCooldownMs:
      options.resendCooldownMs ?? 30_000,
    maximumAttempts: options.maximumAttempts ?? 3,
  });

  return {
    service,
    store,
    deliveries,
    advance(milliseconds) {
      now += milliseconds;
    },
  };
}

async function requested(harness, email) {
  const result = await harness.service.requestCode(email);
  assert.equal(result.ok, true);

  if (!result.ok) {
    throw new Error(`Expected a challenge for ${email}.`);
  }

  return result;
}

test("challenge creation uses a secure six-digit generator and stores only a hash", async () => {
  const secureCode = generateSecureNumericCode();
  assert.match(secureCode, /^\d{6}$/);

  const harness = createHarness();
  const result = await requested(harness, "student@tamu.edu");
  const challenge = await harness.store.getById(result.challenge.id);

  assert.ok(challenge);
  assert.equal(challenge.codeHash.length, 64);
  assert.notEqual(challenge.codeHash, "123456");
  assert.equal("code" in challenge, false);
  assert.equal(harness.deliveries[0].code, "123456");
});

test("the correct code verifies mailbox ownership", async () => {
  const harness = createHarness();
  const request = await requested(harness, "student@tamu.edu");
  const result = await harness.service.verifyCode({
    challengeId: request.challenge.id,
    code: "123456",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.verified.mailboxVerificationStatus, "verified");
    assert.equal(result.verified.mailboxVerificationMethod, "email_otp");
  }
});

test("a wrong code fails and counts an attempt", async () => {
  const harness = createHarness();
  const request = await requested(harness, "student@tamu.edu");
  const result = await harness.service.verifyCode({
    challengeId: request.challenge.id,
    code: "000000",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "incorrect_code");
    assert.equal(result.attemptsRemaining, 2);
  }
});

test("too many wrong attempts lock the challenge", async () => {
  const harness = createHarness({ maximumAttempts: 2 });
  const request = await requested(harness, "student@tamu.edu");

  await harness.service.verifyCode({
    challengeId: request.challenge.id,
    code: "000000",
  });
  const locked = await harness.service.verifyCode({
    challengeId: request.challenge.id,
    code: "000001",
  });
  const afterLock = await harness.service.verifyCode({
    challengeId: request.challenge.id,
    code: "123456",
  });

  assert.equal(locked.ok, false);
  assert.equal(afterLock.ok, false);
  if (!locked.ok && !afterLock.ok) {
    assert.equal(locked.reason, "attempt_limit");
    assert.equal(afterLock.reason, "attempt_limit");
  }
});

test("an expired challenge cannot verify", async () => {
  const harness = createHarness({ challengeTtlMs: 1_000 });
  const request = await requested(harness, "student@tamu.edu");
  harness.advance(1_001);
  const result = await harness.service.verifyCode({
    challengeId: request.challenge.id,
    code: "123456",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "expired");
});

test("a consumed challenge is one-time use", async () => {
  const harness = createHarness();
  const request = await requested(harness, "student@tamu.edu");
  const first = await harness.service.verifyCode({
    challengeId: request.challenge.id,
    code: "123456",
  });
  const reused = await harness.service.verifyCode({
    challengeId: request.challenge.id,
    code: "123456",
  });

  assert.equal(first.ok, true);
  assert.equal(reused.ok, false);
  if (!reused.ok) assert.equal(reused.reason, "consumed");
});

test("concurrent verification attempts can consume a challenge only once", async () => {
  const harness = createHarness();
  const request = await requested(harness, "student@tamu.edu");
  const results = await Promise.all([
    harness.service.verifyCode({
      challengeId: request.challenge.id,
      code: "123456",
    }),
    harness.service.verifyCode({
      challengeId: request.challenge.id,
      code: "123456",
    }),
  ]);

  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(
    results.filter(
      (result) => !result.ok && result.reason === "consumed",
    ).length,
    1,
  );
});

test("resend cooldown blocks spam and a later resend invalidates the old challenge", async () => {
  const harness = createHarness();
  const first = await requested(harness, "student@tamu.edu");
  const immediate = await harness.service.requestCode("student@tamu.edu");

  assert.equal(immediate.ok, false);
  if (!immediate.ok) {
    assert.equal(immediate.reason, "resend_cooldown");
  }

  harness.advance(30_001);
  const second = await requested(harness, "student@tamu.edu");
  assert.notEqual(second.challenge.id, first.challenge.id);

  const oldResult = await harness.service.verifyCode({
    challengeId: first.challenge.id,
    code: "123456",
  });
  assert.equal(oldResult.ok, false);
  if (!oldResult.ok) assert.equal(oldResult.reason, "invalidated");
});

test("the normalized email is cryptographically and structurally bound to the challenge", async () => {
  const harness = createHarness();
  const request = await requested(harness, "  STUDENT@TAMU.EDU  ");
  const stored = await harness.store.getById(request.challenge.id);
  const result = await harness.service.verifyCode({
    challengeId: request.challenge.id,
    code: "123456",
  });

  assert.equal(stored?.normalizedEmail, "student@tamu.edu");
  assert.equal(request.challenge.email, "student@tamu.edu");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.verified.email, "student@tamu.edu");
});

test("a non-.edu institution cannot request a challenge", async () => {
  const harness = createHarness();
  const result = await harness.service.requestCode("student@example.com");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "not_edu_domain");
  assert.equal(harness.deliveries.length, 0);
});

test("a configured higher-ed institution can request a challenge", async () => {
  const harness = createHarness();
  const result = await requested(harness, "student@blinn.edu");
  assert.equal(result.challenge.email, "student@blinn.edu");
});

test("an eligible provisional institution can request a challenge", async () => {
  const harness = createHarness();
  const request = await requested(harness, "student@example.edu");
  const verified = await harness.service.verifyCode({
    challengeId: request.challenge.id,
    code: "123456",
  });

  assert.equal(verified.ok, true);
  if (verified.ok) {
    assert.equal(verified.verified.identity.metadataStatus, "provisional");
    assert.equal(verified.verified.identity.knownUniversityId, null);
  }
});

test("a K-12 institution cannot request a challenge", async () => {
  const harness = createHarness();
  const result = await harness.service.requestCode("student@k12.example.edu");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "ineligible_k12");
  assert.equal(harness.deliveries.length, 0);
});

test("a production response never contains the OTP", async () => {
  const harness = createHarness({
    runtimeMode: "production",
    transportKind: "production",
    exposeDevelopmentCode: true,
  });
  const result = await requested(harness, "student@tamu.edu");
  const serialized = JSON.stringify(result);

  assert.equal("development" in result, false);
  assert.equal(serialized.includes("123456"), false);
});

test("the OTP is exposed only by an explicitly enabled development transport", async () => {
  const development = createHarness({
    runtimeMode: "development",
    transportKind: "development",
    exposeDevelopmentCode: true,
  });
  const developmentResult = await requested(development, "student@tamu.edu");
  assert.equal(developmentResult.development?.code, "123456");

  const production = createHarness({
    runtimeMode: "production",
    transportKind: "development",
    exposeDevelopmentCode: true,
  });
  const productionResult = await requested(production, "student@tamu.edu");
  assert.equal("development" in productionResult, false);
});

test("successful verification returns the exact institution identity captured by the challenge", async () => {
  const expected = assessStudentEmail("student@example.edu");
  assert.equal(expected.ok, true);

  const harness = createHarness();
  const request = await requested(harness, "student@example.edu");
  const result = await harness.service.verifyCode({
    challengeId: request.challenge.id,
    code: "123456",
  });

  assert.equal(result.ok, true);
  if (expected.ok && result.ok) {
    assert.deepEqual(result.verified.identity, expected.resolved.identity);
    assert.deepEqual(result.verified.eligibility, expected.resolved.eligibility);
  }
});

test("mailbox verification does not claim DOB, age, identity, or enrollment verification", async () => {
  const harness = createHarness();
  const request = await requested(harness, "student@tamu.edu");
  const result = await harness.service.verifyCode({
    challengeId: request.challenge.id,
    code: "123456",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.verified.assurance.ageVerified, false);
    assert.equal(result.verified.assurance.identityVerified, false);
    assert.equal(result.verified.assurance.enrollmentVerified, false);
  }
});

test("institution eligibility alone leaves mailbox ownership unverified", () => {
  const result = assessStudentEmail("student@tamu.edu");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.resolved.mailboxVerificationStatus, "unverified");
  }
});

test("production without a configured transport fails truthfully and stores no challenge", async () => {
  const harness = createHarness({
    runtimeMode: "production",
    transport: createUnconfiguredStudentVerificationTransport(),
  });
  const result = await harness.service.requestCode("student@tamu.edu");

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "delivery_unavailable");
    assert.equal(result.message, "Email delivery is not configured yet.");
  }
  assert.equal(
    await harness.store.findLatestByEmail("student@tamu.edu"),
    null,
  );
});
