"use client";

import type { SignupAccountType } from "@/lib/auth/accountTypes";
import type { EmailOtpRequestResponse, EmailOtpVerifyResponse } from "@/types/auth";

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function requestEmailOtp(input: {
  email: string;
  accountType: SignupAccountType;
}): Promise<EmailOtpRequestResponse> {
  try {
    const response = await fetch("/api/student-verification/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = await readJson<EmailOtpRequestResponse>(response);
    if (payload && typeof payload.ok === "boolean") return payload;
  } catch {}
  return { ok: false, reason: "auth_unavailable", message: "Email verification is temporarily unavailable. Please try again." };
}

export async function verifyEmailOtp(input: {
  email: string;
  code: string;
  accountType: SignupAccountType;
}): Promise<EmailOtpVerifyResponse> {
  try {
    const response = await fetch("/api/student-verification/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = await readJson<EmailOtpVerifyResponse>(response);
    if (payload && typeof payload.ok === "boolean") return payload;
  } catch {}
  return { ok: false, reason: "auth_unavailable", message: "We couldn't verify that code. Please try again." };
}

export async function requestExistingAccountOtp(email: string): Promise<EmailOtpRequestResponse> {
  try {
    const response = await fetch("/api/student-verification/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, mode: "sign_in" }),
    });
    const payload = await readJson<EmailOtpRequestResponse>(response);
    if (payload && typeof payload.ok === "boolean") return payload;
  } catch {}
  return { ok: false, reason: "auth_unavailable", message: "Sign in is temporarily unavailable. Please try again." };
}

export async function verifyExistingAccountOtp(email: string, code: string): Promise<EmailOtpVerifyResponse> {
  try {
    const response = await fetch("/api/student-verification/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, mode: "sign_in" }),
    });
    const payload = await readJson<EmailOtpVerifyResponse>(response);
    if (payload && typeof payload.ok === "boolean") return payload;
  } catch {}
  return { ok: false, reason: "auth_unavailable", message: "We couldn't sign you in. Please try again." };
}
