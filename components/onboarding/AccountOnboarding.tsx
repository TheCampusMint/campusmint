"use client";

import { useState } from "react";
import { BrandEmailOnboarding } from "./BrandEmailOnboarding";
import { StudentEmailOnboarding } from "./StudentEmailOnboarding";

type StudentCompletion = Parameters<typeof StudentEmailOnboarding>[0]["onVerified"];

export function AccountOnboarding({ onStudentVerified, onBrandComplete, initialAccountType = null, brandSessionVerified = false }: { onStudentVerified: StudentCompletion; onBrandComplete: () => void; initialAccountType?: "student" | "brand" | null; brandSessionVerified?: boolean }) {
  const [accountType, setAccountType] = useState<"student" | "brand" | null>(initialAccountType);
  if (accountType === "student") return <StudentEmailOnboarding onVerified={onStudentVerified} />;
  if (accountType === "brand") return <BrandEmailOnboarding onBack={() => setAccountType(null)} onComplete={onBrandComplete} emailAlreadyVerified={brandSessionVerified} />;
  return <main className="cm-onboarding-scene min-h-dvh bg-[#f7f1f2] px-5 py-12 text-[#2a171b]"><div className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col justify-center"><p className="text-xs font-black uppercase tracking-[.22em] text-[#6f1d2c]">The Campus Mint</p><h1 className="mt-4 text-4xl font-black tracking-[-.05em]">Choose your account</h1><p className="mt-3 text-sm leading-6 text-[#725d63]">Student accounts join through an eligible higher-education email. Brand accounts use an email they control.</p><div className="mt-8 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setAccountType("student")} className="rounded-3xl border border-[#d9c7cc] bg-white p-5 text-left shadow-sm"><strong className="text-lg">Student</strong><span className="mt-1 block text-xs leading-5 text-[#725d63]">Campus identity and student onboarding</span></button><button type="button" onClick={() => setAccountType("brand")} className="rounded-3xl border border-[#d9c7cc] bg-white p-5 text-left shadow-sm"><strong className="text-lg">Brand</strong><span className="mt-1 block text-xs leading-5 text-[#725d63]">Profile, Channel, posts, and events</span></button></div><p className="mt-6 text-xs text-[#725d63]">Passwordless email verification · no SMS required</p></div></main>;
}
