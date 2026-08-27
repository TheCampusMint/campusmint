"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import { createPortal } from "react-dom";

import { MintCommentsSheet } from "@/components/mintz/MintCommentsSheet";
import {
  getAccountUniversityDisplayTheme,
  getAccountUniversityShortName,
} from "@/data/universities";
import type { MintzState } from "@/hooks/useMintz";
import {
  createMintPermissionContext,
  type MintFeedState,
} from "@/lib/social/mintFeeds";
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
  autoplayVideo?: boolean;
  reducedMotion?: boolean;
  onClose: () => void;
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
        // Native controls remain available when browser autoplay policy blocks playback.
      });
    }
  }, [active, autoplayVideo]);

  if (!entry.media.url) {
    return (
      <div
        className="flex h-full w-full items-center justify-center px-8 text-center text-white"
        style={{
          background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${authorTheme.secondary} 24%, transparent), transparent 32%), linear-gradient(155deg, ${authorTheme.primary}, #020617 72%)`,
        }}
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-white/55">
            Development video placeholder
          </p>
          <p className="mt-3 max-w-md text-xl font-black leading-tight">
            {entry.mint.caption || "Video Mint"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={entry.media.url}
      poster={entry.media.thumbnailUrl ?? undefined}
      controls
      playsInline
      loop
      muted={autoplayVideo}
      preload={active ? "auto" : "metadata"}
      className="h-full w-full bg-black object-contain"
    />
  );
}

