"use client";

import { useState } from "react";

import { CreateContentFlow } from "@/components/content/CreateContentFlow";
import { MintFeedList } from "@/components/mintz/MintFeedList";
import type { UniversityTheme } from "@/data/universities";
import type { MintzState } from "@/hooks/useMintz";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import type { ProfilesState } from "@/hooks/useProfiles";
import { getMintFeed, type MintFeed } from "@/lib/social/mintFeeds";
import type { CampusMintUser } from "@/types/profile";
import type { Story } from "@/types/story";

type CampusMintFeedProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  mintz: MintzState;
  organizations: OrganizationsState;
  onCreateStory: (story: Story) => void;
  onOpenProfile: (userId: string) => void;
  onRequestOrganization: (organizationId: string) => void;
};

const feedLabels: Record<MintFeed, string> = {
  following: "Following",
  campus: "Campus",
  discover: "Discover",
};

export function CampusMintFeed({ viewer, theme, profiles, mintz, organizations, onCreateStory, onOpenProfile, onRequestOrganization }: CampusMintFeedProps) {
  const [feed, setFeed] = useState<MintFeed>("campus");
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const feedState = {
    viewer,
    users: profiles.users.map((user) => user.account.id === viewer.account.id ? viewer : user),
    friendships: profiles.friendships,
    follows: profiles.follows,
    blocks: profiles.blocks,
    currentTime: mintz.currentTime,
    organizationMemberships: organizations.memberships,
    followedOrganizationIds: organizations.followedOrganizationIds,
  };
  const visibleMintz = getMintFeed(mintz.mintz, feed, feedState);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 px-1 pt-2">
        <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Your campus, in motion</p><h1 className="mt-1 text-4xl font-black tracking-[-0.05em] text-slate-950">Mint</h1></div>
        <button type="button" onClick={() => setCreateOpen(true)} className="rounded-full px-5 py-3 text-sm font-black shadow-lg transition active:scale-95" style={{ backgroundColor: theme.primary, color: theme.secondary }}>＋ Create</button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Mint feeds">
        {(Object.keys(feedLabels) as MintFeed[]).map((option) => <button key={option} type="button" onClick={() => setFeed(option)} aria-pressed={feed === option} className="shrink-0 rounded-full border px-4 py-2 text-xs font-black transition" style={feed === option ? { backgroundColor: theme.primary, borderColor: theme.primary, color: theme.secondary } : { backgroundColor: "rgba(255,255,255,.72)", borderColor: "rgba(148,163,184,.35)", color: "#475569" }}>{feedLabels[option]}</button>)}
      </div>

      {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}

      <MintFeedList mints={visibleMintz} viewer={viewer} theme={theme} profiles={profiles} mintz={mintz} organizations={organizations} feedState={feedState} onOpenProfile={onOpenProfile} onRequestOrganization={onRequestOrganization} onNotice={setNotice} />

      {createOpen && <CreateContentFlow viewer={viewer} users={feedState.users} theme={theme} onCreateMint={mintz.createMint} onCreateStory={onCreateStory} onClose={() => setCreateOpen(false)} organizationMemberships={organizations.memberships} organizationRoles={organizations.roles} />}
    </div>
  );
}
