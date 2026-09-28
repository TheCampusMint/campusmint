"use client";

import { useEffect, useState } from "react";

import { MintLeafBackButton } from "@/components/ui/MintLeafBackButton";
import { requestExistingAccountOtp, verifyExistingAccountOtp } from "@/lib/auth/emailOtpClient";

export function ExistingAccountSignIn({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  async function sendCode() {
    setPending(true);
    setError(null);
    const result = await requestExistingAccountOtp(email);
    setPending(false);
    if (!result.ok) { setError(result.message); return; }
    setEmail(result.challenge.email);
    setExpiresAt(result.challenge.expiresAt);
    setResendAt(result.challenge.resendAvailableAt);
    setNow(Date.now());
    setStep("code");
  }

  async function submitEmail(event: React.FormEvent) { event.preventDefault(); await sendCode(); }
  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await verifyExistingAccountOtp(email, code);
    setPending(false);
    if (!result.ok) { setError(result.message); return; }
    onComplete();
  }

  const inputClass = "w-full rounded-2xl border border-[var(--app-border,#dccdd1)] bg-[var(--app-surface,#fff)] px-4 py-3.5 text-[var(--app-text-primary,#2a171b)] outline-none focus:ring-2 focus:ring-[var(--app-accent,#6f1d2c)]";
  const resendSeconds = resendAt ? Math.max(0, Math.ceil((Date.parse(resendAt) - now) / 1000)) : 0;
  const expired = Boolean(expiresAt && now >= Date.parse(expiresAt));

  return (
    <main className="cm-onboarding-scene min-h-dvh bg-[var(--app-background,#f7f1f2)] px-5 py-10 text-[var(--app-text-primary,#2a171b)]">
      <div className="mx-auto w-full max-w-md py-8">
        <MintLeafBackButton onClick={step === "email" ? onBack : () => { setStep("email"); setCode(""); setError(null); }} label="Back" className="mb-8" />
        <p className="cm-eyebrow text-[var(--app-accent,#6f1d2c)]">The Campus Mint</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-.045em]">{step === "email" ? "Welcome back" : "Check your email"}</h1>
        {step === "email" ? (
          <form onSubmit={submitEmail} className="mt-8 space-y-4">
            <p className="text-sm leading-6 text-[var(--app-text-secondary,#725d63)]">Your account email</p>
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={inputClass} />
            <button disabled={pending} className="w-full rounded-full bg-[var(--app-accent,#6f1d2c)] px-5 py-3.5 font-black text-[var(--app-accent-contrast,#fff)] disabled:opacity-50">{pending ? "Sending…" : "Email me a sign-in code"}</button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="mt-8 space-y-4">
            <p className="text-sm leading-6 text-[var(--app-text-secondary,#725d63)]">Code sent to <strong>{email}</strong>.</p>
            <input required type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} aria-label="Verification code" className={`${inputClass} text-center text-2xl font-black tracking-[.24em]`} />
            <button disabled={pending || code.length !== 6 || expired} className="w-full rounded-full bg-[var(--app-accent,#6f1d2c)] px-5 py-3.5 font-black text-[var(--app-accent-contrast,#fff)] disabled:opacity-50">{pending ? "Signing in…" : expired ? "Code expired" : "Sign in"}</button>
            <button type="button" disabled={pending || resendSeconds > 0} onClick={() => { void sendCode(); }} className="w-full rounded-full border border-[var(--app-border,#dccdd1)] px-5 py-3 text-sm font-black disabled:opacity-50">{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}</button>
          </form>
        )}
        {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{error}</p>}
      </div>
    </main>
  );
}
