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

  if (!body || typeof body !== "object" || !("email" in body) || typeof body.email !== "string" || !("accountType" in body) || !isSignupAccountType(body.accountType)) {
    return json({ ok: false, reason: "invalid_request", message: "Enter a valid email address." }, 400);
  }

  const email = normalizeAuthEmail(body.email);
  if (body.accountType === "student") {
    const assessment = assessStudentEmail(email);
    if (!assessment.ok) {
      return json({ ok: false, reason: "ineligible_email", message: getStudentEmailRejectionMessage(assessment.reason) }, 400);
    }
  } else if (!isValidBrandEmail(email)) {
    return json({ ok: false, reason: "invalid_request", message: "Enter a valid brand or business email address." }, 400);
  }

  if (!hasSupabasePublicConfig()) {
    return json({ ok: false, reason: "auth_unavailable", message: "Email verification is not configured for this environment." }, 503);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, data: { account_type: body.accountType } },
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
    accountType: body.accountType,
    expiresAt: new Date(now + 600_000).toISOString(),
    resendAvailableAt: new Date(now + 60_000).toISOString(),
  } }, 200);
}
