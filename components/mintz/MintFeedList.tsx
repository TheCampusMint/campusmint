"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type TouchEvent,
  type UIEvent,
} from "react";

import { MintCard } from "@/components/mintz/MintCard";
import { useCampusPreview } from "@/components/developer/CampusPreviewContext";
import { getOrganizationById } from "@/data/organizations";
import type { UniversityTheme } from "@/data/universities";
import type { MintzState } from "@/hooks/useMintz";
import type { EventMomentsState } from "@/hooks/useEventMoments";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import type { ProfilesState } from "@/hooks/useProfiles";
import { canJoinOrganization } from "@/lib/organizationPermissions";
import {
  createMintPermissionContext,
  type MintFeedState,
} from "@/lib/social/mintFeeds";
import {
  getCreatorAppreciationMetrics,
  getPublicEndorsementContext,
} from "@/lib/social/mintInteractions";
import type { Mint } from "@/types/mint";
import type { CampusMintUser } from "@/types/profile";
import { FEED_REFRESH_THRESHOLD_PX, type MintFeedGeneration } from "@/lib/social/feedGeneration";
import { rankRelevantEventAttendees } from "@/lib/events/attendingContext";
import { sampleEvents } from "@/data/events";

type MintFeedListProps = {
  mints: Mint[];
  generation?: MintFeedGeneration;
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  mintz: MintzState;
  eventMoments?: EventMomentsState;
  messageAffinityByUserId?: Readonly<Record<string, number>>;
  organizations: OrganizationsState;
  feedState: MintFeedState;
  onOpenProfile: (userId: string) => void;
  onMessageUser?: (userId: string) => void;
  onRequestOrganization: (
    organizationId: string,
  ) => void;
  onNotice: (message: string) => void;
  onFeedChromeChange?: (hidden: boolean) => void;
  onRefresh?: () => void;
  reducedMotion?: boolean;
  autoplayVideo?: boolean;
  onOpenVideo?: (mintId: string, mediaId: string) => void;
  surfaceActive?: boolean;
};

