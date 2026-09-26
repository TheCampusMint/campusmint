"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { CloseButton } from "@/components/ui/CloseButton";
import type { UniversityTheme } from "@/data/universities";
import { useDirectManipulation } from "@/hooks/useDirectManipulation";
import { useModalLayer } from "@/hooks/useModalLayer";
import {
  isEmojiOnlyComment,
  prepareLocalCommentAttachment,
  validateCommentAttachment,
} from "@/lib/content/commentMedia";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { FloatingSurfaceOrigin } from "@/lib/motion/interaction";
import {
  filterAndRankComments,
  shouldCommitCommentDoubleTap,
} from "@/lib/social/commentRanking";
import type {
  CommentAttachment,
  CommentFontStyle,
  CreateMintCommentInput,
  MintComment,
} from "@/types/mint";
import type { CampusMintUser } from "@/types/profile";

type AttachmentMode = "none" | "image" | "gif" | "video" | "sticker";

type MintCommentsSheetProps = {
  comments: MintComment[];
  users: CampusMintUser[];
  viewer: CampusMintUser;
  theme: UniversityTheme;
  currentTime: number;
  reducedMotion: boolean;
  likedCommentIds: readonly string[];
  repostedCommentIds: readonly string[];
  hiddenCommentIds: readonly string[];
  blockedCommentAuthorIds?: readonly string[];
  origin?: FloatingSurfaceOrigin | null;
  onComment: (input: CreateMintCommentInput) => void;
  onToggleCommentLike: (commentId: string) => void;
  onToggleCommentRepost: (commentId: string) => void;
  onHideComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onReportComment: (commentId: string) => void;
  onOpenProfile: (userId: string) => void;
  onMessageUser: (userId: string) => void;
  onClose: () => void;
  layerClassName?: string;
};

const stickerOptions = [
  { id: "mint-leaf", label: "Mint leaf", glyph: "🌿" },
  { id: "campus-cheer", label: "Campus cheer", glyph: "📣" },
  { id: "study-time", label: "Study time", glyph: "📚" },
] as const;

function fontClass(fontStyle: CommentFontStyle | undefined) {
  if (fontStyle === "serif") return "font-serif";
  if (fontStyle === "mono") return "font-mono";
  if (fontStyle === "bold") return "font-black";
  return "font-normal";
}

function CommentAttachmentView({ attachment }: { attachment: CommentAttachment }) {
  if (attachment.type === "sticker") {
    const sticker = stickerOptions.find((item) => item.id === attachment.stickerId);
    return (
      <span className="mt-2 block text-4xl" role="img" aria-label={attachment.label}>
        {sticker?.glyph ?? "🌿"}
      </span>
    );
  }

  if (attachment.type === "video") {
    return (
      <video
        src={attachment.url}
        poster={attachment.thumbnailUrl ?? undefined}
        controls
        playsInline
        preload="metadata"
        className="mt-2 max-h-56 w-full rounded-2xl bg-black object-contain"
      />
    );
  }

  return (
    // User-provided development URLs are not eligible for Next image optimization.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={attachment.url}
      alt={attachment.alt ?? (attachment.type === "gif" ? "Comment GIF" : "Comment image")}
      className="mt-2 max-h-56 max-w-full rounded-2xl object-contain"
    />
  );
}

