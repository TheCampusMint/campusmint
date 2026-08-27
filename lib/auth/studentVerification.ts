import {
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  assessStudentEmail,
  getStudentEmailRejectionMessage,
} from "./studentEmail.ts";
import type {
  StudentVerificationRequestResponse,
  StudentVerificationVerifyResponse,
} from "../../types/studentVerification.ts";
import type { ResolvedStudentEmail } from "../../types/universityIdentity.ts";

export const STUDENT_VERIFICATION_CODE_LENGTH = 6;
export const STUDENT_VERIFICATION_TTL_MS =
  10 * 60 * 1000;
export const STUDENT_VERIFICATION_RESEND_COOLDOWN_MS =
  30 * 1000;
export const STUDENT_VERIFICATION_MAX_ATTEMPTS = 5;

export type StudentVerificationRuntimeMode =
  | "development"
  | "production"
  | "test";

export type StudentVerificationTransportMessage = {
  email: string;
  code: string;
  expiresAt: string;
};

export type StudentVerificationTransportResult =
  | { ok: true }
  | {
      ok: false;
      reason: "not_configured" | "delivery_failed";
    };

export type StudentVerificationTransport = {
  id: string;
  kind: "development" | "production" | "unconfigured";
  sendStudentVerificationCode: (
    message: StudentVerificationTransportMessage,
  ) => Promise<StudentVerificationTransportResult>;
};

export type StudentVerificationChallengeStatus =
  | "active"
  | "consumed"
  | "invalidated";

export type StudentVerificationInvalidationReason =
  | "resend"
  | "attempt_limit";

export type StudentVerificationChallengeRecord = {
  id: string;
  normalizedEmail: string;
  resolvedStudentEmail: ResolvedStudentEmail;
  codeHash: string;
  codeSalt: string;
  createdAtMs: number;
  expiresAtMs: number;
  resendAvailableAtMs: number;
  attemptCount: number;
  maximumAttempts: number;
  status: StudentVerificationChallengeStatus;
  consumedAtMs: number | null;
  invalidatedAtMs: number | null;
  invalidationReason: StudentVerificationInvalidationReason | null;
};

export type StudentVerificationChallengeStore = {
  getById: (
    challengeId: string,
  ) => Promise<StudentVerificationChallengeRecord | null>;
  findLatestByEmail: (
    normalizedEmail: string,
  ) => Promise<StudentVerificationChallengeRecord | null>;
  save: (
    challenge: StudentVerificationChallengeRecord,
  ) => Promise<void>;
  replaceActive: (
    challenge: StudentVerificationChallengeRecord,
    expectedPreviousChallengeId: string | null,
    replacedAtMs: number,
  ) => Promise<boolean>;
};

/**
 * Process-local development store. It is lost on restart and cannot provide
 * cross-instance consistency. Production must replace it with durable storage.
 */
export class InMemoryStudentVerificationChallengeStore
  implements StudentVerificationChallengeStore
{
  private readonly challenges = new Map<
    string,
    StudentVerificationChallengeRecord
  >();

  private readonly latestByEmail = new Map<
    string,
    string
  >();

  async getById(challengeId: string) {
    return this.challenges.get(challengeId) ?? null;
  }

  async findLatestByEmail(normalizedEmail: string) {
    const challengeId =
      this.latestByEmail.get(normalizedEmail);

    return challengeId
      ? this.challenges.get(challengeId) ?? null
      : null;
  }

  async save(
    challenge: StudentVerificationChallengeRecord,
  ) {
    this.challenges.set(challenge.id, challenge);
  }

  async replaceActive(
    challenge: StudentVerificationChallengeRecord,
    expectedPreviousChallengeId: string | null,
    replacedAtMs: number,
  ) {
    const currentChallengeId =
      this.latestByEmail.get(
        challenge.normalizedEmail,
      ) ?? null;

    if (
      currentChallengeId !==
      expectedPreviousChallengeId
    ) {
      return false;
    }

    if (currentChallengeId) {
      const current =
        this.challenges.get(currentChallengeId);

      if (current?.status === "active") {
        this.challenges.set(current.id, {
          ...current,
          status: "invalidated",
          invalidatedAtMs: replacedAtMs,
          invalidationReason: "resend",
        });
      }
    }

    this.challenges.set(challenge.id, challenge);
    this.latestByEmail.set(
      challenge.normalizedEmail,
      challenge.id,
    );

    return true;
  }
}

export function generateSecureNumericCode() {
  return randomInt(0, 10 ** STUDENT_VERIFICATION_CODE_LENGTH)
    .toString()
    .padStart(STUDENT_VERIFICATION_CODE_LENGTH, "0");
}

export function hashStudentVerificationCode(input: {
  code: string;
  challengeId: string;
  normalizedEmail: string;
  salt: string;
  secret: string;
}) {
  return createHmac("sha256", input.secret)
    .update(
      [
        input.challengeId,
        input.normalizedEmail,
        input.salt,
        input.code,
      ].join(":"),
    )
    .digest("hex");
}

