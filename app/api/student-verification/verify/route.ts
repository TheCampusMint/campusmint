import { consumeRateLimit, auditSecurityEvent } from "@/lib/security/server";
import { recordNativeSession } from "@/lib/security/nativeSession";
import { readJsonBody } from "@/lib/security/requestBody";
import { NextResponse } from "next/server";

import { isSignupAccountType, normalizeAuthEmail } from "@/lib/auth/accountTypes";
import { assessStudentEmail } from "@/lib/auth/studentEmail";
import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabasePublicConfig, hasSupabaseServerConfig } from "@/lib/supabase/server";
import type { EmailOtpVerifyResponse } from "@/types/auth";

export const runtime = "nodejs";

function json(payload: EmailOtpVerifyResponse, status: number) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await readJsonBody(request); } catch { body = null; }

  if (!body || typeof body !== "object") {
    return json({ ok: false, reason: "invalid_request", message: "Enter the six-digit verification code." }, 400);
  }
  const input = body as Record<string, unknown>;
  const signIn = input.mode === "sign_in";
  if (input.client === "ios" && !signIn) return json({ ok: false, reason: "invalid_request", message: "Create your account on the website first." }, 400);
  const signupAccountType = isSignupAccountType(input.accountType) ? input.accountType : null;
  if (typeof input.email !== "string" || typeof input.code !== "string" || !/^\d{6}$/.test(input.code) || (!signIn && !signupAccountType)) return json({ ok: false, reason: "invalid_request", message: "Enter the six-digit verification code." }, 400);
  if (!hasSupabasePublicConfig() || !hasSupabaseServerConfig()) {
    return json({ ok: false, reason: "auth_unavailable", message: "Email verification is not configured for this environment." }, 503);
  }

  const email = normalizeAuthEmail(input.email);
  try {
    const budget = await consumeRateLimit("otp.email.verify", email, 10, 600);
    if (!budget.allowed) return json({ ok: false, reason: "invalid_or_expired_code", message: "Please wait before trying again." }, 429);
  } catch { return json({ ok: false, reason: "auth_unavailable", message: "Sign-in is temporarily unavailable." }, 503); }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: input.code, type: "email" });
  if (error || !data.user?.email) {
    await auditSecurityEvent("otp.verify", "denied");
    return json({ ok: false, reason: "invalid_or_expired_code", message: "That code is invalid or has expired. Request a new code and try again." }, 400);
  }

  const nativeSession = input.client === "ios" && data.session ? { session: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at, userId: data.user.id } } : {};
  await auditSecurityEvent("otp.verify", "allowed", data.user.id);
  const metadataType = data.user.app_metadata?.account_type;
  if (signIn) {
    if (!isSignupAccountType(metadataType)) {
      await supabase.auth.signOut();
      return json({ ok: false, reason: "invalid_request", message: "No Campus Mint account is associated with this email." }, 403);
    }
    if (input.client === "ios" && data.session) {
      try { await recordNativeSession(supabase, data.session); }
      catch { await supabase.auth.signOut(); return json({ ok: false, reason: "auth_unavailable", message: "Native sign-in is temporarily unavailable." }, 503); }
    }
    return json({ ok: true, ...nativeSession, userId: data.user.id, email, accountType: metadataType }, 200);
  }
  if (metadataType && metadataType !== signupAccountType) {
    await supabase.auth.signOut();
    return json({ ok: false, reason: "invalid_request", message: "This account uses a different sign-in type." }, 400);
  }
  if (!metadataType) {
    const admin = createSupabaseAdminClient();
    const { error: claimError } = await admin.auth.admin.updateUserById(data.user.id, {
      app_metadata: { ...data.user.app_metadata, account_type: signupAccountType },
    });
    if (claimError) {
      await supabase.auth.signOut();
      return json({ ok: false, reason: "auth_unavailable", message: "We couldn't finish secure account setup. Please try again." }, 503);
    }
  }

  if (signupAccountType === "student") {
    const assessment = assessStudentEmail(email);
    if (!assessment.ok) {
      await supabase.auth.signOut();
      return json({ ok: false, reason: "invalid_request", message: "This student email is not eligible." }, 400);
    }
    const now = new Date().toISOString();
    return json({ ok: true, ...nativeSession, userId: data.user.id, email, accountType: "student", verifiedStudent: {
      ...assessment.resolved,
      mailboxVerificationStatus: "verified",
      mailboxVerifiedAt: now,
      mailboxVerificationMethod: "email_otp",
      verificationChallengeId: data.user.id,
      assurance: { institutionEligibilityVerified: true, mailboxOwnershipVerified: true, enrollmentVerified: false, identityVerified: false, ageVerified: false },
    } }, 200);
  }

  return json({ ok: true, ...nativeSession, userId: data.user.id, email, accountType: signupAccountType ?? "brand" }, 200);
}
