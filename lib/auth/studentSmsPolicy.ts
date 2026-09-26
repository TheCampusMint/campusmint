import "server-only";

export function isStudentSmsVerificationRequired() {
  return process.env.STUDENT_SMS_VERIFICATION_REQUIRED?.trim().toLocaleLowerCase() === "true";
}