export function MintCommentsSheet({
  comments,
  users,
  viewer,
  theme,
  currentTime,
  reducedMotion,
  likedCommentIds,
  repostedCommentIds,
  hiddenCommentIds,
  blockedCommentAuthorIds = [],
  origin = null,
  onComment,
  onToggleCommentLike,
  onToggleCommentRepost,
  onHideComment,
  onDeleteComment,
  onReportComment,
  onOpenProfile,
  onMessageUser,
  onClose,
  layerClassName = "z-[65]",
}: MintCommentsSheetProps) {
  const [body, setBody] = useState("");
  const [fontStyle, setFontStyle] = useState<CommentFontStyle>("normal");
  const [attachmentMode, setAttachmentMode] = useState<AttachmentMode>("none");
  const [preparedAttachment, setPreparedAttachment] =
    useState<CommentAttachment | null>(null);
  const [selectedAttachmentName, setSelectedAttachmentName] = useState("");
  const [stickerId, setStickerId] = useState<(typeof stickerOptions)[number]["id"]>(
    stickerOptions[0].id,
  );
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextCommentId, setContextCommentId] = useState<string | null>(null);
  const [likedPulseId, setLikedPulseId] = useState<string | null>(null);
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const statusTimer = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const commentsScrollRef = useRef<HTMLDivElement>(null);

  const visibleComments = useMemo(
    () =>
      filterAndRankComments(
        comments,
        currentTime,
        blockedCommentAuthorIds,
        hiddenCommentIds,
      ),
    [blockedCommentAuthorIds, comments, currentTime, hiddenCommentIds],
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimer.current = window.setTimeout(
      () => onCloseRef.current(),
      reducedMotion ? 0 : 190,
    );
  }, [reducedMotion]);

  const originX = typeof window === "undefined" || !origin
    ? "50%"
    : `${Math.max(0, Math.min(Math.min(576, window.innerWidth), origin.x - Math.max(0, (window.innerWidth - Math.min(576, window.innerWidth)) / 2)))}px`;

  const {
    surfaceRef,
    surfaceProps,
    style: directManipulationStyle,
  } = useDirectManipulation({
    allowedDirections: ["left", "right", "up", "down"],
    onDismiss: () => onCloseRef.current(),
    reducedMotion,
    scrollRef: commentsScrollRef,
  });

  useModalLayer(surfaceRef, requestClose);

  function createAttachment(): CommentAttachment | null {
    if (attachmentMode === "none") return null;
    if (attachmentMode === "sticker") {
      const sticker = stickerOptions.find((item) => item.id === stickerId) ?? stickerOptions[0];
      return { type: "sticker", stickerId: sticker.id, label: sticker.label };
    }
    return preparedAttachment;
  }

  async function selectAttachmentFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      const attachment = await prepareLocalCommentAttachment(file);
      setPreparedAttachment(attachment);
      setSelectedAttachmentName(file.name);
      setAttachmentMode(attachment.type);
    } catch (selectionError) {
      setPreparedAttachment(null);
      setSelectedAttachmentName("");
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "Could not prepare that attachment.",
      );
    } finally {
      event.target.value = "";
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const attachment = createAttachment();
    const attachmentResult = validateCommentAttachment(attachment);
    if (!attachmentResult.valid) {
      setError(attachmentResult.error);
      return;
    }
    if (!body.trim() && !attachment) return;

    onComment({ body, attachment, fontStyle, parentCommentId: replyToCommentId });
    setBody("");
    setAttachmentMode("none");
    setPreparedAttachment(null);
    setSelectedAttachmentName("");
    setReplyToCommentId(null);
    setComposerExpanded(false);
    setError(null);
    setSendStatus("Comment posted on this device");
    if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setSendStatus(null), 1800);
    inputRef.current?.focus();
  }

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function beginLongPress(event: PointerEvent, commentId: string) {
    if (event.pointerType === "mouse") return;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      setContextCommentId(commentId);
      longPressTimer.current = null;
    }, 520);
  }

  function pulseCommentLike(commentId: string) {
    setLikedPulseId(null);
    window.requestAnimationFrame(() => setLikedPulseId(commentId));
  }

  useEffect(() => {
    const timer = window.setTimeout(
      () => inputRef.current?.focus(),
      reducedMotion ? 0 : 240,
    );
    return () => {
      window.clearTimeout(timer);
      clearLongPress();
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      if (statusTimer.current) window.clearTimeout(statusTimer.current);
    };
  }, [reducedMotion]);

  if (typeof document === "undefined") return null;

  return createPortal(
    (
    <div
      className={`comment-backdrop fixed inset-0 ${layerClassName} flex items-end justify-center bg-slate-950/20 sm:items-center sm:p-5 ${closing ? "is-closing" : ""}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section
        ref={surfaceRef}
        {...surfaceProps}
        tabIndex={-1}
        className={`comment-sheet flex max-h-[min(84dvh,calc(100dvh-env(safe-area-inset-top)-.5rem))] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-[var(--app-surface)] text-[var(--app-text-primary)] sm:max-h-[70dvh] sm:rounded-[2rem] ${closing ? "is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comments-title"
        data-direct-manipulation-surface
        data-reduced-motion={reducedMotion ? "true" : "false"}
        style={{
          ...directManipulationStyle,
          transformOrigin: `${originX} 100%`,
          color: "var(--app-text-primary)",
          backgroundColor: "var(--app-surface)",
        }}
      >
        <div data-direct-drag-handle className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <header data-direct-drag-handle className="grid shrink-0 grid-cols-[2.25rem_1fr_2.25rem] items-center border-b border-slate-100 px-4 py-2.5">
          <span aria-hidden="true" />
          <h2 id="comments-title" className="text-center text-sm font-black text-slate-950">
            Comments{visibleComments.length > 0 ? ` · ${visibleComments.length}` : ""}
          </h2>
          <CloseButton
            onClick={requestClose}
            label="Close comments"
            tone="minimal"
          />
        </header>

        <div ref={commentsScrollRef} className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-4 sm:px-5">
          {visibleComments.length === 0 ? (
            <p className="grid min-h-28 place-items-center text-sm text-slate-400">
              No comments yet
            </p>
          ) : (
            <div className="space-y-4">
              {visibleComments.map((comment) => {
                const author = users.find((user) => user.account.id === comment.authorId);
                const liked = likedCommentIds.includes(comment.id);
                const reposted = repostedCommentIds.includes(comment.id);
                const own = comment.authorId === viewer.account.id;
                const isReply = Boolean(comment.parentCommentId);

                return (
                  <article
                    key={comment.id}
                    className={`relative flex gap-3 ${isReply ? "ml-8 border-l border-slate-100 pl-3" : ""}`}
                    onPointerDown={(event) => beginLongPress(event, comment.id)}
                    onPointerUp={clearLongPress}
                    onPointerCancel={clearLongPress}
                    onPointerMove={clearLongPress}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setContextCommentId(comment.id);
                    }}
                    onDoubleClick={() => {
                      if (shouldCommitCommentDoubleTap(liked)) {
                        onToggleCommentLike(comment.id);
                      }
                      pulseCommentLike(comment.id);
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => author && onOpenProfile(author.account.id)}
                      aria-label={author ? `Open ${author.profile.displayName}'s profile` : "Unavailable profile"}
                      className="h-fit shrink-0 rounded-full"
                    >
                      {author ? (
                        <ProfileAvatar
                          user={author}
                          size="sm"
                          primaryColor={theme.primary}
                          accentColor={theme.accent}
                        />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-500">
                          ?
                        </span>
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="rounded-[1.35rem] bg-slate-50 px-3.5 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="min-w-0 truncate text-sm font-black text-slate-900">
                            {author?.profile.displayName ?? "Unavailable user"}
                            {author && <span className="ml-1.5 font-semibold text-slate-400">@{author.profile.username}</span>}
                          </p>
                          <time className="shrink-0 text-[10px] font-semibold text-slate-400" dateTime={comment.createdAt}>
                            {formatRelativeTime(comment.createdAt, currentTime)}
                          </time>
                        </div>
                        {comment.body && (
                          <p className={`mt-1 break-words text-slate-700 ${isEmojiOnlyComment(comment.body) ? "text-3xl leading-tight" : "text-sm leading-6"} ${fontClass(comment.fontStyle)}`}>
                            {comment.body}
                          </p>
                        )}
                        {comment.attachment && (
                          <CommentAttachmentView attachment={comment.attachment} />
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-3 px-2 text-[11px] font-bold text-slate-400">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyToCommentId(comment.id);
                            inputRef.current?.focus();
                          }}
                          className="hover:text-slate-700"
                        >
                          Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onToggleCommentLike(comment.id);
                            pulseCommentLike(comment.id);
                          }}
                          aria-pressed={liked}
                          className={liked ? "text-red-500" : "hover:text-slate-700"}
                        >
                          <span className={likedPulseId === comment.id ? "like-pop" : ""}>
                            {liked ? "♥" : "♡"}
                          </span>{" "}
                          {comment.likeCount ?? 0}
                        </button>
                        {!own && (
                          <button
                            type="button"
                            onClick={() => onToggleCommentRepost(comment.id)}
                            aria-pressed={reposted}
                            className={reposted ? "text-[var(--app-accent)]" : "hover:text-slate-700"}
                          >
                            ↻ {comment.repostCount ?? 0}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setContextCommentId(comment.id)}
                          aria-label="Comment options"
                          className="ml-auto px-2 text-base leading-none hover:text-slate-700"
                        >
                          •••
                        </button>
                      </div>

                      {contextCommentId === comment.id && (
                        <div className="cm-popover-surface mt-2 grid overflow-hidden rounded-2xl bg-slate-50 p-1 sm:grid-cols-2">
                          {own ? (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteComment(comment.id);
                                setContextCommentId(null);
                              }}
                              className="rounded-xl px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  onHideComment(comment.id);
                                  setContextCommentId(null);
                                }}
                                className="rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                              >
                                Not interested
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onReportComment(comment.id);
                                  setContextCommentId(null);
                                }}
                                className="rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                              >
                                Report
                              </button>
                            </>
                          )}
                          {author && (
                            <>
                              <button
                                type="button"
                                onClick={() => onOpenProfile(author.account.id)}
                                className="rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                              >
                                View profile
                              </button>
                              {!own && (
                                <button
                                  type="button"
                                  onClick={() => onMessageUser(author.account.id)}
                                  className="rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                                >
                                  Message
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <form
          onSubmit={submit}
          className="shrink-0 border-t border-slate-100 bg-white px-3 pt-2 pb-[max(.75rem,env(safe-area-inset-bottom))]"
        >
          {sendStatus && <p role="status" className="mb-1 px-2 text-[10px] font-semibold text-slate-400">{sendStatus}</p>}
          {replyToCommentId && (() => {
            const parent = comments.find((comment) => comment.id === replyToCommentId);
            const parentAuthor = users.find((user) => user.account.id === parent?.authorId);
            return (
              <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <span className="truncate">Replying to {parentAuthor ? `@${parentAuthor.profile.username}` : "this comment"}</span>
                <button type="button" onClick={() => setReplyToCommentId(null)} className="shrink-0 font-black text-slate-700" aria-label="Cancel reply">Cancel</button>
              </div>
            );
          })()}
          {composerExpanded && (
            <div className="cm-content-swap mb-2 rounded-2xl bg-slate-50 p-2.5">
              <div className="mb-2 flex items-center gap-1 overflow-x-auto" aria-label="Quick emoji">
                {["❤️", "😂", "🔥", "👏", "🎉", "🌿"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setBody((current) => `${current}${emoji}`)}
                    className="grid h-9 w-9 shrink-0 place-items-center text-lg"
                    aria-label={`Add ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["none", "image", "gif", "video", "sticker"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setAttachmentMode(mode);
                      setPreparedAttachment(null);
                      setSelectedAttachmentName("");
                      setError(null);
                    }}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black capitalize ${
                      attachmentMode === mode
                        ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    {mode === "none" ? "Text" : mode}
                  </button>
                ))}
                <select
                  value={fontStyle}
                  onChange={(event) => setFontStyle(event.target.value as CommentFontStyle)}
                  aria-label="Comment font style"
                  className="ml-auto rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600"
                >
                  <option value="normal">Regular</option>
                  <option value="serif">Serif</option>
                  <option value="mono">Mono</option>
                  <option value="bold">Bold</option>
                </select>
              </div>

              {attachmentMode !== "none" && attachmentMode !== "sticker" && (
                <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
                  <span className="truncate">
                    {selectedAttachmentName || `Choose ${attachmentMode}`}
                  </span>
                  <span className="shrink-0 text-[var(--app-accent)]">Browse</span>
                  <input
                    type="file"
                    accept={attachmentMode === "video" ? "video/*" : attachmentMode === "gif" ? "image/gif" : "image/*"}
                    onChange={selectAttachmentFile}
                    className="sr-only"
                  />
                </label>
              )}

              {attachmentMode === "sticker" && (
                <div className="mt-2 flex gap-2">
                  {stickerOptions.map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      onClick={() => setStickerId(sticker.id)}
                      aria-label={sticker.label}
                      aria-pressed={stickerId === sticker.id}
                      className={`grid h-10 w-10 place-items-center rounded-xl text-xl ${
                        stickerId === sticker.id ? "bg-[var(--app-accent-soft)]" : "bg-white"
                      }`}
                    >
                      {sticker.glyph}
                    </button>
                  ))}
                </div>
              )}
              {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="hidden shrink-0 sm:block">
              <ProfileAvatar user={viewer} size="xs" primaryColor={theme.primary} accentColor={theme.accent} />
            </div>
            <button
              type="button"
              onClick={() => setComposerExpanded((current) => !current)}
              aria-expanded={composerExpanded}
              aria-label="Comment media and style"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg text-slate-500 hover:bg-slate-100"
            >
              +
            </button>
            <textarea
              ref={inputRef}
              data-initial-focus
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              placeholder={replyToCommentId ? "Write a reply" : "Add a comment"}
              aria-label="Add a comment"
              className={`max-h-24 min-w-0 flex-1 resize-none rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)] sm:text-sm ${fontClass(fontStyle)}`}
            />
            <button
              type="submit"
              disabled={
                !body.trim() &&
                attachmentMode !== "sticker" &&
                !preparedAttachment
              }
              className="interactive-pop rounded-full px-4 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: "var(--app-accent)", color: "var(--app-accent-contrast)" }}
            >
              Post
            </button>
          </div>
          <p className="mt-1 px-2 text-[9px] text-slate-400">Comments in this preview stay on this device.</p>
        </form>
      </section>
    </div>
    ),
    document.body,
  );
}
