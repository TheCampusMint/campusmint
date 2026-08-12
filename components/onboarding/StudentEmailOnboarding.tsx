"use client";

import { useMemo, useState } from "react";

import { TactileButton } from "@/components/ui/TactileButton";
import { getOrganizationsForUniversity } from "@/data/organizations";
import { resolveStudentEmail } from "@/lib/auth/studentEmail";
import type { UniversityId } from "@/data/universities";
import type { ResolvedStudentEmail } from "@/types/universityIdentity";

type OnboardingProfileSetup = {
  firstName: string;
  lastName: string;
  username: string;
  bio: string | null;
  interests: string[];
  hobbies: string[];
  academicArea: string | null;
  offersTutoring: boolean;
  tutoringSubjects: string[];
  phoneNumber: string | null;
  clubIds: string[];
};

type StudentEmailOnboardingProps = {
  onVerified: (
    resolved: ResolvedStudentEmail,
    personalEmail: string | null,
    primaryEmail: string,
    profileSetup: OnboardingProfileSetup,
  ) => void;
};

function createDevelopmentVerificationCode() {
  return String(
    Math.floor(100000 + Math.random() * 900000),
  );
}

export function StudentEmailOnboarding({
  onVerified,
}: StudentEmailOnboardingProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [verificationTarget, setVerificationTarget] =
    useState<ResolvedStudentEmail | null>(null);
  const [verificationCode, setVerificationCode] =
    useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [verifiedTarget, setVerifiedTarget] =
    useState<ResolvedStudentEmail | null>(null);
  const [emailChoice, setEmailChoice] =
    useState<"university" | "personal" | null>(null);
  const [personalEmail, setPersonalEmail] = useState("");
  const [selectedPersonalEmail, setSelectedPersonalEmail] =
    useState<string | null>(null);
  const [selectedPrimaryEmail, setSelectedPrimaryEmail] =
    useState<string | null>(null);
  const [profileSetupOpen, setProfileSetupOpen] =
    useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState("");
  const [hobbies, setHobbies] = useState("");
  const [academicArea, setAcademicArea] = useState("");
  const [offersTutoring, setOffersTutoring] =
    useState(false);
  const [tutoringSubjects, setTutoringSubjects] =
    useState<string[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [clubSetupOpen, setClubSetupOpen] =
    useState(false);
  const [selectedClubIds, setSelectedClubIds] =
    useState<string[]>([]);

  const resolved = useMemo(
    () => resolveStudentEmail(email),
    [email],
  );

  const showError =
    submitted &&
    email.trim().length > 0 &&
    !resolved;

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSubmitted(true);

    if (!resolved) return;

    setVerificationTarget(resolved);
    setVerificationCode(
      createDevelopmentVerificationCode(),
    );
    setEnteredCode("");
    setCodeError(false);
  }

  function verifyCode(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !verificationTarget ||
      enteredCode !== verificationCode
    ) {
      setCodeError(true);
      return;
    }

    setVerifiedTarget(verificationTarget);
    setVerificationTarget(null);
    setEmailChoice(null);
    setPersonalEmail("");
  }

  if (
    clubSetupOpen &&
    verifiedTarget &&
    selectedPrimaryEmail
  ) {
    const configuredUniversityId =
      verifiedTarget.identity.knownUniversityId as
        | UniversityId
        | null;

    const availableClubs = configuredUniversityId
      ? getOrganizationsForUniversity(
          configuredUniversityId,
        )
      : [];

    function splitTags(value: string) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    function finishOnboarding() {
      onVerified(
        verifiedTarget!,
        selectedPersonalEmail,
        selectedPrimaryEmail!,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username
            .trim()
            .toLowerCase(),
          bio: bio.trim() || null,
          interests: splitTags(interests),
          hobbies: splitTags(hobbies),
          academicArea:
            academicArea.trim() || null,
          offersTutoring,
          tutoringSubjects:
            offersTutoring
              ? tutoringSubjects
              : [],
          phoneNumber:
            phoneNumber.trim() || null,
          clubIds: selectedClubIds,
        },
      );
    }

    return (
      <main className="min-h-dvh bg-white px-5 py-10 text-slate-950">
        <div className="mx-auto w-full max-w-md py-8">
          <TactileButton
            type="button"
            onClick={() => {
              setClubSetupOpen(false);
              setProfileSetupOpen(true);
            }}
            className="mb-8 w-fit text-sm font-bold text-slate-500"
          >
            Back
          </TactileButton>

          <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">
            The Campus Mint
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em]">
            Find your clubs
          </h1>

          <p className="mt-3 text-base leading-7 text-slate-500">
            Pick any campus organizations you already belong to or want connected to your profile.
          </p>

          {availableClubs.length > 0 ? (
            <div className="mt-8 space-y-3">
              {availableClubs.map((club) => {
                const selected =
                  selectedClubIds.includes(club.id);

                const selectable =
                  club.membershipType !==
                    "invitation" &&
                  club.membershipType !==
                    "restricted";

                return (
                  <TactileButton
                    key={club.id}
                    type="button"
                    disabled={!selectable}
                    onClick={() => {
                      setSelectedClubIds(
                        (current) =>
                          current.includes(club.id)
                            ? current.filter(
                                (id) =>
                                  id !== club.id,
                              )
                            : [...current, club.id],
                      );
                    }}
                    className={`w-full rounded-[1.4rem] border px-4 py-4 text-left transition ${
                      selected
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-950"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <p className="font-black">
                      {club.name}
                    </p>

                    <p
                      className={`mt-1 text-sm ${
                        selected
                          ? "text-slate-300"
                          : "text-slate-500"
                      }`}
                    >
                      {club.shortDescription}
                    </p>

                    {!selectable && (
                      <p className="mt-2 text-xs font-bold uppercase tracking-wide">
                        Invitation required
                      </p>
                    )}
                  </TactileButton>
                );
              })}
            </div>
          ) : (
            <div className="mt-8 rounded-[1.4rem] bg-slate-50 px-4 py-5">
              <p className="font-black text-slate-950">
                Clubs are coming soon for{" "}
                {verifiedTarget.identity.shortName}.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Your university is verified. You can finish signup now and add clubs later.
              </p>
            </div>
          )}

          <TactileButton
            type="button"
            onClick={finishOnboarding}
            className="mt-7 w-full rounded-full bg-slate-950 px-5 py-4 text-base font-black text-white transition active:scale-[0.985]"
          >
            {selectedClubIds.length > 0
              ? "Finish setup"
              : "Skip for now"}
          </TactileButton>
        </div>
      </main>
    );
  }


  if (
    profileSetupOpen &&
    verifiedTarget &&
    selectedPrimaryEmail
  ) {
    const normalizedUsername = username
      .trim()
      .toLowerCase();

    const usernameValid =
      /^[a-z0-9._]{3,30}$/.test(
        normalizedUsername,
      );

    const profileValid =
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      usernameValid;

    function splitTags(value: string) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return (
      <main className="min-h-dvh bg-white px-5 py-10 text-slate-950">
        <div className="mx-auto w-full max-w-md py-8">
          <TactileButton
            type="button"
            onClick={() => setProfileSetupOpen(false)}
            className="mb-8 w-fit text-sm font-bold text-slate-500"
          >
            Back
          </TactileButton>

          <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">
            The Campus Mint
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em]">
            Build your profile
          </h1>

          <p className="mt-3 text-base leading-7 text-slate-500">
            Tell your campus a little about you. You can change these later.
          </p>

          <div className="mt-8 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  First name
                </span>
                <input
                  value={firstName}
                  onChange={(event) =>
                    setFirstName(event.target.value)
                  }
                  autoComplete="given-name"
                  className="mt-2 block w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 outline-none focus:border-slate-400 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Last name
                </span>
                <input
                  value={lastName}
                  onChange={(event) =>
                    setLastName(event.target.value)
                  }
                  autoComplete="family-name"
                  className="mt-2 block w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 outline-none focus:border-slate-400 focus:bg-white"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Username
              </span>
              <input
                value={username}
                onChange={(event) =>
                  setUsername(
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9._]/g, "")
                      .slice(0, 30),
                  )
                }
                autoCapitalize="none"
                spellCheck={false}
                placeholder="your.username"
                className="mt-2 block w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 outline-none focus:border-slate-400 focus:bg-white"
              />
              {username.length > 0 &&
                !usernameValid && (
                  <p className="mt-2 text-xs font-semibold text-red-600">
                    Use 3–30 letters, numbers, periods, or underscores.
                  </p>
                )}
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Bio
              </span>
              <textarea
                value={bio}
                onChange={(event) =>
                  setBio(event.target.value.slice(0, 240))
                }
                rows={3}
                placeholder="A little about you…"
                className="mt-2 block w-full resize-none rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 outline-none focus:border-slate-400 focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Interests
              </span>
              <input
                value={interests}
                onChange={(event) =>
                  setInterests(event.target.value)
                }
                placeholder="Football, coding, photography"
                className="mt-2 block w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 outline-none focus:border-slate-400 focus:bg-white"
              />
              <p className="mt-1 text-xs text-slate-400">
                Separate with commas.
              </p>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Hobbies
              </span>
              <input
                value={hobbies}
                onChange={(event) =>
                  setHobbies(event.target.value)
                }
                placeholder="Running, gaming, cooking"
                className="mt-2 block w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 outline-none focus:border-slate-400 focus:bg-white"
              />
              <p className="mt-1 text-xs text-slate-400">
                Separate with commas.
              </p>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Academic area
              </span>
              <input
                value={academicArea}
                onChange={(event) =>
                  setAcademicArea(event.target.value)
                }
                placeholder="Engineering, Business, Biology..."
                className="mt-2 block w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 outline-none focus:border-slate-400 focus:bg-white"
              />
            </label>

            <div className="rounded-[1.4rem] border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    Offer tutoring
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Let students find you by broad subject.
                  </p>
                </div>

                <TactileButton
                  type="button"
                  selected={offersTutoring}
                  onClick={() =>
                    setOffersTutoring(
                      (current) => !current,
                    )
                  }
                  className={`rounded-full px-4 py-2 text-sm font-black ${
                    offersTutoring
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {offersTutoring ? "On" : "Off"}
                </TactileButton>
              </div>

              {offersTutoring && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "Math",
                    "Science",
                    "English / Writing",
                    "Business",
                    "Engineering",
                    "Languages",
                    "Computer Science",
                    "Other",
                  ].map((subject) => {
                    const selected =
                      tutoringSubjects.includes(subject);

                    return (
                      <TactileButton
                        key={subject}
                        type="button"
                        selected={selected}
                        onClick={() =>
                          setTutoringSubjects((current) =>
                            current.includes(subject)
                              ? current.filter(
                                  (item) =>
                                    item !== subject,
                                )
                              : [...current, subject],
                          )
                        }
                        className={`rounded-full border px-3 py-2 text-sm font-bold ${
                          selected
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {subject}
                      </TactileButton>
                    );
                  })}
                </div>
              )}
            </div>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Phone number{" "}
                <span className="font-medium text-slate-400">
                  optional
                </span>
              </span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(event) =>
                  setPhoneNumber(event.target.value)
                }
                autoComplete="tel"
                placeholder="(555) 555-5555"
                className="mt-2 block w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 outline-none focus:border-slate-400 focus:bg-white"
              />
            </label>
          </div>

          <TactileButton
            type="button"
            disabled={!profileValid}
            onClick={() => {
              setProfileSetupOpen(false);
              setClubSetupOpen(true);
            }}
            className="mt-7 w-full rounded-full bg-slate-950 px-5 py-4 text-base font-black text-white transition active:scale-[0.985] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            Continue
          </TactileButton>
        </div>
      </main>
    );
  }


  if (verifiedTarget) {
    const normalizedPersonalEmail =
      personalEmail.trim().toLowerCase();

    const personalEmailValid =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedPersonalEmail,
      ) &&
      !normalizedPersonalEmail.endsWith(".edu");

    return (
      <main className="min-h-dvh bg-white px-5 py-10 text-slate-950">
        <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-md flex-col justify-center">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">
            The Campus Mint
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em]">
            Choose your sign-in email
          </h1>

          <p className="mt-3 text-base leading-7 text-slate-500">
            Your student status stays verified even if your university email stops working later.
          </p>

          <div className="mt-8 space-y-3">
            <TactileButton
              type="button"
              onClick={() => {
                setEmailChoice("university");
                setPersonalEmail("");
              }}
              className={`w-full rounded-[1.4rem] border px-4 py-4 text-left transition ${
                emailChoice === "university"
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-950"
              }`}
            >
              <p className="font-black">
                Keep university email
              </p>
              <p className={`mt-1 text-sm ${
                emailChoice === "university"
                  ? "text-slate-300"
                  : "text-slate-500"
              }`}>
                {verifiedTarget.email}
              </p>
            </TactileButton>

            <TactileButton
              type="button"
              onClick={() => setEmailChoice("personal")}
              className={`w-full rounded-[1.4rem] border px-4 py-4 text-left transition ${
                emailChoice === "personal"
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-950"
              }`}
            >
              <p className="font-black">
                Use a personal email
              </p>
              <p className={`mt-1 text-sm ${
                emailChoice === "personal"
                  ? "text-slate-300"
                  : "text-slate-500"
              }`}>
                Your .edu email remains attached only as your verified university credential.
              </p>
            </TactileButton>
          </div>

          {emailChoice === "personal" && (
            <label className="mt-5 block">
              <span className="text-sm font-bold text-slate-700">
                Personal email
              </span>

              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={personalEmail}
                onChange={(event) =>
                  setPersonalEmail(event.target.value)
                }
                placeholder="you@example.com"
                className="mt-2 block w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-base font-semibold outline-none transition focus:border-slate-400 focus:bg-white"
              />

              {personalEmail.length > 0 &&
                !personalEmailValid && (
                  <p className="mt-2 text-sm font-semibold text-red-600">
                    Enter a valid personal email that is not a .edu address.
                  </p>
                )}
            </label>
          )}

          <TactileButton
            type="button"
            disabled={
              !emailChoice ||
              (emailChoice === "personal" &&
                !personalEmailValid)
            }
            onClick={() => {
              if (emailChoice === "university") {
                setSelectedPersonalEmail(null);
                setSelectedPrimaryEmail(
                  verifiedTarget.email,
                );
                setProfileSetupOpen(true);
                return;
              }

              if (
                emailChoice === "personal" &&
                personalEmailValid
              ) {
                setSelectedPersonalEmail(
                  normalizedPersonalEmail,
                );
                setSelectedPrimaryEmail(
                  normalizedPersonalEmail,
                );
                setProfileSetupOpen(true);
              }
            }}
            className="mt-7 w-full rounded-full bg-slate-950 px-5 py-4 text-base font-black text-white transition active:scale-[0.985] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            Continue
          </TactileButton>
        </div>
      </main>
    );
  }

  if (verificationTarget) {
    return (
      <main className="min-h-dvh bg-white px-5 py-10 text-slate-950">
        <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-md flex-col justify-center">
          <TactileButton
            type="button"
            onClick={() => {
              setVerificationTarget(null);
              setEnteredCode("");
              setCodeError(false);
            }}
            className="mb-8 w-fit text-sm font-bold text-slate-500"
          >
            Change email
          </TactileButton>

          <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">
            The Campus Mint
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em]">
            Check your email
          </h1>

          <p className="mt-3 text-base leading-7 text-slate-500">
            Enter the six-digit code sent to{" "}
            <span className="font-bold text-slate-800">
              {verificationTarget.email}
            </span>
            .
          </p>

          {process.env.NODE_ENV === "development" && (
            <div className="mt-6 rounded-[1.4rem] bg-amber-50 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                Development verification code
              </p>
              <p className="mt-2 text-2xl font-black tracking-[0.2em] text-amber-950">
                {verificationCode}
              </p>
              <p className="mt-2 text-xs leading-5 text-amber-800">
                No email is being sent yet. This code is shown only while the app is running in development.
              </p>
            </div>
          )}

          <form
            onSubmit={verifyCode}
            className="mt-7 space-y-4"
          >
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={enteredCode}
              onChange={(event) => {
                setEnteredCode(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6),
                );
                setCodeError(false);
              }}
              placeholder="000000"
              aria-label="Verification code"
              className="block w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-center text-2xl font-black tracking-[0.22em] outline-none transition focus:border-slate-400 focus:bg-white"
            />

            {codeError && (
              <p className="text-sm font-semibold text-red-600">
                That verification code is incorrect.
              </p>
            )}

            <TactileButton
              type="submit"
              disabled={enteredCode.length !== 6}
              className="w-full rounded-full bg-slate-950 px-5 py-4 text-base font-black text-white transition active:scale-[0.985] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              Verify student email
            </TactileButton>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-white px-5 py-10 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-md flex-col justify-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">
            The Campus Mint
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em]">
            Verify your university
          </h1>

          <p className="mt-3 text-base leading-7 text-slate-500">
            Use your university .edu email to join your campus.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-9 space-y-4"
        >
          <label className="block">
            <span className="text-sm font-bold text-slate-700">
              Student email
            </span>

            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setSubmitted(false);
              }}
              placeholder="you@university.edu"
              className="mt-2 block w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-base font-semibold outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </label>

          {resolved && (
            <div className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                University found
              </p>

              <p className="mt-1 font-black text-slate-950">
                {resolved.identity.name}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {resolved.domain}
              </p>
            </div>
          )}

          {showError && (
            <p className="text-sm font-semibold text-red-600">
              Enter a valid university .edu email.
            </p>
          )}

          <TactileButton
            type="submit"
            disabled={!resolved}
            className="w-full rounded-full bg-slate-950 px-5 py-4 text-base font-black text-white transition active:scale-[0.985] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            Continue
          </TactileButton>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-slate-400">
          Any .edu university email is supported.
        </p>
      </div>
    </main>
  );
}
