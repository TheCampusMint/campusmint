"use client";

import { useState } from "react";

import { CreateContentFlow } from "@/components/content/CreateContentFlow";
import { MintFeedList } from "@/components/mintz/MintFeedList";
import type { UniversityTheme } from "@/data/universities";
import type { MintzState } from "@/hooks/useMintz";
import type { ProfilesState } from "@/hooks/useProfiles";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import {
  getMintFeed,
  type MintFeed,
} from "@/lib/social/mintFeeds";
import type { CampusMintUser } from "@/types/profile";
import type { Story } from "@/types/story";

type MintzHubProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  mintz: MintzState;
  onCreateStory: (story: Story) => void;
  onOpenProfile: (userId: string) => void;
  organizations: OrganizationsState;
  onRequestOrganization: (organizationId: string) => void;
};

const feedLabels: Record<MintFeed, string> = {
  following: "Following",
  campus: "Campus",
  discover: "Discover",
};

export function MintzHub({ viewer, theme, profiles, mintz, organizations, onCreateStory, onOpenProfile, onRequestOrganization }: MintzHubProps) {
  // Retained for compatibility with the dormant Story-backed hub contract.
  void onCreateStory;
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
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.primary }}>Permanent and temporary social posts</p><h2 className="mt-1 text-3xl font-black text-slate-950">Mintz</h2><p className="mt-2 max-w-2xl text-sm text-slate-600">Chronological development feeds powered by centralized account privacy, relationship, campus-network, and expiration rules.</p></div><button type="button" onClick={() => setCreateOpen(true)} className="rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ backgroundColor: theme.primary }}>Create Mint</button></div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">{(Object.keys(feedLabels) as MintFeed[]).map((option) => <button key={option} type="button" onClick={() => setFeed(option)} className="rounded-xl px-4 py-2 text-sm font-bold" style={feed === option ? { backgroundColor: theme.primary, color: theme.secondary } : { backgroundColor: "#f1f5f9", color: "#475569" }}>{feedLabels[option]}</button>)}</div>
      </section>

      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}
      <div className="mx-auto max-w-2xl"><MintFeedList mints={visibleMintz} viewer={viewer} theme={theme} profiles={profiles} mintz={mintz} organizations={organizations} feedState={feedState} onOpenProfile={onOpenProfile} onRequestOrganization={onRequestOrganization} onNotice={setNotice} /></div>

      {createOpen && <CreateContentFlow viewer={viewer} users={feedState.users} theme={theme} onCreateMint={mintz.createMint} onClose={() => setCreateOpen(false)} organizationMemberships={organizations.memberships} organizationRoles={organizations.roles} />}
    </div>
  );
}
