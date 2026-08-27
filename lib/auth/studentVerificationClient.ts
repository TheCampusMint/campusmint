import type {
  StudentVerificationRequestFailureReason,
  StudentVerificationRequestResponse,
  StudentVerificationVerifyFailureReason,
  StudentVerificationVerifyResponse,
} from "../../types/studentVerification.ts";

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const requestFailureReasons: ReadonlySet<string> = new Set<
  StudentVerificationRequestFailureReason
>([
  "invalid_email",
  "not_edu_domain",
  "ineligible_k12",
  "unknown_institution",
  "invalid_request",
  "resend_cooldown",
  "delivery_unavailable",
  "delivery_failed",
  "network_error",
]);

const verifyFailureReasons: ReadonlySet<string> = new Set<
  StudentVerificationVerifyFailureReason
>([
  "invalid_request",
  "challenge_not_found",
  "expired",
  "consumed",
  "invalidated",
  "attempt_limit",
  "incorrect_code",
  "network_error",
]);

function isRequestResponse(
  value: unknown,
): value is StudentVerificationRequestResponse {
  if (!isRecord(value)) return false;

  if (value.ok === true) {
    if (!isRecord(value.challenge)) return false;

    const challenge = value.challenge;
    const validChallenge =
      typeof challenge.id === "string" &&
      typeof challenge.email === "string" &&
      typeof challenge.expiresAt === "string" &&
      typeof challenge.resendAvailableAt === "string";

    if (!validChallenge) return false;

    if (value.development === undefined) {
      return true;
    }

    return (
      isRecord(value.development) &&
      typeof value.development.code === "string"
    );
  }

  return (
    value.ok === false &&
    typeof value.reason === "string" &&
    requestFailureReasons.has(value.reason) &&
    typeof value.message === "string"
  );
}

function isVerifyResponse(
  value: unknown,
): value is StudentVerificationVerifyResponse {
  if (!isRecord(value)) return false;

  if (value.ok === true) {
    if (!isRecord(value.verified)) return false;

    return (
      typeof value.verified.email === "string" &&
      typeof value.verified.domain === "string" &&
      isRecord(value.verified.identity) &&
      isRecord(value.verified.eligibility) &&
      value.verified.mailboxVerificationStatus ===
        "verified" &&
      typeof value.verified.mailboxVerifiedAt ===
        "string" &&
      value.verified.mailboxVerificationMethod ===
        "email_otp" &&
      typeof value.verified.verificationChallengeId ===
        "string" &&
      isRecord(value.verified.assurance)
    );
  }

  return (
    value.ok === false &&
    typeof value.reason === "string" &&
    verifyFailureReasons.has(value.reason) &&
    typeof value.message === "string"
  );
}

async function responseJson(response: Response) {
  try {
    const payload: unknown = await response.json();
    return payload;
  } catch {
    return null;
  }
}

export async function requestStudentVerificationCode(
  email: string,
): Promise<StudentVerificationRequestResponse> {
  try {
    const response = await fetch(
      "/api/student-verification/request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      },
    );
    const payload = await responseJson(response);

    if (isRequestResponse(payload)) {
      return payload;
    }
  } catch {
    // Return the same non-enumerating message for all network failures.
  }

  return {
    ok: false,
    reason: "network_error",
    message:
      "We couldn't reach email verification. Please try again.",
  };
}

export async function verifyStudentVerificationCode(input: {
  challengeId: string;
  code: string;
}): Promise<StudentVerificationVerifyResponse> {
  try {
    const response = await fetch(
      "/api/student-verification/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    const payload = await responseJson(response);

    if (isVerifyResponse(payload)) {
      return payload;
    }
  } catch {
    // Return the same non-enumerating message for all network failures.
  }

  return {
    ok: false,
    reason: "network_error",
    message:
      "We couldn't verify that code. Please try again.",
  };
}
