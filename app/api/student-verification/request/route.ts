import { NextResponse } from "next/server";

import { isSignupAccountType, isValidBrandEmail, normalizeAuthEmail } from "@/lib/auth/accountTypes";
import { assessStudentEmail, getStudentEmailRejectionMessage } from "@/lib/auth/studentEmail";
import { createSupabaseServerClient, hasSupabasePublicConfig } from "@/lib/supabase/server";
import type { EmailOtpRequestResponse } from "@/types/auth";

export const runtime = "nodejs";

function json(payload: EmailOtpRequestResponse, status: number) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { body = null; }

  if (!body || typeof body !== "object") {
    return json({ ok: false, reason: "invalid_request", message: "Enter a valid email address." }, 400);
  }
  const input = body as Record<string, unknown>;
  const signIn = input.mode === "sign_in";
  const signupAccountType = isSignupAccountType(input.accountType) ? input.accountType : null;
  if (typeof input.email !== "string" || (!signIn && !signupAccountType)) return json({ ok: false, reason: "invalid_request", message: "Enter a valid email address." }, 400);

  const email = normalizeAuthEmail(input.email);
  if (!isValidBrandEmail(email)) {
    return json({ ok: false, reason: "invalid_request", message: "Enter a valid email address." }, 400);
  }
  if (!signIn && signupAccountType === "student") {
    const assessment = assessStudentEmail(email);
    if (!assessment.ok) {
      return json({ ok: false, reason: "ineligible_email", message: getStudentEmailRejectionMessage(assessment.reason) }, 400);
    }
  }

  if (!hasSupabasePublicConfig()) {
    return json({ ok: false, reason: "auth_unavailable", message: "Email verification is not configured for this environment." }, 503);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: signIn
      ? { shouldCreateUser: false }
      : { shouldCreateUser: true, data: { account_type: signupAccountType } },
  });

  if (error) {
    const rateLimited = error.status === 429;
    return json({
      ok: false,
      reason: rateLimited ? "rate_limited" : "delivery_failed",
      message: rateLimited ? "Please wait before requesting another code." : "We couldn't send a verification email. Please try again.",
      ...(rateLimited ? { retryAfterSeconds: 60 } : {}),
    }, rateLimited ? 429 : 502);
  }

  const now = Date.now();
  return json({ ok: true, challenge: {
    email,
    ...(!signIn && signupAccountType ? { accountType: signupAccountType } : {}),
    expiresAt: new Date(now + 600_000).toISOString(),
    resendAvailableAt: new Date(now + 60_000).toISOString(),
  } }, 200);
}
