import type { StudentVerificationTransport } from "./studentVerification.ts";

type DevelopmentVerificationLogger = (
  message: string,
) => void;

export function createDevelopmentStudentVerificationTransport(
  logger: DevelopmentVerificationLogger = console.info,
): StudentVerificationTransport {
  return {
    id: "development-server-log",
    kind: "development",
    async sendStudentVerificationCode(message) {
      logger(
        `[Campus Mint development OTP] ${message.email}: ${message.code} (expires ${message.expiresAt})`,
      );

      return { ok: true };
    },
  };
}

/**
 * Explicit production placeholder. A real provider adapter should implement
 * the same transport contract without changing challenge or onboarding code.
 */
export function createUnconfiguredStudentVerificationTransport(): StudentVerificationTransport {
  return {
    id: "unconfigured-production-email",
    kind: "unconfigured",
    async sendStudentVerificationCode() {
      return {
        ok: false,
        reason: "not_configured",
      };
    },
  };
}
