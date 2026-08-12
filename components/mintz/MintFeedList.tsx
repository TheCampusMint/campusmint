"use client";

import {
  useEffect,
  useRef,
  useState,
  type TouchEvent,
  type UIEvent,
} from "react";

import { MintCard } from "@/components/mintz/MintCard";
import { getOrganizationById } from "@/data/organizations";
import type { UniversityTheme } from "@/data/universities";
import type { MintzState } from "@/hooks/useMintz";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import type { ProfilesState } from "@/hooks/useProfiles";
import { canJoinOrganization } from "@/lib/organizationPermissions";
import {
  createMintPermissionContext,
  type MintFeedState,
} from "@/lib/social/mintFeeds";
import type { Mint } from "@/types/mint";
import type { CampusMintUser } from "@/types/profile";

type MintFeedListProps = {
  mints: Mint[];
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  mintz: MintzState;
  organizations: OrganizationsState;
  feedState: MintFeedState;
  onOpenProfile: (userId: string) => void;
  onRequestOrganization: (
    organizationId: string,
  ) => void;
  onNotice: (message: string) => void;
  onFeedChromeChange?: (hidden: boolean) => void;
  onRefresh?: () => void;
  reducedMotion?: boolean;
  autoplayVideo?: boolean;
};

export function MintFeedList({
  mints,
  viewer,
  theme,
  profiles,
  mintz,
  organizations,
  feedState,
  onOpenProfile,
  onRequestOrganization,
  onNotice,
  onFeedChromeChange,
  onRefresh,
  reducedMotion,
  autoplayVideo,
}: MintFeedListProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const pullStartRef = useRef<number | null>(null);
  const refreshHoldTimerRef = useRef<number | null>(null);
  const refreshArmedRef = useRef(false);
  const chromeHiddenRef = useRef(false);

  const [pullDistance, setPullDistance] =
    useState(0);

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

    // Refresh is only available when the actual page is
    // already back at the very top.
    if (window.scrollY > 2) {
      pullStartRef.current = null;
      return;
    }

    pullStartRef.current =
      event.touches[0].clientY;

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
      wasArmed &&
      pullDistance >= 62;

    if (wasArmed) {
      event?.stopPropagation();
    }

    refreshArmedRef.current = false;
    pullStartRef.current = null;
    setPullDistance(0);

    if (shouldRefresh) {
      onRefresh?.();
    }
  }

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

            return (
              <div
                key={item.id}
                className="flex snap-start snap-always items-start"
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
                    liked={mintz.likes.some(
                      (like) =>
                        like.mintId === item.id &&
                        like.userId ===
                          viewer.account.id,
                    )}
                    saved={mintz.saves.some(
                      (save) =>
                        save.mintId === item.id &&
                        save.userId ===
                          viewer.account.id,
                    )}
                    reposted={mintz.reposts.some(
                      (repost) =>
                        repost.mintId === item.id &&
                        repost.userId ===
                          viewer.account.id,
                    )}
                    comments={mintz.comments.filter(
                      (comment) =>
                        comment.targetId ===
                        item.id,
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
                    onOrganizationMembershipAction={
                      organizationAction
                    }
                    onOpenProfile={
                      onOpenProfile
                    }
                    onToggleLike={() =>
                      mintz.toggleLike(
                        permissionContext,
                      )
                    }
                    onToggleSave={() =>
                      mintz.toggleSave(
                        permissionContext,
                      )
                    }
                    onToggleRepost={() =>
                      mintz.toggleRepost(
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
      </div>
    </div>
  );
}
