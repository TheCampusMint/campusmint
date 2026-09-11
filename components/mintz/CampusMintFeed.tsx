"use client";

import { useCallback, useMemo, useState } from "react";

import { FullscreenVideoViewer } from "@/components/mintz/FullscreenVideoViewer";
import { MintFeedList } from "@/components/mintz/MintFeedList";
import { developmentOrganizations } from "@/data/organizations";
import { areDevelopmentFixturesEnabled } from "@/lib/runtime/fixturePolicy";
import type { UniversityTheme } from "@/data/universities";
import type { EventMomentsState } from "@/hooks/useEventMoments";
import type { DirectMintState } from "@/hooks/useDirectMint";
import type { MintzState } from "@/hooks/useMintz";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import type { ProfilesState } from "@/hooks/useProfiles";
import { rankNormalMintFeed } from "@/lib/social/mintFeedRanking";
import { applyCurrentPinsToGeneration, createFeedGeneration, flattenFeedGeneration } from "@/lib/social/feedGeneration";
import {
  createMintVideoViewerState,
  getMintVideoViewerReturnScrollY,
  type MintVideoViewerState,
} from "@/lib/social/videoViewerState";
import type { CampusMintUser } from "@/types/profile";
import type { Story } from "@/types/story";
import type { Event } from "@/types/event";

type CampusMintFeedProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  mintz: MintzState;
  organizations: OrganizationsState;
  eventMoments: EventMomentsState;
  events: Event[];
  directMint: DirectMintState;
  onCreateStory: (story: Story) => void;
  onOpenProfile: (userId: string) => void;
  onMessageUser: (userId: string) => void;
  onRequestOrganization: (
    organizationId: string,
  ) => void;
  onFeedChromeChange?: (hidden: boolean) => void;
  onRefresh?: () => void;
  reducedMotion?: boolean;
  autoplayVideo?: boolean;
  surfaceActive?: boolean;
};

export function CampusMintFeed({
  viewer,
  theme,
  profiles,
  mintz,
  organizations,
  eventMoments,
  events,
  directMint,
  onCreateStory,
  onOpenProfile,
  onMessageUser,
  onRequestOrganization,
  onFeedChromeChange,
  onRefresh,
  reducedMotion,
  autoplayVideo,
  surfaceActive = true,
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
        areDevelopmentFixturesEnabled() ? developmentOrganizations : [],
      eventDirectory: events,
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
      events,
      organizations.followedOrganizationIds,
      organizations.memberships,
      profiles.blocks,
      profiles.follows,
      profiles.friendships,
      profiles.users,
      viewer,
    ],
  );
  const messageAffinityByUserId = Object.fromEntries(
    profiles.users.map((user) => [user.account.id, directMint.messagesFor(user.account.id).length]),
  );

  const visibleMintz = useMemo(() => {
    return rankNormalMintFeed(allMintz, feedState);
  }, [allMintz, feedState]);

  const [feedGeneration, setFeedGeneration] = useState(() => createFeedGeneration({
    eligibleMintz: visibleMintz,
    previousEligibleMintIds: null,
    pins: mintz.pins,
    viewerId: viewer.account.id,
    dwell: mintz.dwellRecords,
    privateAppreciations: mintz.privateAppreciations,
    publicEndorsements: mintz.publicEndorsements,
    generationId: 0,
    now: new Date(mintz.currentTime).toISOString(),
  }));
  const feedScope = `${viewer.account.id}:${viewer.account.universityIdentityId ?? viewer.account.universityId}`;
  const [generationCursor, setGenerationCursor] = useState(() => ({
    feedScope,
    refreshGeneration: mintz.refreshGeneration,
  }));
  if (
    generationCursor.feedScope !== feedScope ||
    generationCursor.refreshGeneration !== mintz.refreshGeneration
  ) {
    const sameViewerScope = generationCursor.feedScope === feedScope;
    setGenerationCursor({ feedScope, refreshGeneration: mintz.refreshGeneration });
    setFeedGeneration(createFeedGeneration({
      eligibleMintz: visibleMintz,
      previousEligibleMintIds: sameViewerScope ? feedGeneration.eligibleMintIds : null,
      pins: mintz.pins,
      viewerId: viewer.account.id,
      dwell: mintz.dwellRecords,
      privateAppreciations: mintz.privateAppreciations,
      publicEndorsements: mintz.publicEndorsements,
      generationId: sameViewerScope ? feedGeneration.id + 1 : 0,
      now: new Date().toISOString(),
    }));
  }

  const renderedGeneration = useMemo(
    () => applyCurrentPinsToGeneration(feedGeneration, mintz.pins, viewer.account.id),
    [feedGeneration, mintz.pins, viewer.account.id],
  );
  const generatedMintz = useMemo(() => {
    const byId = new Map(visibleMintz.map((mint) => [mint.id, mint]));
    return flattenFeedGeneration(renderedGeneration).flatMap((id) => {
      const mint = byId.get(id);
      return mint ? [mint] : [];
    });
  }, [renderedGeneration, visibleMintz]);

  const refreshFeedGeneration = useCallback(() => {
    if (onRefresh) onRefresh();
    else mintz.refreshMintz();
  }, [mintz, onRefresh]);

  const rankedVideoMintz = useMemo(
    () => generatedMintz.filter((mint) => mint.media.some((media) => media.type === "video")),
    [generatedMintz],
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
        mints={generatedMintz}
        generation={renderedGeneration}
        viewer={viewer}
        theme={theme}
        profiles={profiles}
        mintz={mintz}
        eventMoments={eventMoments}
        messageAffinityByUserId={messageAffinityByUserId}
        organizations={organizations}
        feedState={feedState}
        onOpenProfile={onOpenProfile}
        onMessageUser={onMessageUser}
        onRequestOrganization={
          onRequestOrganization
        }
        onNotice={setNotice}
        onFeedChromeChange={
          onFeedChromeChange
        }
        onRefresh={refreshFeedGeneration}
        reducedMotion={reducedMotion}
        autoplayVideo={autoplayVideo}
        surfaceActive={surfaceActive}
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
          eventMoments={eventMoments}
          messageAffinityByUserId={messageAffinityByUserId}
          onOpenProfile={onOpenProfile}
          onMessageUser={onMessageUser}
          autoplayVideo={autoplayVideo}
          reducedMotion={reducedMotion}
          suspended={!surfaceActive}
          onClose={closeVideoViewer}
          onRefresh={refreshFeedGeneration}
        />
      )}
    </div>
  );
}
