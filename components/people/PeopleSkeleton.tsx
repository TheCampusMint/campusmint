"use client";

import { useMemo, useState } from "react";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
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
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return profiles.users.flatMap((user) => {
      if (user.account.id === viewer.account.id || profiles.isBlocked(user.account.id)) return [];
      if (!theme.accessibleCampuses.includes(user.account.universityId)) return [];
      const context = createProfileViewerContext(viewer, user, profiles.getFriendshipStatus(user.account.id));
      const major = canViewMajor(context) ? user.profile.major : null;
      const interests = canViewInterests(context) ? user.profile.interests : [];
      const searchable = `${user.profile.displayName} ${user.profile.username} ${major ?? ""} ${interests.join(" ")}`.toLowerCase();
      if (normalized && !searchable.includes(normalized)) return [];
      return [{ user, major, interests }];
    });
  }, [profiles, query, theme.accessibleCampuses, viewer]);

  return (
    <div className="space-y-5">
      <div className="px-1"><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">People</h1></div>
      <label className="block"><span className="sr-only">Search people</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find friends, classmates, roommates, and collaborators…" className="w-full rounded-2xl border border-white/80 bg-white/90 px-4 py-3.5 text-sm shadow-sm outline-none focus:ring-2" style={{ caretColor: theme.primary }} /></label>
      {results.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{results.map(({ user, major, interests }) => (
        <button key={user.account.id} type="button" onClick={() => onOpenProfile(user.account.id)} className="rounded-[1.5rem] border border-white/80 bg-white/90 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: theme.primary }}>
          <div className="flex items-center gap-3"><ProfileAvatar user={user} size="md" primaryColor={theme.primary} accentColor={theme.accent} /><div className="min-w-0"><h2 className="truncate text-sm font-black text-slate-950">{user.profile.displayName}</h2><p className="truncate text-xs text-slate-500">@{user.profile.username}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: theme.primary }}>{universities[user.account.universityId].shortName}</p></div></div>
          {major && <p className="mt-4 text-xs font-bold text-slate-700">{major}</p>}
          {interests.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Visible interests and hobbies">{interests.slice(0, 3).map((interest) => <span key={interest} className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ backgroundColor: theme.accent, color: theme.primary }}>{interest}</span>)}</div>}
        </button>
      ))}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-sm text-slate-500">No visible development profiles match this search.</div>}
    </div>
  );
}

