import assert from "node:assert/strict";
import test from "node:test";

import { getAccountUniversityDisplayTheme } from "../data/universities.ts";
import {
  assessStudentEmail,
  getStudentEmailRejectionMessage,
  isEduEmail,
  parseStudentEmail,
  resolveStudentEmail,
} from "../lib/auth/studentEmail.ts";

function accepted(email) {
  const result = assessStudentEmail(email);
  assert.equal(result.ok, true);

  if (!result.ok) {
    throw new Error(`Expected ${email} to be eligible.`);
  }

  return result.resolved;
}

function rejected(email) {
  const result = assessStudentEmail(email);
  assert.equal(result.ok, false);

  if (result.ok) {
    throw new Error(`Expected ${email} to be rejected.`);
  }

  return result;
}

test("a configured higher-ed .edu domain is eligible", () => {
  const resolved = accepted("student@tamu.edu");
  assert.equal(resolved.eligibility.status, "eligible_higher_ed");
  assert.equal(resolved.eligibility.institutionType, "university");
});

test("an eligible unconfigured higher-ed domain creates a provisional identity", () => {
  const resolved = accepted("student@example.edu");
  assert.equal(resolved.identity.metadataStatus, "provisional");
  assert.equal(resolved.identity.name, "Development Example University");
});

test("a K-12 .edu institution is rejected", () => {
  const result = rejected("student@k12.example.edu");
  assert.equal(result.reason, "ineligible_k12");
  assert.equal(result.eligibility?.institutionType, "k12_school");
});

test("a school-district .edu institution is rejected", () => {
  const result = rejected("student@district.example.edu");
  assert.equal(result.reason, "ineligible_k12");
  assert.equal(result.eligibility?.institutionType, "school_district");
});

test("a pre-college .edu institution is rejected", () => {
  const result = rejected("student@precollege.example.edu");
  assert.equal(result.reason, "ineligible_k12");
  assert.equal(result.eligibility?.institutionType, "pre_college");
});

test("an unknown .edu institution fails closed", () => {
  const result = rejected("student@unknown.example.edu");
  assert.equal(result.reason, "unknown_institution");
  assert.equal(result.eligibility?.status, "unknown");
  assert.equal(result.metadataStatus, null);
});

test("an ordinary non-.edu email is rejected", () => {
  const result = rejected("student@example.com");
  assert.equal(result.reason, "not_edu_domain");
});

test("domain edu alone is not accepted as an .edu institution", () => {
  assert.equal(isEduEmail("student@edu"), false);
  assert.equal(resolveStudentEmail("student@edu"), null);
});

test("an .edu label inside another suffix is rejected", () => {
  assert.equal(isEduEmail("student@school.edu.example.com"), false);
  assert.equal(resolveStudentEmail("student@school.edu.example.com"), null);
});

test("email and domain case are normalized", () => {
  const resolved = accepted("STUDENT@TAMU.EDU");
  assert.equal(resolved.email, "student@tamu.edu");
  assert.equal(resolved.domain, "tamu.edu");
});

test("safe outer whitespace is normalized", () => {
  const resolved = accepted("  student@tamu.edu  ");
  assert.equal(resolved.email, "student@tamu.edu");
});

test("malformed email addresses are rejected", () => {
  const malformed = [
    "student@@tamu.edu",
    "student tamu.edu",
    ".student@tamu.edu",
    "student..name@tamu.edu",
    "student@-tamu.edu",
    "student@tamu..edu",
  ];

  for (const email of malformed) {
    assert.equal(parseStudentEmail(email), null, email);
    assert.equal(rejected(email).reason, "invalid_email", email);
  }
});

test("a provisional university gets its own stable identity key", () => {
  const first = accepted("one@example.edu");
  const second = accepted("two@example.edu");
  assert.equal(first.identity.id, "edu:example.edu");
  assert.equal(second.identity.id, first.identity.id);
  assert.notEqual(first.identity.id, "tamu");
});

test("a provisional university never receives another configured university ID", () => {
  const resolved = accepted("student@example.edu");
  assert.equal(resolved.identity.knownUniversityId, null);
  assert.equal(resolved.identity.metadataStatus, "provisional");
});

test("a configured university retains its configured identity", () => {
  const resolved = accepted("student@blinn.edu");
  assert.equal(resolved.identity.id, "blinn");
  assert.equal(resolved.identity.knownUniversityId, "blinn");
  assert.equal(resolved.identity.metadataStatus, "configured");
});

test("institution eligibility alone does not verify the mailbox", () => {
  const resolved = accepted("student@tamu.edu");
  assert.equal(resolved.mailboxVerificationStatus, "unverified");
});

test("only an explicitly registered subdomain maps to its parent institution", () => {
  const resolved = accepted("student@mail.example.edu");
  assert.equal(resolved.domain, "mail.example.edu");
  assert.equal(resolved.identity.domain, "example.edu");
  assert.equal(resolved.identity.id, "edu:example.edu");
});

test("an unregistered subdomain does not inherit its eligible parent", () => {
  const result = rejected("student@portal.example.edu");
  assert.equal(result.reason, "unknown_institution");
  assert.equal(result.eligibility?.canonicalDomain, null);
});

test("a provisional identity receives the neutral theme and no campus inventory", () => {
  const resolved = accepted("student@example.edu");
  const theme = getAccountUniversityDisplayTheme({
    universityId: "tamu",
    universityIdentityId: resolved.identity.id,
    universityDomain: resolved.identity.domain,
    universityName: resolved.identity.name,
    universityShortName: resolved.identity.shortName,
    knownUniversityId: resolved.identity.knownUniversityId,
  });

  assert.equal(theme.primary, "#0f172a");
  assert.deepEqual(theme.accessibleCampuses, []);
  assert.equal(theme.campusNetworkId, "universal");
});

test("K-12 and unknown institutions have distinct onboarding messages", () => {
  assert.equal(
    getStudentEmailRejectionMessage("ineligible_k12"),
    "Campus Mint is currently for college and university students.",
  );
  assert.equal(
    getStudentEmailRejectionMessage("unknown_institution"),
    "We couldn't verify this institution as a college or university yet.",
  );
});