function hashesMatch(first: string, second: string) {
  const firstBuffer = Buffer.from(first, "hex");
  const secondBuffer = Buffer.from(second, "hex");

  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  );
}

type StudentVerificationServiceOptions = {
  store: StudentVerificationChallengeStore;
  transport: StudentVerificationTransport;
  runtimeMode: StudentVerificationRuntimeMode;
  hashSecret?: string;
  exposeDevelopmentCode?: boolean;
  now?: () => number;
  codeGenerator?: () => string;
  challengeIdGenerator?: () => string;
  saltGenerator?: () => string;
  challengeTtlMs?: number;
  resendCooldownMs?: number;
  maximumAttempts?: number;
};

export class StudentVerificationService {
  private readonly store: StudentVerificationChallengeStore;
  private readonly transport: StudentVerificationTransport;
  private readonly runtimeMode: StudentVerificationRuntimeMode;
  private readonly hashSecret: string;
  private readonly exposeDevelopmentCode: boolean;
  private readonly now: () => number;
  private readonly codeGenerator: () => string;
  private readonly challengeIdGenerator: () => string;
  private readonly saltGenerator: () => string;
  private readonly challengeTtlMs: number;
  private readonly resendCooldownMs: number;
  private readonly maximumAttempts: number;
  private readonly challengeLocks = new Map<
    string,
    Promise<void>
  >();

  constructor(options: StudentVerificationServiceOptions) {
    this.store = options.store;
    this.transport = options.transport;
    this.runtimeMode = options.runtimeMode;
    this.hashSecret =
      options.hashSecret ??
      randomBytes(32).toString("hex");
    this.exposeDevelopmentCode = Boolean(
      options.exposeDevelopmentCode &&
        options.runtimeMode === "development" &&
        options.transport.kind === "development",
    );
    this.now = options.now ?? Date.now;
    this.codeGenerator =
      options.codeGenerator ??
      generateSecureNumericCode;
    this.challengeIdGenerator =
      options.challengeIdGenerator ?? randomUUID;
    this.saltGenerator =
      options.saltGenerator ??
      (() => randomBytes(16).toString("hex"));
    this.challengeTtlMs =
      options.challengeTtlMs ??
      STUDENT_VERIFICATION_TTL_MS;
    this.resendCooldownMs =
      options.resendCooldownMs ??
      STUDENT_VERIFICATION_RESEND_COOLDOWN_MS;
    this.maximumAttempts =
      options.maximumAttempts ??
      STUDENT_VERIFICATION_MAX_ATTEMPTS;
  }

  private async acquireChallengeLock(
    challengeId: string,
  ) {
    const previous =
      this.challengeLocks.get(challengeId) ??
      Promise.resolve();
    let releaseCurrent = () => {};
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    const queued = previous.then(() => current);

    this.challengeLocks.set(challengeId, queued);
    await previous;

    return () => {
      releaseCurrent();

      if (
        this.challengeLocks.get(challengeId) === queued
      ) {
        this.challengeLocks.delete(challengeId);
      }
    };
  }

  async requestCode(
    email: string,
  ): Promise<StudentVerificationRequestResponse> {
    const assessment = assessStudentEmail(email);

    if (!assessment.ok) {
      return {
        ok: false,
        reason: assessment.reason,
        message: getStudentEmailRejectionMessage(
          assessment.reason,
        ),
      };
    }

    const normalizedEmail =
      assessment.resolved.email;
    const now = this.now();
    const previous =
      await this.store.findLatestByEmail(
        normalizedEmail,
      );

    if (
      previous &&
      now < previous.resendAvailableAtMs
    ) {
      return {
        ok: false,
        reason: "resend_cooldown",
        message:
          "Please wait before requesting another code.",
        retryAfterSeconds: Math.ceil(
          (previous.resendAvailableAtMs - now) /
            1000,
        ),
      };
    }

    const code = this.codeGenerator();

    if (!/^\d{6}$/.test(code)) {
      throw new Error(
        "Student verification code generators must return exactly six digits.",
      );
    }

    const challengeId =
      this.challengeIdGenerator();
    const codeSalt = this.saltGenerator();
    const expiresAtMs =
      now + this.challengeTtlMs;
    const resendAvailableAtMs =
      now + this.resendCooldownMs;

    const challenge: StudentVerificationChallengeRecord = {
      id: challengeId,
      normalizedEmail,
      resolvedStudentEmail: assessment.resolved,
      codeHash: hashStudentVerificationCode({
        code,
        challengeId,
        normalizedEmail,
        salt: codeSalt,
        secret: this.hashSecret,
      }),
      codeSalt,
      createdAtMs: now,
      expiresAtMs,
      resendAvailableAtMs,
      attemptCount: 0,
      maximumAttempts: this.maximumAttempts,
      status: "active",
      consumedAtMs: null,
      invalidatedAtMs: null,
      invalidationReason: null,
    };

    const delivery =
      await this.transport.sendStudentVerificationCode({
        email: normalizedEmail,
        code,
        expiresAt: new Date(
          expiresAtMs,
        ).toISOString(),
      });

    if (!delivery.ok) {
      const unavailable =
        delivery.reason === "not_configured";

      return {
        ok: false,
        reason: unavailable
          ? "delivery_unavailable"
          : "delivery_failed",
        message: unavailable
          ? "Email delivery is not configured yet."
          : "We couldn't send a verification code. Please try again.",
      };
    }

    const replaced =
      await this.store.replaceActive(
        challenge,
        previous?.id ?? null,
        now,
      );

    if (!replaced) {
      return {
        ok: false,
        reason: "resend_cooldown",
        message:
          "A newer verification code was already requested. Please use that code.",
        retryAfterSeconds: Math.ceil(
          this.resendCooldownMs / 1000,
        ),
      };
    }

    return {
      ok: true,
      challenge: {
        id: challenge.id,
        email: challenge.normalizedEmail,
        expiresAt: new Date(
          challenge.expiresAtMs,
        ).toISOString(),
        resendAvailableAt: new Date(
          challenge.resendAvailableAtMs,
        ).toISOString(),
      },
      ...(this.exposeDevelopmentCode
        ? { development: { code } }
        : {}),
    };
  }

