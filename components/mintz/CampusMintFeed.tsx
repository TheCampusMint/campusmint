"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

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
  reducedMotion?: boolean;
  autoplayVideo?: boolean;
  defaultCommentsEnabled?: boolean;
  defaultHideLikeCounts?: boolean;
};

const feedLabels: Record<MintFeed, string> = {
  following: "Following",
  campus: "Campus",
  discover: "Discover",
};


function FeedMotionTab({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="relative z-10 shrink-0 rounded-full border px-4 py-2 text-xs font-black"
      style={
        selected
          ? {
              backgroundColor: "var(--app-accent)",
              borderColor: "var(--app-accent)",
              color: "var(--app-accent-contrast)",
            }
          : {
              backgroundColor: "var(--app-surface)",
              borderColor: "var(--app-border)",
              color: "var(--app-text-secondary)",
            }
      }
    >
      {label}
    </button>
  );
}

export function CampusMintFeed({ viewer, theme, profiles, mintz, organizations, onCreateStory, onOpenProfile, onRequestOrganization, reducedMotion, autoplayVideo, defaultCommentsEnabled, defaultHideLikeCounts }: CampusMintFeedProps) {
  const [feed, setFeed] = useState<MintFeed>("campus");
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const feedState = useMemo(() => ({
    viewer,
    users: profiles.users.map((user) => user.account.id === viewer.account.id ? viewer : user),
    friendships: profiles.friendships,
    follows: profiles.follows,
    blocks: profiles.blocks,
    currentTime: mintz.currentTime,
    organizationMemberships: organizations.memberships,
    followedOrganizationIds: organizations.followedOrganizationIds,
  }), [mintz.currentTime, organizations.followedOrganizationIds, organizations.memberships, profiles.blocks, profiles.follows, profiles.friendships, profiles.users, viewer]);
  const visibleMintz = useMemo(() => getMintFeed(mintz.mintz, feed, feedState), [feed, feedState, mintz.mintz]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 px-1 pt-1">
        <h1 className="text-3xl font-black tracking-[-0.05em] text-slate-950">Mint</h1>
        <button type="button" onClick={() => setCreateOpen(true)} className="interactive-pop rounded-full px-5 py-3 text-sm font-black shadow-lg transition" style={{ backgroundColor: "var(--app-accent)", color: "var(--app-accent-contrast)" }}>＋ Create</button>
      </div>

      <div className="relative flex gap-5 overflow-visible py-2" aria-label="Mint feeds">
        {(Object.keys(feedLabels) as MintFeed[]).map((option) => (
          <FeedMotionTab
            key={option}
            label={feedLabels[option]}
            selected={feed === option}
            reducedMotion={Boolean(reducedMotion)}
            onSelect={() => setFeed(option)}
          />
        ))}
      </div>

      {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}

      <MintFeedList mints={visibleMintz} viewer={viewer} theme={theme} profiles={profiles} mintz={mintz} organizations={organizations} feedState={feedState} onOpenProfile={onOpenProfile} onRequestOrganization={onRequestOrganization} onNotice={setNotice} reducedMotion={reducedMotion} autoplayVideo={autoplayVideo} />

      {createOpen && <CreateContentFlow viewer={viewer} users={feedState.users} theme={theme} onCreateMint={mintz.createMint} onClose={() => setCreateOpen(false)} organizationMemberships={organizations.memberships} organizationRoles={organizations.roles} defaultCommentsEnabled={defaultCommentsEnabled} defaultHideLikeCounts={defaultHideLikeCounts} />}
    </div>
  );
}
