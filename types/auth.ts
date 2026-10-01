import type { SignupAccountType } from "@/lib/auth/accountTypes";
import type { VerifiedStudentEmail } from "@/types/studentVerification";

export type EmailOtpChallenge = {
  email: string;
  accountType?: SignupAccountType;
  expiresAt: string;
  resendAvailableAt: string;
};

export type EmailOtpRequestResponse =
  | { ok: true; challenge: EmailOtpChallenge }
  | {
      ok: false;
      reason:
        | "invalid_request"
        | "ineligible_email"
        | "rate_limited"
        | "auth_unavailable"
        | "delivery_failed";
      message: string;
      retryAfterSeconds?: number;
    };

export type EmailOtpVerifyResponse =
  | {
      ok: true;
      userId: string;
      email: string;
      accountType: SignupAccountType;
      verifiedStudent?: VerifiedStudentEmail;
      session?: { accessToken: string; refreshToken: string; expiresAt?: number; userId: string };
    }
  | {
      ok: false;
      reason: "invalid_request" | "invalid_or_expired_code" | "auth_unavailable";
      message: string;
    };

export type ExistingAccountOtpRequestResponse = EmailOtpRequestResponse;
export type ExistingAccountOtpVerifyResponse = EmailOtpVerifyResponse;
