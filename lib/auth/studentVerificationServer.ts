import { randomBytes } from "node:crypto";

import {
  InMemoryStudentVerificationChallengeStore,
  StudentVerificationService,
} from "./studentVerification.ts";
import {
  createDevelopmentStudentVerificationTransport,
  createUnconfiguredStudentVerificationTransport,
} from "./studentVerificationTransport.ts";

type StudentVerificationServerGlobal =
  typeof globalThis & {
    __campusMintStudentVerificationService?: StudentVerificationService;
  };

const serverGlobal =
  globalThis as StudentVerificationServerGlobal;

function createServerStudentVerificationService() {
  const development =
    process.env.NODE_ENV === "development";

  return new StudentVerificationService({
    store:
      new InMemoryStudentVerificationChallengeStore(),
    transport: development
      ? createDevelopmentStudentVerificationTransport()
      : createUnconfiguredStudentVerificationTransport(),
    runtimeMode: development
      ? "development"
      : "production",
    hashSecret:
      process.env.STUDENT_VERIFICATION_HASH_SECRET ??
      randomBytes(32).toString("hex"),
    exposeDevelopmentCode:
      development &&
      process.env.CAMPUS_MINT_EXPOSE_DEVELOPMENT_OTP !==
        "false",
  });
}

/**
 * Kept on globalThis so development hot reload does not orphan active codes.
 * This remains process-local and is not suitable for multi-instance hosting.
 */
export function getStudentVerificationService() {
  if (
    !serverGlobal.__campusMintStudentVerificationService
  ) {
    serverGlobal.__campusMintStudentVerificationService =
      createServerStudentVerificationService();
  }

  return serverGlobal.__campusMintStudentVerificationService;
}