export function FullscreenVideoViewer({
  mints,
  initialMintId,
  initialMediaId,
  feedState,
  mintz,
  autoplayVideo = true,
  reducedMotion = false,
  onClose,
}: FullscreenVideoViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => {
    const usersById = new Map(
      feedState.users.map((user) => [user.account.id, user]),
    );

    return mints.flatMap((mint) => {
      const author = usersById.get(mint.authorId);
      if (!author) return [];

      return [...mint.media]
        .sort((first, second) => first.order - second.order)
        .filter((media) => media.type === "video")
        .map((media) => ({ mint, media, author }));
    });
  }, [feedState.users, mints]);

  const requestedIndex = Math.max(
    0,
    entries.findIndex(
      (entry) =>
        entry.mint.id === initialMintId &&
        entry.media.id === initialMediaId,
    ),
  );

  const [activeIndex, setActiveIndex] = useState(requestedIndex);
  const [commentsEntry, setCommentsEntry] = useState<VideoEntry | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container) return;

      container.scrollTo({
        top: requestedIndex * container.clientHeight,
        behavior: "auto",
      });
    });

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, requestedIndex]);

  function updateActiveVideo(event: UIEvent<HTMLDivElement>) {
    const height = event.currentTarget.clientHeight;
    if (!height) return;

    const nextIndex = Math.max(
      0,
      Math.min(
        entries.length - 1,
        Math.round(event.currentTarget.scrollTop / height),
      ),
    );

    if (nextIndex !== activeIndex) setActiveIndex(nextIndex);
  }

  async function shareEntry(
    entry: VideoEntry,
    channel: MintShare["channel"] = "copy_link",
  ) {
    const context = createMintPermissionContext(
      entry.mint,
      entry.author,
      feedState,
    );

    const url = `${window.location.origin}/mint/${entry.mint.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "The Campus Mint",
          text: entry.mint.caption || "Campus Mint video",
          url,
        });
        mintz.recordShare(context, channel);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      mintz.recordShare(context, "copy_link");
    } catch {
      window.prompt("Copy Mint link", url);
      mintz.recordShare(context, "copy_link");
    }
  }

  if (entries.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Campus Mint video viewer"
      data-horizontal-gesture-ignore
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close video viewer"
        className="interactive-pop fixed left-[max(0.85rem,env(safe-area-inset-left))] top-[max(0.85rem,env(safe-area-inset-top))] z-[115] flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-2xl font-light text-white shadow-lg backdrop-blur-md"
      >
        ×
      </button>

      <div
        ref={scrollRef}
        onScroll={updateActiveVideo}
        className="h-dvh snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
        style={{
          scrollBehavior: reducedMotion ? "auto" : "smooth",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {entries.map((entry, index) => {
          const permissionContext = createMintPermissionContext(
            entry.mint,
            entry.author,
            feedState,
          );

          const authorTheme = getAccountUniversityDisplayTheme(
            entry.author.account,
          );

          const liked = mintz.likes.some(
            (like) =>
              like.mintId === entry.mint.id &&
              like.userId === feedState.viewer.account.id,
          );

          const saved = mintz.saves.some(
            (save) =>
              save.mintId === entry.mint.id &&
              save.userId === feedState.viewer.account.id,
          );

          return (
            <section
              key={`${entry.mint.id}:${entry.media.id}`}
              className="relative h-dvh snap-start snap-always overflow-hidden bg-black"
              style={{
                boxShadow: `inset 0 0 0 2px ${authorTheme.primary}`,
                scrollSnapStop: "always",
              }}
              aria-label={`Video by ${entry.author.profile.displayName}`}
            >
              <div
                className="absolute inset-x-0 top-0 z-10 h-1"
                style={{
                  background: `linear-gradient(90deg, ${authorTheme.primary}, ${authorTheme.secondary})`,
                }}
                aria-hidden="true"
              />

              <ViewerVideo
                entry={entry}
                active={index === activeIndex}
                autoplayVideo={autoplayVideo}
              />

              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black via-black/45 to-transparent" />

              <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] right-20 z-10">
                <p className="text-sm font-black">
                  @{entry.author.profile.username}
                </p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/65">
                  {getAccountUniversityShortName(entry.author.account)}
                </p>
                {entry.mint.caption && (
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/90">
                    {entry.mint.caption}
                  </p>
                )}
              </div>

              <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-20 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => mintz.toggleLike(permissionContext)}
                  aria-pressed={liked}
                  aria-label={liked ? "Unlike video Mint" : "Like video Mint"}
                  className={`interactive-pop flex min-h-12 min-w-12 flex-col items-center justify-center text-xl font-black ${liked ? "text-rose-500" : "text-white"}`}
                >
                  {liked ? "♥" : "♡"}
                  <span className="text-[10px] text-white">{entry.mint.likeCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCommentsEntry(entry)}
                  aria-label="Open video Mint comments"
                  className="interactive-pop flex min-h-12 min-w-12 flex-col items-center justify-center text-xl font-black"
                >
                  ◯
                  <span className="text-[10px]">{entry.mint.commentCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => mintz.toggleSave(permissionContext)}
                  aria-pressed={saved}
                  aria-label={saved ? "Unsave video Mint" : "Save video Mint"}
                  className="interactive-pop flex min-h-12 min-w-12 items-center justify-center text-xl font-black"
                >
                  {saved ? "▰" : "▱"}
                </button>

                <button
                  type="button"
                  onClick={() => shareEntry(entry)}
                  aria-label="Share video Mint"
                  className="interactive-pop flex min-h-12 min-w-12 items-center justify-center text-xl font-black"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5 fill-none stroke-current"
                  >
                    <path
                      d="m8.2 10.5 6.9-4M8.2 13.5l6.9 4"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                    />
                    <circle cx="6" cy="12" r="2.35" strokeWidth="1.9" />
                    <circle cx="17.2" cy="5.3" r="2.35" strokeWidth="1.9" />
                    <circle cx="17.2" cy="18.7" r="2.35" strokeWidth="1.9" />
                  </svg>
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {commentsEntry && (() => {
        const permissionContext = createMintPermissionContext(
          commentsEntry.mint,
          commentsEntry.author,
          feedState,
        );

        return (
          <MintCommentsSheet
            comments={mintz.comments.filter(
              (comment) =>
                comment.targetId === commentsEntry.mint.id &&
                comment.status === "active",
            )}
            users={feedState.users}
            viewer={feedState.viewer}
            theme={getAccountUniversityDisplayTheme(commentsEntry.author.account)}
            currentTime={mintz.currentTime}
            reducedMotion={reducedMotion}
            onComment={(body) => mintz.addComment(permissionContext, body)}
            onDeleteComment={(commentId) =>
              mintz.deleteOwnComment(
                commentId,
                feedState.viewer.account.id,
              )
            }
            onReportComment={(commentId) =>
              mintz.reportComment(permissionContext, commentId)
            }
            onClose={() => setCommentsEntry(null)}
            layerClassName="z-[120]"
          />
        );
      })()}
    </div>,
    document.body,
  );
}
