"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";

import { EventAttendingContext } from "@/components/events/EventAttendingContext";
import {
  CommentAction,
  CompactMetric,
  FriendEndorsementStack,
  PublicEndorsementAction,
  ShareAction,
} from "@/components/mintz/MintSocialActions";
import { MintCommentsSheet } from "@/components/mintz/MintCommentsSheet";
import {
  PrivateAppreciationBurst,
  type ScreenPoint,
} from "@/components/mintz/PrivateAppreciationBurst";
import {
  getAccountUniversityDisplayTheme,
  getAccountUniversityShortName,
} from "@/data/universities";
import type { MintzState } from "@/hooks/useMintz";
import type { EventMomentsState } from "@/hooks/useEventMoments";
import { useModalLayer } from "@/hooks/useModalLayer";
import { motion, resolveGestureAxis, type FloatingSurfaceOrigin } from "@/lib/motion/interaction";
import {
  getPublicEndorsementContext,
  resolvePublicMintMetrics,
} from "@/lib/social/mintInteractions";
import {
  createMintPermissionContext,
  type MintFeedState,
} from "@/lib/social/mintFeeds";
import { resolveVideoViewerGesture } from "@/lib/social/videoViewerState";
import { rankRelevantEventAttendees } from "@/lib/events/attendingContext";
import { sampleEvents } from "@/data/events";
import type { Mint, MintMedia, MintShare } from "@/types/mint";
import type { CampusMintUser } from "@/types/profile";

type VideoEntry = {
  mint: Mint;
  media: MintMedia;
  author: CampusMintUser;
};

type FullscreenVideoViewerProps = {
  mints: Mint[];
  initialMintId: string;
  initialMediaId: string;
  feedState: MintFeedState;
  mintz: MintzState;
  eventMoments: EventMomentsState;
  messageAffinityByUserId?: Readonly<Record<string, number>>;
  autoplayVideo?: boolean;
  reducedMotion?: boolean;
  onOpenProfile: (userId: string) => void;
  onMessageUser: (userId: string) => void;
  onClose: () => void;
  suspended?: boolean;
};

type HorizontalDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  axis: "pending" | "horizontal" | "vertical";
  velocityX: number;
  velocityY: number;
};

function ViewerVideo({
  entry,
  active,
  autoplayVideo,
}: {
  entry: VideoEntry;
  active: boolean;
  autoplayVideo: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const authorTheme = getAccountUniversityDisplayTheme(entry.author.account);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!active) {
      video.pause();
      return;
    }
    if (autoplayVideo) {
      video.play().catch(() => {
        // Native controls remain available when autoplay is blocked.
      });
    }
  }, [active, autoplayVideo]);

  if (!entry.media.url) {
    return (
      <div className="flex h-full w-full items-center justify-center px-8 text-center text-white" style={{ background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${authorTheme.secondary} 24%, transparent), transparent 32%), linear-gradient(155deg, ${authorTheme.primary}, #020617 72%)` }}>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-white/55">Development video placeholder</p>
          <p className="mt-3 max-w-md text-xl font-black leading-tight">{entry.mint.caption || "Video Mint"}</p>
        </div>
      </div>
    );
  }

  return <video ref={videoRef} src={entry.media.url} poster={entry.media.thumbnailUrl ?? undefined} controls playsInline loop muted={autoplayVideo} preload={active ? "auto" : "metadata"} className="h-full w-full bg-black object-contain" />;
}

