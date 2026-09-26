"use client";

import { useState } from "react";

import { MintLeafBackButton } from "@/components/ui/MintLeafBackButton";
import { requestEmailOtp, verifyEmailOtp } from "@/lib/auth/emailOtpClient";

export function CreatorEmailOnboarding({ onBack, onComplete, emailAlreadyVerified = false }: { onBack: () => void; onComplete: () => void; emailAlreadyVerified?: boolean }) {
  const [step, setStep] = useState<"email" | "code" | "application">(emailAlreadyVerified ? "application" : "email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState("youtube");
  const [externalHandle, setExternalHandle] = useState("");
  const [externalProfileUrl, setExternalProfileUrl] = useState("");
  const [claimedFollowerCount, setClaimedFollowerCount] = useState("");
  const [applicationNotes, setApplicationNotes] = useState("");
  const inputClass = "w-full rounded-2xl border border-[var(--app-border,#dccdd1)] bg-[var(--app-surface,#fff)] px-4 py-3.5 outline-none focus:ring-2 focus:ring-[var(--app-accent,#6f1d2c)]";

  async function requestCode(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError(null);
    const result = await requestEmailOtp({ email, accountType: "creator" });
    setPending(false); if (!result.ok) { setError(result.message); return; }
    setEmail(result.challenge.email); setStep("code");
  }
  async function verifyCode(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError(null);
    const result = await verifyEmailOtp({ email, code, accountType: "creator" });
    setPending(false); if (!result.ok) { setError(result.message); return; }
    setStep("application");
  }
  async function submitApplication(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError(null);
    const response = await fetch("/api/creator/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, username, platform, externalHandle, externalProfileUrl, claimedFollowerCount: Number(claimedFollowerCount), applicationNotes }) });
    const result = await response.json().catch(() => null) as { ok?: boolean; message?: string } | null;
    setPending(false); if (!response.ok || !result?.ok) { setError(result?.message ?? "We couldn't submit your creator application."); return; }
    onComplete();
  }

  return <main className="cm-onboarding-scene min-h-dvh bg-[var(--app-background,#f7f1f2)] px-5 py-10 text-[var(--app-text-primary,#2a171b)]"><div className="mx-auto w-full max-w-md py-8">
    <MintLeafBackButton onClick={step === "email" || (step === "application" && emailAlreadyVerified) ? onBack : () => { setError(null); setStep(step === "application" ? "code" : "email"); }} label="Back" className="mb-8" />
    <p className="cm-eyebrow text-[var(--app-accent,#6f1d2c)]">The Campus Mint · Creator</p><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">{step === "email" ? "Verify your email" : step === "code" ? "Check your email" : "Creator application"}</h1>
    {step === "email" && <form onSubmit={requestCode} className="mt-8 space-y-4"><p className="text-sm leading-6 text-[var(--app-text-secondary,#725d63)]">Creators may use a non-.edu email. Email ownership is separate from creator approval.</p><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={inputClass}/><button disabled={pending} className="w-full rounded-full bg-[var(--app-accent)] px-5 py-3.5 font-black text-[var(--app-accent-contrast,#fff)] disabled:opacity-50">{pending ? "Sending…" : "Email me a code"}</button></form>}
    {step === "code" && <form onSubmit={verifyCode} className="mt-8 space-y-4"><p className="text-sm text-[var(--app-text-secondary,#725d63)]">Enter the six-digit code sent to <strong>{email}</strong>.</p><input required type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} aria-label="Verification code" className={`${inputClass} text-center text-2xl font-black tracking-[.24em]`}/><button disabled={pending || code.length !== 6} className="w-full rounded-full bg-[var(--app-accent)] px-5 py-3.5 font-black text-[var(--app-accent-contrast,#fff)] disabled:opacity-50">{pending ? "Verifying…" : "Verify email"}</button></form>}
    {step === "application" && <form onSubmit={submitApplication} className="mt-8 space-y-3"><p className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-4 text-xs leading-5 text-[var(--app-text-secondary)]">About 100,000 followers is the current review guide, not automatic approval. Alternative criteria can still be reviewed. External-account control and authorized human approval are always required before a badge or Creator tools are granted.</p><input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" className={inputClass}/><input required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Campus Mint username" className={inputClass}/><select required value={platform} onChange={(event) => setPlatform(event.target.value)} className={inputClass}><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="twitch">Twitch</option><option value="other">Other eligible platform</option></select><input required value={externalHandle} onChange={(event) => setExternalHandle(event.target.value)} placeholder="External account handle" className={inputClass}/><input required type="url" value={externalProfileUrl} onChange={(event) => setExternalProfileUrl(event.target.value)} placeholder="https://platform.example/your-profile" className={inputClass}/><input required type="number" min="0" step="1" value={claimedFollowerCount} onChange={(event) => setClaimedFollowerCount(event.target.value)} placeholder="Claimed follower count" className={inputClass}/><textarea value={applicationNotes} onChange={(event) => setApplicationNotes(event.target.value.slice(0, 2000))} rows={4} placeholder="Optional context or alternative eligibility evidence" className={`${inputClass} resize-none`}/><button disabled={pending} className="w-full rounded-full bg-[var(--app-accent)] px-5 py-3.5 font-black text-[var(--app-accent-contrast,#fff)] disabled:opacity-50">{pending ? "Submitting…" : "Submit for review"}</button></form>}
    {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{error}</p>}
  </div></main>;
}
