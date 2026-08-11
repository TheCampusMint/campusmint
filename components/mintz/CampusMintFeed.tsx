"use client";

import { useMemo, useState } from "react";

import { CreateContentFlow } from "@/components/content/CreateContentFlow";
import { MintFeedList } from "@/components/mintz/MintFeedList";
import type { UniversityTheme } from "@/data/universities";
import type { MintzState } from "@/hooks/useMintz";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import type { ProfilesState } from "@/hooks/useProfiles";
import {
  getMintFeed,
  type MintFeed,
} from "@/lib/social/mintFeeds";
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
  onRequestOrganization: (
    organizationId: string,
  ) => void;
  onFeedChromeChange?: (hidden: boolean) => void;
  onRefresh?: () => void;
  reducedMotion?: boolean;
  autoplayVideo?: boolean;
  defaultCommentsEnabled?: boolean;
  defaultHideLikeCounts?: boolean;
};

const feedModes: MintFeed[] = [
  "following",
  "campus",
  "discover",
];

export function CampusMintFeed({
  viewer,
  theme,
  profiles,
  mintz,
  organizations,
  onCreateStory,
  onOpenProfile,
  onRequestOrganization,
  onFeedChromeChange,
  onRefresh,
  reducedMotion,
  autoplayVideo,
  defaultCommentsEnabled,
  defaultHideLikeCounts,
}: CampusMintFeedProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] =
    useState<string | null>(null);

  // Legacy story infrastructure remains available under
  // the hood, but there is no separate Story UI.
  void onCreateStory;

  const feedState = useMemo(
    () => ({
      viewer,
      users: profiles.users.map((user) =>
        user.account.id === viewer.account.id
          ? viewer
          : user,
      ),
      friendships: profiles.friendships,
      follows: profiles.follows,
      blocks: profiles.blocks,
      currentTime: mintz.currentTime,
      organizationMemberships:
        organizations.memberships,
      followedOrganizationIds:
        organizations.followedOrganizationIds,
    }),
    [
      mintz.currentTime,
      organizations.followedOrganizationIds,
      organizations.memberships,
      profiles.blocks,
      profiles.follows,
      profiles.friendships,
      profiles.users,
      viewer,
    ],
  );

  const visibleMintz = useMemo(() => {
    const unique = new Map<
      string,
      (typeof mintz.mintz)[number]
    >();

    for (const mode of feedModes) {
      for (const mint of getMintFeed(
        mintz.mintz,
        mode,
        feedState,
      )) {
        if (!unique.has(mint.id)) {
          unique.set(mint.id, mint);
        }
      }
    }

    return Array.from(unique.values()).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );
  }, [feedState, mintz.mintz]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 px-1 pt-1">
        <h1 className="text-3xl font-black tracking-[-0.05em] text-slate-950">
          Mint
        </h1>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          aria-label="Create Mint"
          title="Create Mint"
          className="interactive-pop flex h-10 w-10 items-center justify-center rounded-full text-[25px] font-black leading-none shadow-lg"
          style={{
            backgroundColor: "var(--app-accent)",
            color: "var(--app-accent-contrast)",
          }}
        >
          +
        </button>
      </div>

      {notice && (
        <div
          role="status"
          className="cm-content-swap flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <MintFeedList
        mints={visibleMintz}
        viewer={viewer}
        theme={theme}
        profiles={profiles}
        mintz={mintz}
        organizations={organizations}
        feedState={feedState}
        onOpenProfile={onOpenProfile}
        onRequestOrganization={
          onRequestOrganization
        }
        onNotice={setNotice}
        onFeedChromeChange={
          onFeedChromeChange
        }
        onRefresh={onRefresh}
        reducedMotion={reducedMotion}
        autoplayVideo={autoplayVideo}
      />

      {createOpen && (
        <CreateContentFlow
          viewer={viewer}
          users={feedState.users}
          theme={theme}
          onCreateMint={mintz.createMint}
          onClose={() => setCreateOpen(false)}
          organizationMemberships={
            organizations.memberships
          }
          organizationRoles={
            organizations.roles
          }
          defaultCommentsEnabled={
            defaultCommentsEnabled
          }
          defaultHideLikeCounts={
            defaultHideLikeCounts
          }
        />
      )}
    </div>
  );
}
