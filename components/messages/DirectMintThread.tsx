"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { MintLeafBackButton } from "@/components/ui/MintLeafBackButton";
import type { UniversityTheme } from "@/data/universities";
import type { DirectMintState } from "@/hooks/useDirectMint";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { resolveFaceTimeHandoff, supportsFaceTimeHandoff } from "@/lib/social/facetime";
import type { CampusMintUser } from "@/types/profile";
import type { Follow, Friendship } from "@/types/social";

type DirectMintThreadProps = {
  viewer: CampusMintUser;
  otherUser: CampusMintUser;
  theme: UniversityTheme;
  directMint: DirectMintState;
  onBack: () => void;
  onOpenProfile: (userId: string) => void;
  friendships: readonly Friendship[];
  follows: readonly Follow[];
};

export function DirectMintThread({ viewer, otherUser, theme, directMint, onBack, onOpenProfile, friendships, follows }: DirectMintThreadProps) {
  const [draft, setDraft] = useState("");
  const [renderTime] = useState(() => Date.now());
  const [faceTimeSupported] = useState(() => typeof navigator !== "undefined" && supportsFaceTimeHandoff(navigator.userAgent, navigator.platform));
  const [callNotice, setCallNotice] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const messages = directMint.messagesFor(otherUser.account.id);
  const faceTime = resolveFaceTimeHandoff({ viewer, target: otherUser, friendships, follows, supported: faceTimeSupported });

  useLayoutEffect(() => {
    directMint.markConversationSeen(otherUser.account.id);
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [directMint, messages.length, otherUser.account.id]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sent = directMint.sendMessage(otherUser.account.id, draft);
    if (sent) setDraft("");
  }

  return (
    <section className="cm-content-swap flex h-[calc(100dvh-10rem)] min-h-[30rem] flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_14px_45px_rgba(15,23,42,.1)] sm:h-[min(44rem,calc(100dvh-11rem))]" data-dedicated-message-thread aria-label={`Conversation with ${otherUser.profile.displayName}`}>
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-3 py-3 sm:px-4">
        <MintLeafBackButton onClick={onBack} aria-label="Back" label="Back" tone="minimal" className="shrink-0 text-slate-800" />
        <button type="button" onClick={() => onOpenProfile(otherUser.account.id)} className="flex min-w-0 items-center gap-3 rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-[var(--app-accent)]">
          <ProfileAvatar user={otherUser} size="sm" primaryColor={theme.primary} accentColor={theme.accent} />
          <span className="min-w-0">
            <strong className="block truncate text-sm font-black text-slate-950">{otherUser.profile.displayName}</strong>
            <span className="block truncate text-xs text-slate-500">@{otherUser.profile.username}</span>
          </span>
        </button>
        <button type="button" disabled={!faceTime.available} aria-label="Start FaceTime call" onClick={() => { if (!faceTime.available) return; setCallNotice("Opening FaceTime on this device…"); window.location.assign(faceTime.href); }} className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35" title={faceTime.available ? "Start FaceTime call" : faceTime.reason === "unsupported_device" ? "FaceTime isn't available on this device." : "FaceTime handoff is unavailable for this profile."}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3" /><path d="m16 10 5-3v10l-5-3" /></svg>
        </button>
      </header>

      {callNotice && <div role="status" className="flex shrink-0 items-center justify-between bg-slate-50 px-4 py-2 text-xs text-slate-600"><span>{callNotice}</span><button type="button" onClick={() => setCallNotice(null)} aria-label="Dismiss call status">×</button></div>}

      <div ref={messagesRef} aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-4">
        {messages.length === 0 ? (
          <div className="m-auto text-center">
            <div className="mx-auto w-fit"><ProfileAvatar user={otherUser} size="md" primaryColor={theme.primary} accentColor={theme.accent} /></div>
            <p className="mt-3 text-sm font-black text-slate-800">{otherUser.profile.firstName}</p>
            <p className="mt-1 text-xs text-slate-400">No messages yet</p>
          </div>
        ) : messages.map((message) => {
          const own = message.senderId === viewer.account.id;
          return (
            <div key={message.id} className={`cm-message-enter flex ${own ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[82%]">
                <div className={`rounded-[1.25rem] px-3.5 py-2.5 text-sm leading-6 ${own ? "text-white" : "bg-slate-100 text-slate-800"}`} style={own ? { backgroundColor: theme.primary } : undefined}>{message.body}</div>
                <p className={`mt-1 px-1 text-[9px] text-slate-400 ${own ? "text-right" : "text-left"}`}>{formatRelativeTime(message.createdAt, renderTime)}{own ? ` · ${message.status}` : ""}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="flex shrink-0 items-end gap-2 border-t border-slate-100 bg-white px-3 pt-2 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={1} placeholder={`Message @${otherUser.profile.username}`} className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-[var(--app-accent)] sm:text-sm" />
        <button type="submit" disabled={!draft.trim()} className="flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-sm font-black text-white disabled:opacity-40" style={{ backgroundColor: theme.primary }}>Send</button>
      </form>
    </section>
  );
}
