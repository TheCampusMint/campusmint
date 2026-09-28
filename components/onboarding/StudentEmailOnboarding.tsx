"use client";

import { useEffect, useMemo, useState } from "react";

import { MintLeafBackButton } from "@/components/ui/MintLeafBackButton";
import { TactileButton } from "@/components/ui/TactileButton";
import { requestEmailOtp, verifyEmailOtp } from "@/lib/auth/emailOtpClient";
import { assessStudentEmail, getStudentEmailRejectionMessage } from "@/lib/auth/studentEmail";
import type { EmailOtpRequestResponse } from "@/types/auth";
import type { VerifiedStudentEmail } from "@/types/studentVerification";

type VerificationRequestSuccess = Extract<EmailOtpRequestResponse, { ok: true }>;

type OnboardingProfileSetup = {
  firstName: string;
  lastName: string;
  username: string;
  profileImageStoragePath: string | null;
};

type StudentEmailOnboardingProps = {
  onBack?: () => void;
  onVerified: (
    resolved: VerifiedStudentEmail,
    personalEmail: string | null,
    primaryEmail: string,
    profileSetup: OnboardingProfileSetup,
  ) => void | Promise<{ ok: boolean; message?: string }>;
};

const usernamePattern = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{3,30}$/;
const pageClass = "cm-onboarding-scene min-h-dvh bg-white px-5 py-10 text-slate-950";
const inputClass = "mt-2 block w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 outline-none transition focus:border-slate-400 focus:bg-white";
const primaryButtonClass = "w-full rounded-full bg-slate-950 px-5 py-4 text-base font-black text-white transition active:scale-[0.985] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400";

