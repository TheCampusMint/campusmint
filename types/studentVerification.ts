import type {
  ResolvedStudentEmail,
  StudentEmailRejectionReason,
} from "./universityIdentity.ts";

export type StudentEmailVerificationMethod =
  "email_otp";

export type StudentVerificationAssurance = {
  institutionEligibilityVerified: true;
  mailboxOwnershipVerified: true;
  enrollmentVerified: false;
  identityVerified: false;
  ageVerified: false;
};

export type VerifiedStudentEmail = Omit<
  ResolvedStudentEmail,
  "mailboxVerificationStatus"
> & {
  mailboxVerificationStatus: "verified";
  mailboxVerifiedAt: string;
  mailboxVerificationMethod: StudentEmailVerificationMethod;
  verificationChallengeId: string;
  assurance: StudentVerificationAssurance;
};

export type StudentVerificationChallengeSummary = {
  id: string;
  email: string;
  expiresAt: string;
  resendAvailableAt: string;
};

export type StudentVerificationRequestFailureReason =
  | StudentEmailRejectionReason
  | "invalid_request"
  | "resend_cooldown"
  | "delivery_unavailable"
  | "delivery_failed"
  | "network_error";

export type StudentVerificationRequestResponse =
  | {
      ok: true;
      challenge: StudentVerificationChallengeSummary;
      development?: {
        code: string;
      };
    }
  | {
      ok: false;
      reason: StudentVerificationRequestFailureReason;
      message: string;
      retryAfterSeconds?: number;
    };

export type StudentVerificationVerifyFailureReason =
  | "invalid_request"
  | "challenge_not_found"
  | "expired"
  | "consumed"
  | "invalidated"
  | "attempt_limit"
  | "incorrect_code"
  | "network_error";

export type StudentVerificationVerifyResponse =
  | {
      ok: true;
      verified: VerifiedStudentEmail;
    }
  | {
      ok: false;
      reason: StudentVerificationVerifyFailureReason;
      message: string;
      attemptsRemaining?: number;
    };
