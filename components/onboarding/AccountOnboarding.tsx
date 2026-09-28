"use client";

import { useState } from "react";
import { BrandEmailOnboarding } from "./BrandEmailOnboarding";
import { CreatorEmailOnboarding } from "./CreatorEmailOnboarding";
import { ExistingAccountSignIn } from "./ExistingAccountSignIn";
import { StudentEmailOnboarding } from "./StudentEmailOnboarding";

type StudentCompletion = Parameters<typeof StudentEmailOnboarding>[0]["onVerified"];

export function AccountOnboarding({ onStudentVerified, onBrandComplete, onCreatorComplete, onSignInComplete, initialAccountType = null, brandSessionVerified = false, creatorSessionVerified = false }: { onStudentVerified: StudentCompletion; onBrandComplete: () => void; onCreatorComplete: () => void; onSignInComplete: () => void; initialAccountType?: "student" | "brand" | "creator" | null; brandSessionVerified?: boolean; creatorSessionVerified?: boolean }) {
  const [accountType, setAccountType] = useState<"student" | "brand" | "creator" | "sign_in" | null>(initialAccountType);
  if (accountType === "student") return <StudentEmailOnboarding onBack={() => setAccountType(null)} onVerified={onStudentVerified} />;
  if (accountType === "brand") return <BrandEmailOnboarding onBack={() => setAccountType(null)} onComplete={onBrandComplete} emailAlreadyVerified={brandSessionVerified} />;
  if (accountType === "creator") return <CreatorEmailOnboarding onBack={() => setAccountType(null)} onComplete={onCreatorComplete} emailAlreadyVerified={creatorSessionVerified} />;
  if (accountType === "sign_in") return <ExistingAccountSignIn onBack={() => setAccountType(null)} onComplete={onSignInComplete} />;
  const cardClass = "interactive-pop rounded-3xl border border-[var(--app-border,#d9c7cc)] bg-[var(--app-surface,#fff)] p-5 text-left shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent,#6f1d2c)]";
  return <main className="cm-onboarding-scene min-h-dvh bg-[var(--app-background,#f7f1f2)] px-5 py-12 text-[var(--app-text-primary,#2a171b)]"><div className="mx-auto flex min-h-[70dvh] w-full max-w-xl flex-col justify-center"><p className="cm-eyebrow text-[var(--app-accent,#6f1d2c)]">The Campus Mint</p><h1 className="mt-4 text-4xl font-black tracking-[-.05em]">Choose your account</h1><button type="button" onClick={() => setAccountType("sign_in")} className="mt-7 w-full rounded-full bg-[var(--app-accent,#6f1d2c)] px-5 py-3.5 font-black text-[var(--app-accent-contrast,#fff)] shadow-sm">Sign In</button><div className="mt-4 grid gap-3 sm:grid-cols-3"><button type="button" onClick={() => setAccountType("student")} className={cardClass}><strong className="text-lg">Student</strong><span className="mt-1 block text-xs leading-5 text-[var(--app-text-secondary,#725d63)]">Eligible university email</span></button><button type="button" onClick={() => setAccountType("brand")} className={cardClass}><strong className="text-lg">Brand</strong><span className="mt-1 block text-xs leading-5 text-[var(--app-text-secondary,#725d63)]">Business identity and Channel</span></button><button type="button" onClick={() => setAccountType("creator")} className={cardClass}><strong className="text-lg">Creator</strong><span className="mt-1 block text-xs leading-5 text-[var(--app-text-secondary,#725d63)]">Application and review</span></button></div></div></main>;
}