export function StudentEmailOnboarding({ onBack, onVerified }: StudentEmailOnboardingProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [verificationChallenge, setVerificationChallenge] = useState<VerificationRequestSuccess | null>(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestPending, setRequestPending] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationClock, setVerificationClock] = useState(() => Date.now());
  const [verifiedTarget, setVerifiedTarget] = useState<VerifiedStudentEmail | null>(null);
  const [emailChoice, setEmailChoice] = useState<"university" | "personal" | null>(null);
  const [personalEmail, setPersonalEmail] = useState("");
  const [selectedPersonalEmail, setSelectedPersonalEmail] = useState<string | null>(null);
  const [selectedPrimaryEmail, setSelectedPrimaryEmail] = useState<string | null>(null);
  const [profileSetupOpen, setProfileSetupOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  const emailAssessment = useMemo(() => assessStudentEmail(email), [email]);
  const resolved = emailAssessment.ok ? emailAssessment.resolved : null;
  const errorMessage = submitted && email.trim() && !emailAssessment.ok
    ? getStudentEmailRejectionMessage(emailAssessment.reason)
    : null;

  useEffect(() => {
    if (!verificationChallenge) return;
    const timer = window.setInterval(() => setVerificationClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [verificationChallenge]);

  const resendSeconds = verificationChallenge
    ? Math.max(0, Math.ceil((Date.parse(verificationChallenge.challenge.resendAvailableAt) - verificationClock) / 1000))
    : 0;
  const challengeExpired = verificationChallenge
    ? verificationClock >= Date.parse(verificationChallenge.challenge.expiresAt)
    : false;

  async function requestChallenge(studentEmail: string) {
    setRequestPending(true);
    setRequestError(null);
    setCodeError(null);
    const result = await requestEmailOtp({ email: studentEmail, accountType: "student" });
    setRequestPending(false);
    if (!result.ok) {
      setRequestError(result.message);
      return;
    }
    setVerificationChallenge(result);
    setVerificationClock(Date.now());
    setEnteredCode("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (resolved) await requestChallenge(resolved.email);
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verificationChallenge) return;
    setVerificationPending(true);
    setCodeError(null);
    const result = await verifyEmailOtp({
      email: verificationChallenge.challenge.email,
      code: enteredCode,
      accountType: "student",
    });
    setVerificationPending(false);
    if (!result.ok) {
      setCodeError(result.message);
      return;
    }
    if (!result.verifiedStudent) {
      setCodeError("We couldn't verify that student email. Please try again.");
      return;
    }
    setVerifiedTarget(result.verifiedStudent);
    setVerificationChallenge(null);
    setEmailChoice(null);
    setPersonalEmail("");
  }

  async function finishOnboarding() {
    if (!verifiedTarget || !selectedPrimaryEmail) return;
    setCompletionPending(true);
    setCompletionError(null);
    try {
      const result = await onVerified(
        verifiedTarget,
        selectedPersonalEmail,
        selectedPrimaryEmail,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim().toLowerCase(),
          profileImageStoragePath: null,
        },
      );
      if (result && !result.ok) setCompletionError(result.message ?? "We couldn't finish account setup.");
    } catch {
      setCompletionError("We couldn't reach Campus Mint. Please try again.");
    } finally {
      setCompletionPending(false);
    }
  }

  if (profileSetupOpen && verifiedTarget && selectedPrimaryEmail) {
    const normalizedUsername = username.trim().toLowerCase();
    const usernameValid = usernamePattern.test(normalizedUsername);
    const profileValid = firstName.trim().length > 0 && usernameValid;

    return (
      <main className={pageClass}>
        <div className="mx-auto w-full max-w-md py-8">
          <MintLeafBackButton onClick={() => setProfileSetupOpen(false)} label="Back" className="mb-8 text-slate-500" />
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">The Campus Mint</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em]">Build your profile</h1>

          <div className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">First name</span>
              <input
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value.slice(0, 80))}
                autoComplete="given-name"
                placeholder="First name"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Last name (optional)</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value.slice(0, 80))}
                autoComplete="family-name"
                placeholder="Last name"
                className={inputClass}
              />

            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30))}
                autoCapitalize="none"
                spellCheck={false}
                placeholder="your.username"
                className={inputClass}
              />
              {username.length > 0 && !usernameValid && (
                <p className="mt-2 text-xs font-semibold text-red-600">
                  Use 3–30 letters, numbers, periods, or underscores. Do not begin or end with a period.
                </p>
              )}
            </label>
          </div>
          <TactileButton
            type="button"
            disabled={!profileValid || completionPending}
            onClick={() => void finishOnboarding()}
            className={`mt-7 ${primaryButtonClass}`}
          >
            {completionPending ? "Saving…" : "Finish setup"}
          </TactileButton>
          {completionError && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{completionError}</p>}
        </div>
      </main>
    );
  }

  if (verifiedTarget) {
    const normalizedPersonalEmail = personalEmail.trim().toLowerCase();
    const personalEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedPersonalEmail) && !normalizedPersonalEmail.endsWith(".edu");
    const choiceClass = (choice: "university" | "personal") =>
      `w-full rounded-[1.4rem] border px-4 py-4 text-left transition ${
        emailChoice === choice ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950"
      }`;
    const choiceDetailClass = (choice: "university" | "personal") =>
      `mt-1 text-sm ${emailChoice === choice ? "text-slate-300" : "text-slate-500"}`;

    return (
      <main className={pageClass}>
        <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-md flex-col justify-center">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">The Campus Mint</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em]">Choose your sign-in email</h1>

          <div className="mt-8 space-y-3">
            <TactileButton type="button" onClick={() => { setEmailChoice("university"); setPersonalEmail(""); }} className={choiceClass("university")}>
              <p className="font-black">Keep university email</p>
              <p className={choiceDetailClass("university")}>{verifiedTarget.email}</p>
            </TactileButton>
            <TactileButton type="button" onClick={() => setEmailChoice("personal")} className={choiceClass("personal")}>
              <p className="font-black">Use a personal email</p>
              <p className={choiceDetailClass("personal")}>University verification stays linked.</p>
            </TactileButton>
          </div>
          {emailChoice === "personal" && (
            <label className="mt-5 block">
              <span className="text-sm font-bold text-slate-700">Personal email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={personalEmail}
                onChange={(event) => setPersonalEmail(event.target.value)}
                placeholder="you@example.com"
                className={`${inputClass} text-base font-semibold`}
              />
              {personalEmail.length > 0 && !personalEmailValid && (
                <p className="mt-2 text-sm font-semibold text-red-600">Enter a valid personal email that is not a .edu address.</p>
              )}
            </label>
          )}
          <TactileButton
            type="button"
            disabled={!emailChoice || (emailChoice === "personal" && !personalEmailValid)}
            onClick={() => {
              if (emailChoice === "university") {
                setSelectedPersonalEmail(null);
                setSelectedPrimaryEmail(verifiedTarget.email);
                setProfileSetupOpen(true);
              } else if (emailChoice === "personal" && personalEmailValid) {
                setSelectedPersonalEmail(normalizedPersonalEmail);
                setSelectedPrimaryEmail(normalizedPersonalEmail);
                setProfileSetupOpen(true);
              }
            }}
            className={`mt-7 ${primaryButtonClass}`}
          >
            Continue
          </TactileButton>
        </div>
      </main>
    );
  }

  if (verificationChallenge) {
    const challenge = verificationChallenge.challenge;
    return (
      <main className={pageClass}>
        <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-md flex-col justify-center">
          <TactileButton
            type="button"
            onClick={() => { setVerificationChallenge(null); setEnteredCode(""); setCodeError(null); setRequestError(null); }}
            className="mb-8 w-fit text-sm font-bold text-slate-500"
          >
            Change email
          </TactileButton>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">The Campus Mint</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em]">Check your email</h1>
          <p className="mt-3 text-base leading-7 text-slate-500">
            Code sent to <span className="font-bold text-slate-800">{challenge.email}</span>.
          </p>
          {challengeExpired && <p className="mt-5 text-sm font-semibold text-red-600">That verification code has expired. Request a new code.</p>}
          <form onSubmit={verifyCode} className="mt-7 space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={enteredCode}
              onChange={(event) => { setEnteredCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setCodeError(null); }}
              disabled={verificationPending}
              placeholder="000000"
              aria-label="Verification code"
              className={`${inputClass} text-center text-2xl font-black tracking-[0.22em]`}
            />
            {codeError && <p className="text-sm font-semibold text-red-600">{codeError}</p>}
            <TactileButton type="submit" disabled={enteredCode.length !== 6 || verificationPending || challengeExpired} className={primaryButtonClass}>
              {verificationPending ? "Verifying…" : "Verify student email"}
            </TactileButton>
          </form>
          <div className="mt-5 text-center">
            <TactileButton type="button" disabled={requestPending || resendSeconds > 0} onClick={() => void requestChallenge(challenge.email)} className="px-3 py-2 text-sm font-bold text-slate-600 disabled:text-slate-300">
              {requestPending ? "Requesting…" : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
            </TactileButton>
            {requestError && <p className="mt-2 text-sm font-semibold text-red-600">{requestError}</p>}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={pageClass}>
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-md flex-col justify-center">
        {onBack && <MintLeafBackButton onClick={onBack} label="Back" className="mb-8 text-slate-500" />}
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">The Campus Mint</p>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.045em]">Verify your university</h1>
        <p className="mt-3 text-base leading-7 text-slate-500">University .edu email</p>
        <form onSubmit={handleSubmit} className="mt-9 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Student email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(event) => { setEmail(event.target.value); setSubmitted(false); setRequestError(null); }}
              placeholder="you@university.edu"
              className={`${inputClass} text-base font-semibold`}
            />
          </label>
          {resolved && (
            <div className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">University found</p>
              <p className="mt-1 font-black text-slate-950">{resolved.identity.name}</p>
              <p className="mt-1 text-sm text-slate-500">{resolved.domain}</p>
            </div>
          )}
          {errorMessage && <p className="text-sm font-semibold text-red-600">{errorMessage}</p>}
          {requestError && <p className="text-sm font-semibold text-red-600">{requestError}</p>}
          <TactileButton type="submit" disabled={!resolved || requestPending} className={primaryButtonClass}>
            {requestPending ? "Sending code…" : "Continue"}
          </TactileButton>
        </form>

      </div>
    </main>
  );
}
