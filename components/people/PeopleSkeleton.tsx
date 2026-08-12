"use client";

import { useMemo, useState } from "react";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { TactileButton } from "@/components/ui/TactileButton";
import type { UniversityTheme } from "@/data/universities";
import { universities } from "@/data/universities";
import type { ProfilesState } from "@/hooks/useProfiles";
import { canViewInterests, canViewMajor, createProfileViewerContext } from "@/lib/social/permissions";
import type { CampusMintUser } from "@/types/profile";

type PeopleSkeletonProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  onOpenProfile: (userId: string) => void;
};

export function PeopleSkeleton({ viewer, theme, profiles, onOpenProfile }: PeopleSkeletonProps) {
  const [query, setQuery] = useState("");
  const [universityFilter, setUniversityFilter] =
    useState("all");
  const [tutoringOnly, setTutoringOnly] =
    useState(false);
  const [tutoringSubject, setTutoringSubject] =
    useState<string | null>(null);

  const universityOptions = useMemo(() => {
    const names = new Map<string, string>();

    for (const user of profiles.users) {
      const id =
        user.account.universityIdentityId ??
        user.account.universityId;

      const name =
        user.account.universityName ??
        universities[user.account.universityId]
          ?.name ??
        user.account.universityId;

      names.set(id, name);
    }

    return [...names.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) =>
        a.name.localeCompare(b.name),
      );
  }, [profiles.users]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return profiles.users.flatMap((user) => {
      if (
        user.account.id === viewer.account.id ||
        profiles.isBlocked(user.account.id)
      ) {
        return [];
      }

      const context = createProfileViewerContext(
        viewer,
        user,
        profiles.getFriendshipStatus(
          user.account.id,
        ),
      );

      const major = canViewMajor(context)
        ? user.profile.major
        : null;

      const interests = canViewInterests(context)
        ? user.profile.interests
        : [];

      const hobbies = user.profile.hobbies ?? [];
      const academicArea =
        user.profile.academicArea ?? null;

      const tutoringSubjects =
        user.profile.offersTutoring
          ? user.profile.tutoringSubjects ?? []
          : [];

      const universityName =
        user.account.universityName ??
        universities[user.account.universityId]
          ?.name ??
        user.account.universityId;

      const universityShortName =
        user.account.universityShortName ??
        universities[user.account.universityId]
          ?.shortName ??
        universityName;

      const searchable = [
        user.profile.displayName,
        user.profile.firstName,
        user.profile.lastName,
        user.profile.username,
        universityName,
        universityShortName,
        major ?? "",
        academicArea ?? "",
        ...interests,
        ...hobbies,
        ...tutoringSubjects,
      ]
        .join(" ")
        .toLowerCase();

      if (
        normalized &&
        !searchable.includes(normalized)
      ) {
        return [];
      }

      const userUniversityId =
        user.account.universityIdentityId ??
        user.account.universityId;

      if (
        universityFilter !== "all" &&
        userUniversityId !== universityFilter
      ) {
        return [];
      }

      if (
        tutoringOnly &&
        tutoringSubjects.length === 0
      ) {
        return [];
      }

      if (
        tutoringSubject &&
        !tutoringSubjects.includes(
          tutoringSubject,
        )
      ) {
        return [];
      }

      const personTheme =
        universities[user.account.universityId];

      const personPrimary =
        personTheme?.primary ?? "#0f172a";

      const personAccent =
        personTheme?.accent ?? "#f1f5f9";

      return [{
        user,
        major,
        interests,
        hobbies,
        academicArea,
        tutoringSubjects,
        universityShortName,
        personPrimary,
        personAccent,
      }];
    });
  }, [
    profiles,
    query,
    tutoringOnly,
    tutoringSubject,
    universityFilter,
    viewer,
  ]);

  return (
    <div className="space-y-5">
      <div className="px-1"><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">People</h1></div>
      <label className="block"><span className="sr-only">Search people</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find friends, classmates, roommates, tutors, and collaborators…" className="w-full rounded-2xl border border-white/80 bg-white/90 px-4 py-3.5 text-sm shadow-sm outline-none focus:ring-2" style={{ caretColor: theme.primary }} /></label>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={universityFilter}
          onChange={(event) =>
            setUniversityFilter(
              event.target.value,
            )
          }
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none"
        >
          <option value="all">
            All universities
          </option>
          {universityOptions.map((option) => (
            <option
              key={option.id}
              value={option.id}
            >
              {option.name}
            </option>
          ))}
        </select>

        <TactileButton
          type="button"
          selected={tutoringOnly}
          onClick={() => {
            setTutoringOnly(
              (current) => !current,
            );

            if (tutoringOnly) {
              setTutoringSubject(null);
            }
          }}
          className={`rounded-full border px-3 py-2 text-xs font-black ${
            tutoringOnly
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Tutoring
        </TactileButton>

        {tutoringOnly &&
          [
            "Math",
            "Science",
            "English / Writing",
            "Business",
            "Engineering",
            "Languages",
            "Computer Science",
            "Other",
          ].map((subject) => (
            <TactileButton
              key={subject}
              type="button"
              selected={
                tutoringSubject === subject
              }
              onClick={() =>
                setTutoringSubject(
                  tutoringSubject === subject
                    ? null
                    : subject,
                )
              }
              className={`rounded-full border px-3 py-2 text-xs font-bold ${
                tutoringSubject === subject
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {subject}
            </TactileButton>
          ))}
      </div>
      {results.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{results.map(({
        user,
        major,
        interests,
        hobbies,
        academicArea,
        tutoringSubjects,
        universityShortName,
        personPrimary,
        personAccent,
      }) => (
        <TactileButton key={user.account.id} type="button" onClick={() => onOpenProfile(user.account.id)} className="rounded-[1.5rem] border border-white/80 bg-white/90 p-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: personPrimary }}>
          <div className="flex items-center gap-3"><ProfileAvatar user={user} size="md" primaryColor={personPrimary} accentColor={personAccent} /><div className="min-w-0"><h2 className="truncate text-sm font-black text-slate-950">{user.profile.displayName}</h2><p className="truncate text-xs text-slate-500">@{user.profile.username}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: personPrimary }}>{universityShortName}</p></div></div>
          {(major || academicArea) && (
            <p className="mt-4 text-xs font-bold text-slate-700">
              {[major, academicArea]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {(interests.length > 0 ||
            hobbies.length > 0) && (
            <div
              className="mt-3 flex flex-wrap gap-1.5"
              aria-label="Visible interests and hobbies"
            >
              {[...interests, ...hobbies]
                .slice(0, 3)
                .map((item) => (
                  <span
                    key={item}
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={{
                      backgroundColor: personAccent,
                      color: personPrimary,
                    }}
                  >
                    {item}
                  </span>
                ))}
            </div>
          )}

          {tutoringSubjects.length > 0 && (
            <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-emerald-700">
              Tutors: {tutoringSubjects.join(", ")}
            </p>
          )}
        </TactileButton>
      ))}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-sm text-slate-500">No visible development profiles match this search.</div>}
    </div>
  );
}