export function MintFeedList({
  mints,
  generation,
  viewer,
  theme,
  profiles,
  mintz,
  eventMoments,
  messageAffinityByUserId,
  organizations,
  feedState,
  onOpenProfile,
  onMessageUser,
  onRequestOrganization,
  onNotice,
  onFeedChromeChange,
  onRefresh,
  reducedMotion,
  autoplayVideo,
  onOpenVideo,
  surfaceActive = true,
}: MintFeedListProps) {
  const readOnly = useCampusPreview();
  const feedRef = useRef<HTMLDivElement>(null);
  const pullStartRef = useRef<number | null>(null);
  const pullModeRef = useRef<"top" | "bottom" | null>(null);
  const refreshHoldTimerRef = useRef<number | null>(null);
  const refreshArmedRef = useRef(false);
  const chromeHiddenRef = useRef(false);
  const dwellStartsRef = useRef(new Map<string, number>());
  const dwellVisibleRef = useRef(new Set<string>());
  const recordDwellRef = useRef(mintz.recordMeaningfulDwell);

  const [pullDistance, setPullDistance] =
    useState(0);

  useEffect(() => {
    recordDwellRef.current = mintz.recordMeaningfulDwell;
  });

  useEffect(() => {
    if (readOnly || !surfaceActive || typeof IntersectionObserver === "undefined") return;
    const root = feedRef.current;
    if (!root) return;
    const dwellStarts = dwellStartsRef.current;
    const dwellVisible = dwellVisibleRef.current;
    const flush = (mintId: string) => {
      const started = dwellStarts.get(mintId);
      if (started === undefined) return;
      dwellStarts.delete(mintId);
      recordDwellRef.current(mintId, performance.now() - started, surfaceActive);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const mintId = (entry.target as HTMLElement).dataset.dwellMintId;
        if (!mintId) continue;
        const meaningful = entry.isIntersecting && entry.intersectionRatio >= 0.6;
        if (meaningful) dwellVisible.add(mintId);
        else dwellVisible.delete(mintId);
        if (meaningful && document.visibilityState === "visible") {
          if (!dwellStarts.has(mintId)) dwellStarts.set(mintId, performance.now());
        } else flush(mintId);
      }
    }, { threshold: [0, 0.6, 1] });
    root.querySelectorAll<HTMLElement>("[data-dwell-mint-id]").forEach((element) => observer.observe(element));
    const visibilityChanged = () => {
      if (document.visibilityState === "hidden") {
        [...dwellStarts.keys()].forEach(flush);
      } else {
        dwellVisible.forEach((mintId) => dwellStarts.set(mintId, performance.now()));
      }
    };
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibilityChanged);
      [...dwellStarts.keys()].forEach(flush);
      dwellVisible.clear();
    };
  }, [mints, surfaceActive, readOnly]);

  function clearRefreshHoldTimer() {
    if (refreshHoldTimerRef.current === null) return;

    window.clearTimeout(refreshHoldTimerRef.current);
    refreshHoldTimerRef.current = null;
  }

  useEffect(() => {
    onFeedChromeChange?.(false);

    return () => {
      clearRefreshHoldTimer();
      onFeedChromeChange?.(false);
    };
  }, [onFeedChromeChange]);

  function updateChrome(hidden: boolean) {
    if (chromeHiddenRef.current === hidden) return;

    chromeHiddenRef.current = hidden;
    onFeedChromeChange?.(hidden);
  }

  function handleScroll(
    event: UIEvent<HTMLDivElement>,
  ) {
    const scrollTop =
      event.currentTarget.scrollTop;

    updateChrome(scrollTop > 2);
  }

  function handleTouchStart(
    event: TouchEvent<HTMLDivElement>,
  ) {
    clearRefreshHoldTimer();
    refreshArmedRef.current = false;
    pullModeRef.current = null;
    setPullDistance(0);

    if (event.touches.length !== 1) {
      pullStartRef.current = null;
      return;
    }

    const target = event.target as HTMLElement;

    if (target.closest("[data-mint-carousel]")) {
      pullStartRef.current = null;
      return;
    }

    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3;
    if (atBottom) {
      pullModeRef.current = "bottom";
      pullStartRef.current = event.touches[0].clientY;
      return;
    }

    // Refresh is only available when the actual page is
    // already back at the very top.
    if (window.scrollY > 2) {
      pullStartRef.current = null;
      return;
    }

    pullStartRef.current =
      event.touches[0].clientY;
    pullModeRef.current = "top";

    // A normal immediate downward swipe is Search.
    // Holding first arms pull-to-refresh instead.
    refreshHoldTimerRef.current =
      window.setTimeout(() => {
        refreshHoldTimerRef.current = null;
        refreshArmedRef.current = true;

        // Tiny visual acknowledgement that refresh is armed.
        setPullDistance(8);
      }, 360);
  }

  function handleTouchMove(
    event: TouchEvent<HTMLDivElement>,
  ) {
    if (
      pullStartRef.current === null ||
      event.touches.length !== 1
    ) {
      return;
    }

    const delta =
      event.touches[0].clientY -
      pullStartRef.current;

    if (pullModeRef.current === "bottom") {
      const upwardDistance = -delta;
      if (upwardDistance <= 0) return;
      event.stopPropagation();
      event.preventDefault();
      setPullDistance(Math.min(96, upwardDistance * 0.5));
      return;
    }

    // Movement before the hold finishes means this is the
    // quick pull-down Search gesture, not refresh.
    if (!refreshArmedRef.current) {
      if (Math.abs(delta) > 12) {
        clearRefreshHoldTimer();
      }

      return;
    }

    // Once armed, Mint owns the gesture so Search does not
    // also fire when the finger is released.
    event.stopPropagation();

    if (window.scrollY > 2 || delta <= 0) {
      setPullDistance(8);
      return;
    }

    const eased = Math.min(
      92,
      8 + delta * 0.46,
    );

    setPullDistance(eased);

    if (eased > 8) {
      event.preventDefault();
    }
  }

  function finishPull(
    event?: TouchEvent<HTMLDivElement>,
  ) {
    clearRefreshHoldTimer();

    const wasArmed =
      refreshArmedRef.current;

    const shouldRefresh =
      (pullModeRef.current === "bottom" && pullDistance >= FEED_REFRESH_THRESHOLD_PX) ||
      (wasArmed && pullDistance >= FEED_REFRESH_THRESHOLD_PX);

    if (wasArmed) {
      event?.stopPropagation();
    }

    refreshArmedRef.current = false;
    pullStartRef.current = null;
    pullModeRef.current = null;
    setPullDistance(0);

    if (shouldRefresh) {
      onRefresh?.();
    }
  }

  const firstPinnedId = generation?.pinnedMintIds[0] ?? null;
  const firstOldId = generation?.oldMintIds[0] ?? null;
  const hasOldPosts = Boolean(generation?.oldMintIds.length);

  return (
    <div
      ref={feedRef}
      className="relative touch-pan-y overflow-y-visible overscroll-y-contain scroll-smooth"
      style={{
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
      data-mint-snap-feed
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={finishPull}
      onTouchCancel={finishPull}
    >
      <div
        className="pointer-events-none sticky top-0 z-40 flex h-0 justify-center overflow-visible"
        aria-hidden="true"
      >
        <div
          className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-lg text-slate-700 shadow-md backdrop-blur"
          style={{
            opacity: Math.min(
              1,
              pullDistance / 30,
            ),
            transform:
              `translate3d(0, ${Math.max(
                -42,
                pullDistance - 42,
              )}px, 0) rotate(${pullDistance * 3.4}deg) scale(${0.72 + Math.min(0.28, pullDistance / 180)})`,
            transition:
              pullDistance > 0
                ? "none"
                : "transform 220ms cubic-bezier(.22,1,.36,1), opacity 180ms ease",
          }}
        >
          ⚙︎
        </div>
      </div>

      <div
        style={{
          transform:
            `translate3d(0, ${pullDistance * 0.34}px, 0)`,
          transition:
            pullDistance > 0
              ? "none"
              : "transform 260ms cubic-bezier(.22,1,.36,1)",
        }}
      >
        {mints.length > 0 ? (
          mints.map((item) => {
            const author =
              feedState.users.find(
                (user) =>
                  user.account.id ===
                  item.authorId,
              );

            if (!author) return null;

            const permissionContext =
              createMintPermissionContext(
                item,
                author,
                feedState,
              );

            const organization =
              getOrganizationById(
                item.organizationId,
              );

            const organizationStatus =
              organization
                ? organizations.getMembershipStatus(
                    organization.id,
                  )
                : undefined;

            const organizationAction =
              organization &&
              canJoinOrganization(
                {
                  role: viewer.account.role,
                  universityId:
                    viewer.account.universityId,
                },
                organization,
              ) &&
              (organizationStatus === "none" ||
                organizationStatus ===
                  "rejected")
                ? () =>
                    onRequestOrganization(
                      organization.id,
                    )
                : undefined;

            const endorsementContext = getPublicEndorsementContext({
              mintId: item.id,
              viewerId: viewer.account.id,
              endorsements: mintz.publicEndorsements,
              friendships: profiles.friendships,
              follows: profiles.follows,
              blocks: profiles.blocks,
              eligibleUserIds: profiles.users.map((user) => user.account.id),
            });
            const friendEndorsementUsers = endorsementContext.userIds.flatMap(
              (userId) => {
                const user = profiles.users.find(
                  (candidate) => candidate.account.id === userId,
                );
                return user ? [user] : [];
              },
            );
            const creatorMetrics = getCreatorAppreciationMetrics({
              mintId: item.id,
              authorId: item.authorId,
              viewerId: viewer.account.id,
              privateAppreciations: mintz.privateAppreciations,
              publicEndorsements: mintz.publicEndorsements,
              legacyAggregate: item.likeCount,
              viewCount: item.viewCount,
              commentCount: item.commentCount,
            });
            const event = item.eventData?.eventId ? sampleEvents.find((candidate) => candidate.id === item.eventData?.eventId) ?? null : null;
            const attendingUserIds = event ? (eventMoments?.rsvps ?? []).filter((rsvp) => rsvp.eventId === event.id && rsvp.status === "attending").map((rsvp) => rsvp.userId) : [];
            const attendeeUsers = event ? rankRelevantEventAttendees({ viewer, candidates: profiles.users, attendingUserIds, friendships: profiles.friendships, follows: profiles.follows, blocks: profiles.blocks, messageAffinityByUserId }).map((item) => item.user) : [];
            const viewerAttending = event ? eventMoments?.isAttending(event.id, viewer.account.id) ?? false : false;
            const eventEnded = event ? new Date(event.eventEndAt ?? event.eventStartAt).getTime() <= mintz.currentTime || event.status === "cancelled" : false;

            return (
              <Fragment key={item.id}>
              {item.id === firstPinnedId && <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Pinned</p>}
              {generation?.refreshed && item.id === firstOldId && <div className="py-5 text-center"><div aria-label="You're all caught up" className="text-sm font-black text-slate-700"><span aria-hidden="true">✓</span><span className="ml-2">You&apos;re all caught up</span></div><p className="mt-4 px-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Old posts</p></div>}
              <div
                className="flex snap-start snap-always items-start"
                data-dwell-mint-id={item.id}
                style={{
                  scrollSnapStop: "always",
                }}
              >
                <div className="w-full">
                  <MintCard
                    mint={item}
                    author={author}
                    viewer={viewer}
                    users={profiles.users.map(
                      (user) =>
                        user.account.id ===
                        viewer.account.id
                          ? viewer
                          : user,
                    )}
                    theme={theme}
                    currentTime={
                      mintz.currentTime
                    }
                    permissionContext={
                      permissionContext
                    }
                    privateAppreciated={mintz.privateAppreciations.some(
                      (appreciation) => appreciation.mintId === item.id && appreciation.userId === viewer.account.id,
                    )}
                    publiclyEndorsed={mintz.publicEndorsements.some(
                      (endorsement) => endorsement.mintId === item.id && endorsement.userId === viewer.account.id,
                    )}
                    friendEndorsementUsers={friendEndorsementUsers}
                    additionalFriendEndorsementCount={endorsementContext.additionalCount}
                    creatorAppreciationCount={creatorMetrics?.appreciationCount ?? null}
                    attendeeUsers={attendeeUsers}
                    attendeeCount={event ? event.rsvpCount + attendingUserIds.length : null}
                    attending={viewerAttending}
                    attendingDisabled={eventEnded}
                    onToggleAttending={event && !eventEnded && eventMoments ? () => eventMoments.toggleRsvp(event, viewer.account.id) : undefined}
                    pinned={mintz.pins.some(
                      (pin) =>
                        pin.mintId === item.id &&
                        pin.userId ===
                          viewer.account.id,
                    )}
                    comments={mintz.comments.filter(
                      (comment) =>
                        comment.targetId ===
                        item.id,
                    )}
                    likedCommentIds={mintz.commentLikes
                      .filter((like) => like.userId === viewer.account.id)
                      .map((like) => like.commentId)}
                    repostedCommentIds={mintz.commentReposts
                      .filter((repost) => repost.userId === viewer.account.id)
                      .map((repost) => repost.commentId)}
                    hiddenCommentIds={mintz.hiddenCommentIds}
                    blockedCommentAuthorIds={profiles.blocks.flatMap((block) =>
                      block.blockerId === viewer.account.id
                        ? [block.blockedId]
                        : block.blockedId === viewer.account.id
                          ? [block.blockerId]
                          : [],
                    )}
                    organizationMembershipStatus={
                      organizationStatus
                    }
                    reducedMotion={
                      reducedMotion
                    }
                    autoplayVideo={
                      autoplayVideo
                    }
                    onOpenVideo={onOpenVideo}
                    surfaceActive={surfaceActive}
                    onOrganizationMembershipAction={
                      organizationAction
                    }
                    onOpenProfile={
                      onOpenProfile
                    }
                    onMessageUser={onMessageUser ?? onOpenProfile}
                    onPrivateAppreciation={() =>
                      mintz.registerPrivateAppreciation(
                        permissionContext,
                      )
                    }
                    onTogglePublicEndorsement={() =>
                      mintz.togglePublicEndorsement(permissionContext)
                    }
                    onTogglePin={() =>
                      mintz.togglePin(
                        permissionContext,
                      )
                    }
                    onShare={(channel) => {
                      mintz.recordShare(
                        permissionContext,
                        channel,
                      );

                      onNotice(
                        "Share action recorded locally. No external message was sent.",
                      );
                    }}
                    onComment={(body) =>
                      mintz.addComment(
                        permissionContext,
                        body,
                      )
                    }
                    onToggleCommentLike={(commentId) =>
                      mintz.toggleCommentLike(permissionContext, commentId)
                    }
                    onToggleCommentRepost={(commentId) =>
                      mintz.toggleCommentRepost(permissionContext, commentId)
                    }
                    onHideComment={mintz.hideComment}
                    onDeleteComment={(
                      commentId,
                    ) =>
                      mintz.deleteOwnComment(
                        commentId,
                        viewer.account.id,
                      )
                    }
                    onReportComment={(
                      commentId,
                    ) => {
                      mintz.reportComment(
                        permissionContext,
                        commentId,
                      );

                      onNotice(
                        "Comment report saved locally for development testing.",
                      );
                    }}
                    onUpdate={(patch) =>
                      mintz.updateOwnMint(
                        item.id,
                        viewer.account.id,
                        patch,
                      )
                    }
                    onArchive={() =>
                      mintz.toggleArchive(
                        item.id,
                        viewer.account.id,
                      )
                    }
                    onDelete={() =>
                      mintz.deleteOwnMint(
                        item.id,
                        viewer.account.id,
                      )
                    }
                    onReport={(reason) => {
                      mintz.reportMint(
                        permissionContext,
                        reason,
                        null,
                      );

                      onNotice(
                        "Report saved locally for development testing.",
                      );
                    }}
                  />
                </div>
              </div>
              </Fragment>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h3 className="font-bold text-slate-900">
              No visible Mintz
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              This feed has no active content you
              are permitted to view.
            </p>
          </div>
        )}
        {mints.length > 0 && generation?.refreshed && !hasOldPosts && <div className="px-5 py-9 text-center"><div aria-label="You're all caught up" className="text-sm font-black text-slate-700"><span aria-hidden="true">✓</span><span className="ml-2">You&apos;re all caught up</span></div></div>}
        {mints.length > 0 && <div className="px-5 pb-24 pt-8 text-center" data-feed-end-state><p className="text-sm font-black text-slate-700">You&apos;re all caught up</p><p className="mt-1 text-xs text-slate-400">{pullDistance >= FEED_REFRESH_THRESHOLD_PX ? "Release to refresh" : pullDistance > 0 ? "Pull up to refresh" : "Pull up to refresh"}</p><button type="button" onClick={onRefresh} className="mt-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600">Refresh feed</button></div>}
      </div>
    </div>
  );
}
