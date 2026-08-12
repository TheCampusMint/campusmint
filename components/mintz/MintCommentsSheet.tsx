"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { UniversityTheme } from "@/data/universities";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { MintComment } from "@/types/mint";
import type { CampusMintUser } from "@/types/profile";

type MintCommentsSheetProps = {
  comments: MintComment[];
  users: CampusMintUser[];
  viewer: CampusMintUser;
  theme: UniversityTheme;
  currentTime: number;
  reducedMotion: boolean;
  onComment: (body: string) => void;
  onDeleteComment: (commentId: string) => void;
  onReportComment: (commentId: string) => void;
  onClose: () => void;
};

export function MintCommentsSheet({ comments, users, viewer, theme, currentTime, reducedMotion, onComment, onDeleteComment, onReportComment, onClose }: MintCommentsSheetProps) {
  const [body, setBody] = useState("");
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => onCloseRef.current(), reducedMotion ? 0 : 190);
  }, [reducedMotion]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    onComment(trimmed);
    setBody("");
    inputRef.current?.focus();
  }

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), reducedMotion ? 0 : 240);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [reducedMotion, requestClose]);

  return (
    <div className={`comment-backdrop fixed inset-0 z-[65] flex items-end justify-center bg-slate-950/42 backdrop-blur-sm sm:items-center sm:p-5 ${closing ? "is-closing" : ""}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section className={`comment-sheet flex max-h-[82dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2.75rem] border border-slate-200 bg-white shadow-2xl sm:max-h-[72dvh] sm:rounded-[2.75rem] ${closing ? "is-closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="comments-title">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div><p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--app-accent)" }}>Mint conversation</p><h2 id="comments-title" className="text-xl font-black text-slate-950">Comments</h2></div>
          <button type="button" onClick={requestClose} aria-label="Close comments" className="interactive-pop flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600">×</button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {comments.length === 0 ? <div className="grid min-h-36 place-items-center text-center"><div><p className="font-black text-slate-900">No comments yet</p><p className="mt-1 text-sm text-slate-500">Start the conversation.</p></div></div> : <div className="space-y-4">{comments.map((comment) => {
            const author = users.find((user) => user.account.id === comment.authorId);
            return <article key={comment.id} className="flex gap-3"><div className="shrink-0">{author ? <ProfileAvatar user={author} size="sm" primaryColor={theme.primary} accentColor={theme.accent} /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-500">?</span>}</div><div className="min-w-0 flex-1 rounded-[1.6rem] bg-slate-50 px-4 py-3"><div className="flex items-baseline justify-between gap-3"><p className="truncate text-sm font-black text-slate-900">{author?.profile.displayName ?? "Unavailable user"}</p><time className="shrink-0 text-[11px] font-semibold text-slate-400" dateTime={comment.createdAt}>{formatRelativeTime(comment.createdAt, currentTime)}</time></div><p className="mt-1 break-words text-sm leading-6 text-slate-700">{comment.body}</p><button type="button" onClick={() => comment.authorId === viewer.account.id ? onDeleteComment(comment.id) : onReportComment(comment.id)} className={`mt-2 text-xs font-bold ${comment.authorId === viewer.account.id ? "text-rose-700" : "text-slate-400"}`}>{comment.authorId === viewer.account.id ? "Delete" : "Report"}</button></div></article>;
          })}</div>}
        </div>
        <form onSubmit={submit} className="flex gap-2 border-t border-slate-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <input ref={inputRef} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add a comment" aria-label="Add a comment" className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)] sm:text-sm" />
          <button type="submit" disabled={!body.trim()} className="interactive-pop rounded-full px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40" style={{ backgroundColor: "var(--app-accent)", color: "var(--app-accent-contrast)" }}>Post</button>
        </form>
      </section>
    </div>
  );
}