  async verifyCode(input: {
    challengeId: string;
    code: string;
  }): Promise<StudentVerificationVerifyResponse> {
    const challengeId = input.challengeId.trim();
    const code = input.code.trim();

    if (
      !challengeId ||
      !/^\d{6}$/.test(code)
    ) {
      return {
        ok: false,
        reason: "invalid_request",
        message:
          "Enter the six-digit verification code.",
      };
    }

    const releaseChallengeLock =
      await this.acquireChallengeLock(challengeId);

    try {
      const challenge =
        await this.store.getById(challengeId);

      if (!challenge) {
        return {
          ok: false,
          reason: "challenge_not_found",
          message:
            "That verification request could not be found. Request a new code.",
        };
      }

      if (challenge.status === "consumed") {
        return {
          ok: false,
          reason: "consumed",
          message:
            "That verification code has already been used.",
        };
      }

      if (challenge.status === "invalidated") {
        const attemptLimit =
          challenge.invalidationReason ===
          "attempt_limit";

        return {
          ok: false,
          reason: attemptLimit
            ? "attempt_limit"
            : "invalidated",
          message: attemptLimit
            ? "Too many incorrect attempts. Request a new code."
            : "That verification code is no longer active. Request a new code.",
        };
      }

      const now = this.now();

      if (now >= challenge.expiresAtMs) {
        return {
          ok: false,
          reason: "expired",
          message:
            "That verification code has expired. Request a new code.",
        };
      }

      const submittedHash =
        hashStudentVerificationCode({
          code,
          challengeId: challenge.id,
          normalizedEmail:
            challenge.normalizedEmail,
          salt: challenge.codeSalt,
          secret: this.hashSecret,
        });

      if (
        !hashesMatch(
          challenge.codeHash,
          submittedHash,
        )
      ) {
        const attemptCount =
          challenge.attemptCount + 1;
        const attemptsRemaining = Math.max(
          0,
          challenge.maximumAttempts - attemptCount,
        );

        if (attemptsRemaining === 0) {
          await this.store.save({
            ...challenge,
            attemptCount,
            status: "invalidated",
            invalidatedAtMs: now,
            invalidationReason: "attempt_limit",
          });

          return {
            ok: false,
            reason: "attempt_limit",
            message:
              "Too many incorrect attempts. Request a new code.",
            attemptsRemaining: 0,
          };
        }

        await this.store.save({
          ...challenge,
          attemptCount,
        });

        return {
          ok: false,
          reason: "incorrect_code",
          message: `That code is incorrect. ${attemptsRemaining} attempts remaining.`,
          attemptsRemaining,
        };
      }

      await this.store.save({
        ...challenge,
        status: "consumed",
        consumedAtMs: now,
      });

      return {
        ok: true,
        verified: {
          ...challenge.resolvedStudentEmail,
          mailboxVerificationStatus: "verified",
          mailboxVerifiedAt: new Date(now).toISOString(),
          mailboxVerificationMethod: "email_otp",
          verificationChallengeId: challenge.id,
          assurance: {
            institutionEligibilityVerified: true,
            mailboxOwnershipVerified: true,
            enrollmentVerified: false,
            identityVerified: false,
            ageVerified: false,
          },
        },
      };
    } finally {
      releaseChallengeLock();
    }
  }
}