export function FullscreenVideoViewer({
  mints,
  initialMintId,
  initialMediaId,
  feedState,
  mintz,
  eventMoments,
  messageAffinityByUserId,
  autoplayVideo = true,
  reducedMotion = false,
  onOpenProfile,
  onMessageUser,
  onClose,
  suspended = false,
}: FullscreenVideoViewerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const tapRef = useRef<{ x: number; y: number; time: number; moved: boolean } | null>(null);
  const lastTapRef = useRef(0);
  const dragRef = useRef<HorizontalDrag | null>(null);
  const [closing, setClosing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [appreciationBurst, setAppreciationBurst] = useState<{
    point: ScreenPoint;
    sequence: number;
  } | null>(null);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(onClose, reducedMotion ? 0 : motion.duration.fast);
  }, [closing, onClose, reducedMotion]);

  useModalLayer(dialogRef, requestClose);

  const selectedEntry = useMemo<VideoEntry | null>(() => {
    const mint = mints.find((candidate) => candidate.id === initialMintId);
    const media = mint?.media.find((candidate) => candidate.id === initialMediaId && candidate.type === "video");
    const author = mint ? feedState.users.find((candidate) => candidate.account.id === mint.authorId) : null;
    return mint && media && author ? { mint, media, author } : null;
  }, [feedState.users, initialMediaId, initialMintId, mints]);
  const [commentsEntry, setCommentsEntry] = useState<VideoEntry | null>(null);
  const [commentsOrigin, setCommentsOrigin] = useState<FloatingSurfaceOrigin | null>(null);
  const activeDwellRef = useRef<{ mintId: string; startedAt: number } | null>(null);
  const recordDwellRef = useRef(mintz.recordMeaningfulDwell);

  useEffect(() => {
    recordDwellRef.current = mintz.recordMeaningfulDwell;
  });

  useEffect(() => {
    const entry = selectedEntry;
    if (!entry || suspended || document.visibilityState !== "visible") return;
    activeDwellRef.current = { mintId: entry.mint.id, startedAt: performance.now() };
    const flush = () => {
      const active = activeDwellRef.current;
      if (!active) return;
      activeDwellRef.current = null;
      recordDwellRef.current(active.mintId, performance.now() - active.startedAt, !suspended);
    };
    const visibilityChanged = () => {
      if (document.visibilityState === "hidden") flush();
      else activeDwellRef.current = { mintId: entry.mint.id, startedAt: performance.now() };
    };
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      document.removeEventListener("visibilitychange", visibilityChanged);
      flush();
    };
  }, [selectedEntry, suspended]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  async function shareEntry(entry: VideoEntry, channel: MintShare["channel"] = "copy_link") {
    const context = createMintPermissionContext(entry.mint, entry.author, feedState);
    const url = `${window.location.origin}/mint/${entry.mint.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "The Campus Mint", text: entry.mint.caption || "Campus Mint video", url });
        mintz.recordShare(context, "external");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      mintz.recordShare(context, channel);
    } catch {
      window.prompt("Copy Mint link", url);
      mintz.recordShare(context, "copy_link");
    }
  }

  function confirmPrivateAppreciation(entry: VideoEntry, point: ScreenPoint) {
    const context = createMintPermissionContext(entry.mint, entry.author, feedState);
    mintz.registerPrivateAppreciation(context);
    setAppreciationBurst((current) => ({ point, sequence: (current?.sequence ?? 0) + 1 }));
  }

  function beginViewerGesture(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button,input,textarea,select,[data-video-gesture-control]")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      axis: "pending",
      velocityX: 0,
      velocityY: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateViewerGesture(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (drag.axis === "pending") {
      drag.axis = resolveGestureAxis(deltaX, deltaY, {
        threshold: 12,
        dominance: 1.35,
      });
      if (drag.axis !== "pending") setIsDragging(true);
    }
    const elapsed = Math.max(1, event.timeStamp - drag.lastTime);
    drag.velocityX = (event.clientX - drag.lastX) / elapsed;
    drag.velocityY = (event.clientY - drag.lastY) / elapsed;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    if (drag.axis === "horizontal") {
      event.preventDefault();
      setDragOffset({ x: deltaX < 0 ? deltaX * 0.86 : deltaX, y: 0 });
    } else if (drag.axis === "vertical") {
      event.preventDefault();
      setDragOffset({ x: 0, y: deltaY });
    }
  }

  function finishViewerGesture(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const result = resolveVideoViewerGesture({
      deltaX: event.clientX - drag.startX,
      deltaY: event.clientY - drag.startY,
      velocityX: drag.velocityX,
      velocityY: drag.velocityY,
      committed: true,
    });
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (result === "exit") {
      setIsDragging(false);
      setDragOffset(
        Math.abs(deltaY) > Math.abs(deltaX)
          ? { x: 0, y: Math.sign(deltaY || 1) * window.innerHeight }
          : { x: window.innerWidth, y: 0 },
      );
      window.setTimeout(requestClose, reducedMotion ? 0 : motion.duration.fast);
      return;
    }
    if (result === "creator") {
      setIsDragging(false);
      setDragOffset({ x: -window.innerWidth, y: 0 });
      window.setTimeout(() => {
        if (selectedEntry) onOpenProfile(selectedEntry.author.account.id);
      }, reducedMotion ? 0 : motion.duration.fast);
      return;
    }
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
  }

  function cancelViewerGesture(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.pointerId === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
  }

  if (!selectedEntry || suspended) return null;

  const entry = selectedEntry;
  const permissionContext = createMintPermissionContext(entry.mint, entry.author, feedState);
  const privatelyAppreciated = mintz.privateAppreciations.some((item) => item.mintId === entry.mint.id && item.userId === feedState.viewer.account.id);
  const publiclyEndorsed = mintz.publicEndorsements.some((item) => item.mintId === entry.mint.id && item.userId === feedState.viewer.account.id);
  const endorsementContext = getPublicEndorsementContext({
    mintId: entry.mint.id,
    viewerId: feedState.viewer.account.id,
    endorsements: mintz.publicEndorsements,
    friendships: feedState.friendships,
    follows: feedState.follows,
    blocks: feedState.blocks,
    eligibleUserIds: feedState.users.map((user) => user.account.id),
  });
  const friendUsers = endorsementContext.userIds.flatMap((userId) => {
    const user = feedState.users.find((candidate) => candidate.account.id === userId);
    return user ? [user] : [];
  });
  const metrics = resolvePublicMintMetrics({
    viewCount: entry.mint.viewCount,
    commentCount: entry.mint.commentCount,
    attendingCount: entry.mint.postType === "event" ? (() => {
      const eventId = entry.mint.eventData?.eventId;
      const candidate = sampleEvents.find((item) => item.id === eventId);
      return candidate ? candidate.rsvpCount + eventMoments.rsvps.filter((rsvp) => rsvp.eventId === candidate.id && rsvp.status === "attending").length : null;
    })() : null,
  });
  const event = entry.mint.eventData?.eventId ? sampleEvents.find((candidate) => candidate.id === entry.mint.eventData?.eventId) ?? null : null;
  const attendingIds = event ? eventMoments.rsvps.filter((rsvp) => rsvp.eventId === event.id && rsvp.status === "attending").map((rsvp) => rsvp.userId) : [];
  const attendingUsers = event ? rankRelevantEventAttendees({ viewer: feedState.viewer, candidates: feedState.users, attendingUserIds: attendingIds, friendships: feedState.friendships, follows: feedState.follows, blocks: feedState.blocks, messageAffinityByUserId }).map((item) => item.user) : [];
  const eventEnded = event ? new Date(event.eventEndAt ?? event.eventStartAt).getTime() <= mintz.currentTime || event.status === "cancelled" : false;

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      className={`cm-search-layer fixed inset-0 z-[100] bg-black text-white ${closing ? "is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Campus Mint video viewer"
      data-horizontal-gesture-ignore
      data-fullscreen-video-viewer
      data-reduced-motion={reducedMotion ? "true" : "false"}
      onPointerDown={beginViewerGesture}
      onPointerMove={updateViewerGesture}
      onPointerUp={finishViewerGesture}
      onPointerCancel={cancelViewerGesture}
      style={{
        transform: `translate3d(${dragOffset.x}px,${dragOffset.y}px,0)`,
        opacity: 1 - Math.min(0.24, Math.hypot(dragOffset.x, dragOffset.y) / Math.max(1, typeof window === "undefined" ? 1 : Math.min(window.innerWidth, window.innerHeight)) * 0.24),
        transition: isDragging || reducedMotion ? "none" : "transform 180ms cubic-bezier(.22,1,.36,1), opacity 180ms ease",
        touchAction: "none",
      }}
    >
      <button type="button" onClick={requestClose} data-initial-focus aria-label="Close video viewer" className="sr-only">Close video viewer</button>

      <section className="relative h-dvh overflow-hidden bg-black" aria-label={`Video by ${entry.author.profile.displayName}`}>
        <div
          className="absolute inset-0"
          onDoubleClick={(event) => {
            event.preventDefault();
            confirmPrivateAppreciation(entry, { clientX: event.clientX, clientY: event.clientY });
          }}
          onTouchStart={(event) => {
            if (event.touches.length !== 1) return;
            tapRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, time: Date.now(), moved: false };
          }}
          onTouchMove={(event) => {
            const tap = tapRef.current;
            if (!tap || event.touches.length !== 1) return;
            if (Math.hypot(event.touches[0].clientX - tap.x, event.touches[0].clientY - tap.y) > 10) tap.moved = true;
          }}
          onTouchEnd={() => {
            const tap = tapRef.current;
            tapRef.current = null;
            if (!tap || tap.moved || Date.now() - tap.time > 360) return;
            const now = Date.now();
            if (now - lastTapRef.current <= 320) {
              lastTapRef.current = 0;
              confirmPrivateAppreciation(entry, { clientX: tap.x, clientY: tap.y });
            } else lastTapRef.current = now;
          }}
        >
          <ViewerVideo entry={entry} active autoplayVideo={autoplayVideo} />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black via-black/50 to-transparent" />

        <div className="absolute bottom-[max(.7rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] z-10">
          <button type="button" onClick={() => onOpenProfile(entry.author.account.id)} className="max-w-full text-left focus-visible:outline-2 focus-visible:outline-white">
            <span className="block truncate text-sm font-black">@{entry.author.profile.username}</span>
            <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">{getAccountUniversityShortName(entry.author.account)}</span>
          </button>
          {entry.mint.caption && <p className="mt-2 line-clamp-3 max-w-xl text-sm leading-5 text-white/90">{entry.mint.caption}</p>}
          {entry.mint.music && <p className="mt-1 truncate text-xs text-white/70">♫ {entry.mint.music.trackTitle} · {entry.mint.music.artist}</p>}
          {event && <EventAttendingContext users={attendingUsers} attending={eventMoments.isAttending(event.id, feedState.viewer.account.id)} disabled={eventEnded} theme={getAccountUniversityDisplayTheme(entry.author.account)} onToggle={!eventEnded ? () => eventMoments.toggleRsvp(event, feedState.viewer.account.id) : undefined} />}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">{metrics.map((metric) => <CompactMetric key={metric.kind} label={metric.label} tone="dark" />)}</div>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <div className="flex items-center">
              <CommentAction count={entry.mint.commentCount} disabled={!entry.mint.commentsEnabled} onClick={(origin) => { setCommentsOrigin(origin); setCommentsEntry(entry); }} tone="dark" />
              <ShareAction onClick={() => void shareEntry(entry)} tone="dark" />
            </div>
            {entry.mint.postType !== "event" && <FriendEndorsementStack users={friendUsers} additionalCount={endorsementContext.additionalCount} theme={getAccountUniversityDisplayTheme(entry.author.account)} />}
            <button type="button" onClick={() => mintz.togglePin(permissionContext)} aria-pressed={mintz.pins.some((pin) => pin.mintId === entry.mint.id && pin.userId === feedState.viewer.account.id)} aria-label={mintz.pins.some((pin) => pin.mintId === entry.mint.id && pin.userId === feedState.viewer.account.id) ? "Unpin Mint" : "Pin Mint"} className="grid h-10 w-10 place-items-center text-white/90"><svg viewBox="0 0 24 24" className="h-5 w-5" fill={mintz.pins.some((pin) => pin.mintId === entry.mint.id && pin.userId === feedState.viewer.account.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m14 4 6 6-3 1-4 4-1 5-2-2-4-4 5-1 4-4-1-5Z" /><path d="m9 15-5 5" /></svg></button>
          </div>
        </div>

        <div className="absolute bottom-28 right-[max(.35rem,env(safe-area-inset-right))] z-20" data-video-gesture-control>
          <PublicEndorsementAction endorsed={publiclyEndorsed} onToggle={() => mintz.togglePublicEndorsement(permissionContext)} />
        </div>
        <button type="button" onClick={() => confirmPrivateAppreciation(entry, { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 })} aria-pressed={privatelyAppreciated} className="sr-only focus:not-sr-only focus:absolute focus:right-3 focus:top-3 focus:z-30 focus:px-3 focus:py-2 focus:text-xs focus:text-white">{privatelyAppreciated ? "Privately appreciated" : "Appreciate privately"}</button>
      </section>

      {appreciationBurst && <PrivateAppreciationBurst point={appreciationBurst.point} reducedMotion={reducedMotion} sequence={appreciationBurst.sequence} onComplete={() => setAppreciationBurst(null)} />}

      {commentsEntry && (() => {
        const permissionContext = createMintPermissionContext(commentsEntry.mint, commentsEntry.author, feedState);
        return (
          <MintCommentsSheet
            comments={mintz.comments.filter((comment) => comment.targetId === commentsEntry.mint.id && comment.status === "active")}
            users={feedState.users}
            viewer={feedState.viewer}
            theme={getAccountUniversityDisplayTheme(commentsEntry.author.account)}
            currentTime={mintz.currentTime}
            reducedMotion={reducedMotion}
            likedCommentIds={mintz.commentLikes.filter((like) => like.userId === feedState.viewer.account.id).map((like) => like.commentId)}
            repostedCommentIds={mintz.commentReposts.filter((repost) => repost.userId === feedState.viewer.account.id).map((repost) => repost.commentId)}
            hiddenCommentIds={mintz.hiddenCommentIds}
            blockedCommentAuthorIds={feedState.blocks.flatMap((block) => block.blockerId === feedState.viewer.account.id ? [block.blockedId] : block.blockedId === feedState.viewer.account.id ? [block.blockerId] : [])}
            origin={commentsOrigin}
            onComment={(body) => mintz.addComment(permissionContext, body)}
            onToggleCommentLike={(commentId) => mintz.toggleCommentLike(permissionContext, commentId)}
            onToggleCommentRepost={(commentId) => mintz.toggleCommentRepost(permissionContext, commentId)}
            onHideComment={mintz.hideComment}
            onDeleteComment={(commentId) => mintz.deleteOwnComment(commentId, feedState.viewer.account.id)}
            onReportComment={(commentId) => mintz.reportComment(permissionContext, commentId)}
            onOpenProfile={onOpenProfile}
            onMessageUser={onMessageUser}
            onClose={() => setCommentsEntry(null)}
            layerClassName="z-[120]"
          />
        );
      })()}
    </div>,
    document.body,
  );
}
