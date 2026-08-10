"use client";

import { useState } from "react";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { UniversityTheme } from "@/data/universities";
import type { ProfilesState } from "@/hooks/useProfiles";
import type { CampusMintUser } from "@/types/profile";

export function MessagesSkeleton({ viewer, theme, profiles }: { viewer: CampusMintUser; theme: UniversityTheme; profiles: ProfilesState }) {
  const candidates = profiles.users.filter((user) => user.account.id !== viewer.account.id && !profiles.isBlocked(user.account.id));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = candidates.find((user) => user.account.id === selectedId) ?? null;
  return (
    <div className="space-y-5"><div className="px-1"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Private conversations</p><h1 className="mt-1 text-3xl font-black text-slate-950">Messages</h1></div>
      <div className="grid min-h-[28rem] overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/90 shadow-sm md:grid-cols-[17rem_1fr]">
        <aside className="border-b border-slate-100 p-3 md:border-b-0 md:border-r"><button type="button" className="mb-3 w-full rounded-xl px-4 py-3 text-sm font-black" style={{ backgroundColor: theme.primary, color: theme.secondary }}>＋ New message</button><div className="space-y-1">{candidates.slice(0, 5).map((user) => <button key={user.account.id} type="button" onClick={() => setSelectedId(user.account.id)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50"><ProfileAvatar user={user} size="sm" primaryColor={theme.primary} accentColor={theme.accent} /><span className="min-w-0"><strong className="block truncate text-sm text-slate-900">{user.profile.displayName}</strong><span className="block truncate text-xs text-slate-500">@{user.profile.username}</span></span></button>)}</div></aside>
        <section className="flex min-h-72 flex-col items-center justify-center p-8 text-center">{selected ? <><ProfileAvatar user={selected} size="lg" primaryColor={theme.primary} accentColor={theme.accent} /><h2 className="mt-4 font-black text-slate-950">{selected.profile.displayName}</h2><p className="mt-2 max-w-xs text-sm text-slate-500">Direct messaging infrastructure is intentionally a shell. No messages or unread counts are fabricated.</p></> : <><span className="text-4xl" aria-hidden="true">✉</span><h2 className="mt-4 font-black text-slate-950">Choose a conversation</h2><p className="mt-2 text-sm text-slate-500">Select a development profile to preview the private-message shell.</p></>}</section>
      </div>
    </div>
  );
}

