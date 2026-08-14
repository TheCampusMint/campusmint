"use client";

import { useMemo, useState } from "react";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import {
  getAccountUniversityName,
  getAccountUniversityShortName,
} from "@/data/universities";
import type { UniversityTheme } from "@/data/universities";
import { universities, type UniversityId } from "@/data/universities";
import {
  canViewGraduationYear,
  canViewMajor,
  createProfileViewerContext,
} from "@/lib/social/permissions";
import type { CampusMintUser } from "@/types/profile";
import type { FriendshipStatus } from "@/types/social";

type PeopleScope = "my_university" | "campus_network";

type PeopleSearchProps = {
  viewer: CampusMintUser;
  users: CampusMintUser[];
  theme: UniversityTheme;
  getFriendshipStatus: (userId: string) => FriendshipStatus;
  isBlocked: (userId: string) => boolean;
  onOpenProfile: (userId: string) => void;
};

export function PeopleSearch({ viewer, users, theme, getFriendshipStatus, isBlocked, onOpenProfile }: PeopleSearchProps) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<PeopleScope>("campus_network");
  const [major, setMajor] = useState("all");
  const [year, setYear] = useState("all");
  const network = getCampusNetworkForUniversity(viewer.account.universityId);

  const candidates = useMemo(() => users.filter((user) => {
    if (user.account.id === viewer.account.id || user.account.role !== "student" || isBlocked(user.account.id)) return false;
    if (scope === "my_university") return user.account.universityId === viewer.account.universityId;
    return (network?.universityIds as readonly UniversityId[] | undefined)?.includes(user.account.universityId) ?? user.account.universityId === viewer.account.universityId;
  }), [isBlocked, network, scope, users, viewer.account.id, viewer.account.universityId]);

  const safeCandidates = candidates.map((user) => {
    const context = createProfileViewerContext(viewer, user, getFriendshipStatus(user.account.id));
    return {
      user,
      visibleMajor: canViewMajor(context) ? user.profile.major : null,
      visibleYear: canViewGraduationYear(context) ? user.profile.graduationYear : null,
    };
  });

  const majorOptions = Array.from(new Set(safeCandidates.map((candidate) => candidate.visibleMajor).filter((value): value is string => Boolean(value)))).sort();
  const yearOptions = Array.from(new Set(safeCandidates.map((candidate) => candidate.visibleYear).filter((value): value is number => value !== null))).sort();
  const normalizedQuery = query.trim().toLowerCase();
  const results = safeCandidates.filter(({ user, visibleMajor, visibleYear }) => {
    if (major !== "all" && visibleMajor !== major) return false;
    if (year !== "all" && visibleYear !== Number(year)) return false;
    if (!normalizedQuery) return true;
    return [
      user.profile.displayName,
      user.profile.username,
      getAccountUniversityName(user.account),
      visibleMajor,
      visibleYear?.toString(),
    ].filter(Boolean).some((value) => value!.toLowerCase().includes(normalizedQuery));
  });

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="p-6 sm:p-8" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary}e8)`, color: theme.secondary }}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-75">Campus connections</p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">People</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 opacity-85">Find fictional development student profiles. Search respects every person&apos;s field-level privacy.</p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="sm:col-span-2"><span className="sr-only">Search people</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, university, major, or year" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" /></label>
          <label><span className="sr-only">Campus scope</span><select value={scope} onChange={(event) => setScope(event.target.value as PeopleScope)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="my_university">My University</option><option value="campus_network">Campus Network</option></select></label>
          <div className="grid grid-cols-2 gap-3">
            <label><span className="sr-only">Major filter</span><select value={major} onChange={(event) => setMajor(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="all">Major</option>{majorOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label><span className="sr-only">Year filter</span><select value={year} onChange={(event) => setYear(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="all">Year</option>{yearOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between px-1 text-sm text-slate-500">
        <p>
          {results.length} development profile
          {results.length === 1 ? "" : "s"}
        </p>
        <p>
          {scope === "my_university"
            ? getAccountUniversityShortName(viewer.account)
            : network?.name ?? "Campus network"}
        </p>
      </div>
      {results.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{results.map(({ user, visibleMajor, visibleYear }) => (
        <button key={user.account.id} type="button" onClick={() => onOpenProfile(user.account.id)} className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: theme.primary }}>
          <div className="flex items-center gap-4">
            <ProfileAvatar
              user={user}
              primaryColor={theme.primary}
              accentColor={theme.accent}
            />
            <div className="min-w-0">
              <h3 className="truncate font-black text-slate-950">
                {user.profile.displayName}
              </h3>
              <p className="mt-0.5 truncate text-sm text-slate-500">
                @{user.profile.username} ·{" "}
                {getAccountUniversityShortName(user.account)}
              </p>
            </div>
          </div>
          {(visibleMajor || visibleYear) && <p className="mt-4 text-sm text-slate-700">{visibleMajor}{visibleMajor && visibleYear ? " · " : ""}{visibleYear ? `Class of ${visibleYear}` : ""}</p>}
          <span className="mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: theme.accent, color: theme.primary }}>Development profile</span>
        </button>
      ))}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><h3 className="font-bold text-slate-900">No people in this view</h3><p className="mt-2 text-sm text-slate-500">Try a wider campus scope or clear a filter.</p></div>}
    </div>
  );
}
