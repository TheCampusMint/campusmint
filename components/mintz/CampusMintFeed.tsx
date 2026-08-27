"use client";

import { useCallback, useMemo, useState } from "react";

import { FullscreenVideoViewer } from "@/components/mintz/FullscreenVideoViewer";
import { MintFeedList } from "@/components/mintz/MintFeedList";
import { sampleEvents } from "@/data/events";
import { developmentOrganizations } from "@/data/organizations";
import type { UniversityTheme } from "@/data/universities";
import type { EventMomentsState } from "@/hooks/useEventMoments";
import type { MintzState } from "@/hooks/useMintz";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import type { ProfilesState } from "@/hooks/useProfiles";
import { rankNormalMintFeed } from "@/lib/social/mintFeedRanking";
import { rankVideoMintz } from "@/lib/social/videoFeedRanking";
import {
  createMintVideoViewerState,
  getMintVideoViewerReturnScrollY,
  type MintVideoViewerState,
} from "@/lib/social/videoViewerState";
import type { CampusMintUser } from "@/types/profile";
import type { Story } from "@/types/story";

type CampusMintFeedProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  mintz: MintzState;
  organizations: OrganizationsState;
  eventMoments: EventMomentsState;
  onCreateStory: (story: Story) => void;
  onOpenProfile: (userId: string) => void;
  onRequestOrganization: (
    organizationId: string,
  ) => void;
  onFeedChromeChange?: (hidden: boolean) => void;
  onRefresh?: () => void;
  reducedMotion?: boolean;
  autoplayVideo?: boolean;
};

export function CampusMintFeed({
  viewer,
  theme,
  profiles,
  mintz,
  organizations,
  eventMoments,
  onCreateStory,
  onOpenProfile,
  onRequestOrganization,
  onFeedChromeChange,
  onRefresh,
  reducedMotion,
  autoplayVideo,
}: CampusMintFeedProps) {
  const [notice, setNotice] =
    useState<string | null>(null);
  const [videoViewer, setVideoViewer] =
    useState<MintVideoViewerState | null>(null);

  // Legacy story infrastructure remains available under
  // the hood, but there is no separate Story UI.
  void onCreateStory;
  const allMintz = mintz.mintz;

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
      organizationDirectory:
        developmentOrganizations,
      eventDirectory: sampleEvents,
      attendingEventIds: eventMoments.rsvps
        .filter(
          (rsvp) =>
            rsvp.userId === viewer.account.id &&
            rsvp.status === "attending",
        )
        .map((rsvp) => rsvp.eventId),
    }),
    [
      mintz.currentTime,
      eventMoments.rsvps,
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
    return rankNormalMintFeed(allMintz, feedState);
  }, [allMintz, feedState]);

  const rankedVideoMintz = useMemo(
    () => rankVideoMintz(allMintz, feedState),
    [allMintz, feedState],
  );

  const viewerMintz = useMemo(() => {
    if (!videoViewer) return [];

    const mintzById = new Map(
      allMintz.map((mint) => [mint.id, mint]),
    );

    return videoViewer.orderedMintIds.flatMap((mintId) => {
      const mint = mintzById.get(mintId);
      return mint ? [mint] : [];
    });
  }, [allMintz, videoViewer]);

  const closeVideoViewer = useCallback(() => {
    const returnScrollY = getMintVideoViewerReturnScrollY(
      videoViewer,
      window.scrollY,
    );
    setVideoViewer(null);

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: returnScrollY, behavior: "auto" });
    });
  }, [videoViewer]);

  return (
    <div className="space-y-3">
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
        onOpenVideo={(mintId, mediaId) =>
          setVideoViewer(createMintVideoViewerState({
            mintId,
            mediaId,
            feedScrollY: window.scrollY,
            orderedMintIds: rankedVideoMintz.map((mint) => mint.id),
          }))
        }
      />

      {videoViewer && (
        <FullscreenVideoViewer
          mints={viewerMintz}
          initialMintId={videoViewer.mintId}
          initialMediaId={videoViewer.mediaId}
          feedState={feedState}
          mintz={mintz}
          autoplayVideo={autoplayVideo}
          reducedMotion={reducedMotion}
          onClose={closeVideoViewer}
        />
      )}
    </div>
  );
}
