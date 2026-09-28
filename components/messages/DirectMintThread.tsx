"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { CloseButton } from "@/components/ui/CloseButton";
import { MintLeafBackButton } from "@/components/ui/MintLeafBackButton";
import type { UniversityTheme } from "@/data/universities";
import type {
  DirectMintAttachment,
  DirectMintMessage,
  DirectMintState,
} from "@/hooks/useDirectMint";
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

const stickers = [
  { label: "Mint leaf", glyph: "🌿" },
  { label: "Campus cheer", glyph: "📣" },
  { label: "Study break", glyph: "📚" },
] as const;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unsupported file."));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function MessageAttachment({ attachment }: { attachment: DirectMintAttachment }) {
  if (attachment.type === "sticker") {
    return <span className="block p-1 text-5xl" role="img" aria-label={attachment.label}>{attachment.url}</span>;
  }
  if (!attachment.url) return null;
  if (attachment.type === "video") {
    return <video src={attachment.url} controls playsInline preload="metadata" className="max-h-72 max-w-full rounded-2xl bg-black object-contain" />;
  }
  return (
    // Local development attachments are data URLs and intentionally bypass optimization.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={attachment.url} alt={attachment.label} className="max-h-72 max-w-full rounded-2xl object-contain" />
  );
}

export function DirectMintThread({ viewer, otherUser, theme, directMint, onBack, onOpenProfile, friendships, follows }: DirectMintThreadProps) {
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<DirectMintAttachment | null>(null);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [renderTime] = useState(() => Date.now());
  const [faceTimeSupported] = useState(() => typeof navigator !== "undefined" && supportsFaceTimeHandoff(navigator.userAgent, navigator.platform));
  const [callNotice, setCallNotice] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messages = directMint.messagesFor(otherUser.account.id);
  const faceTime = resolveFaceTimeHandoff({ viewer, target: otherUser, friendships, follows, supported: faceTimeSupported });
  const replyToMessage = messages.find((message) => message.id === replyToMessageId) ?? null;

  useLayoutEffect(() => {
    directMint.markConversationSeen(otherUser.account.id);
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [directMint, messages.length, otherUser.account.id]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sent = directMint.sendMessage(otherUser.account.id, draft, { attachment, replyToMessageId });
    if (!sent) return;
    setDraft("");
    setAttachment(null);
    setReplyToMessageId(null);
    setToolsOpen(false);
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>, requestedType: "image" | "gif" | "camera") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setAttachmentError("Choose a file smaller than 4 MB for this local preview.");
      return;
    }
    setAttachmentError(null);
    try {
      const url = await readFileAsDataUrl(file);
      const type: DirectMintAttachment["type"] = requestedType === "gif" || file.type === "image/gif"
        ? "gif"
        : file.type.startsWith("video/") ? "video" : "image";
      setAttachment({ type, label: file.name || (requestedType === "camera" ? "Camera attachment" : "Message attachment"), url });
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Could not attach that file.");
    }
  }

  function beginReply(message: DirectMintMessage) {
    setReplyToMessageId(message.id);
    composerRef.current?.focus();
  }

  return (
    <section className="cm-content-swap flex h-[calc(100dvh-10rem)] min-h-[30rem] flex-col overflow-hidden rounded-[1.75rem] bg-white sm:h-[min(44rem,calc(100dvh-11rem))]" data-dedicated-message-thread aria-label={`Conversation with ${otherUser.profile.displayName}`}>
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-3 py-3 sm:px-4">
        <MintLeafBackButton onClick={onBack} aria-label="Back" label="Back" tone="minimal" className="shrink-0 text-slate-800" />
        <button type="button" onClick={() => onOpenProfile(otherUser.account.id)} className="flex min-w-0 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--app-accent)]">
          <ProfileAvatar user={otherUser} size="sm" primaryColor={theme.primary} accentColor={theme.accent} />
          <span className="min-w-0"><strong className="block truncate text-sm font-black text-slate-950">{otherUser.profile.displayName}</strong><span className="block truncate text-xs text-slate-500">@{otherUser.profile.username}</span></span>
        </button>
        <button type="button" disabled={!faceTime.available} aria-label="Start FaceTime call" onClick={() => { if (!faceTime.available) return; setCallNotice("Opening FaceTime on this device…"); window.location.assign(faceTime.href); }} className="ml-auto grid h-10 w-10 shrink-0 place-items-center text-slate-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35" title={faceTime.available ? "Start FaceTime call" : faceTime.reason === "unsupported_device" ? "FaceTime isn't available on this device." : "FaceTime handoff is unavailable for this profile."}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3" /><path d="m16 10 5-3v10l-5-3" /></svg>
        </button>
      </header>

      {callNotice && <div role="status" className="flex shrink-0 items-center justify-between bg-slate-50 px-4 py-2 text-xs text-slate-600"><span>{callNotice}</span><CloseButton onClick={() => setCallNotice(null)} label="Dismiss call status" tone="minimal" /></div>}

      <div ref={messagesRef} aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-4">
        {messages.length === 0 ? (
          <div className="m-auto text-center"><div className="mx-auto w-fit"><ProfileAvatar user={otherUser} size="md" primaryColor={theme.primary} accentColor={theme.accent} /></div><p className="mt-3 text-sm font-black text-slate-800">{otherUser.profile.firstName}</p><p className="mt-1 text-xs text-slate-400">No messages yet</p></div>
        ) : messages.map((message) => {
          const own = message.senderId === viewer.account.id;
          const repliedTo = message.replyToMessageId ? messages.find((candidate) => candidate.id === message.replyToMessageId) : null;
          return (
            <div key={message.id} className={`group cm-message-enter flex ${own ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[82%]">
                <div className={`rounded-[1.25rem] px-3.5 py-2.5 text-sm leading-6 ${own ? "bg-[var(--app-personal)] text-[var(--app-personal-contrast)]" : "bg-slate-100 text-slate-800"}`}>
                  {repliedTo && <p className={`mb-2 line-clamp-2 border-l-2 pl-2 text-xs ${own ? "border-current" : "border-slate-300 text-slate-500"}`}>{repliedTo.body || repliedTo.attachment?.label || "Attachment"}</p>}
                  {message.attachment && <MessageAttachment attachment={message.attachment} />}
                  {message.body && <p className={message.attachment ? "mt-2" : ""}>{message.body}</p>}
                </div>
                <div className={`mt-1 flex items-center gap-2 px-1 text-[9px] text-slate-400 ${own ? "justify-end" : "justify-start"}`}><span>{formatRelativeTime(message.createdAt, renderTime)}{own ? ` · ${message.status}` : ""}</span><button type="button" onClick={() => beginReply(message)} className="font-bold text-slate-500 opacity-70 transition hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">Reply</button></div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-slate-100 bg-white px-3 pt-2 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        {replyToMessage && <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500"><span className="truncate">Replying to {replyToMessage.body || replyToMessage.attachment?.label || "attachment"}</span><button type="button" onClick={() => setReplyToMessageId(null)} className="font-black text-slate-700">Cancel</button></div>}
        {attachment && <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><span className="truncate">{attachment.type === "sticker" ? attachment.url : attachment.label}</span><button type="button" onClick={() => setAttachment(null)} className="font-black text-slate-700">Remove</button></div>}
        {toolsOpen && (
          <div className="cm-content-swap mb-2 rounded-2xl bg-slate-50 p-2.5">
            <div className="flex flex-wrap items-center gap-1.5"><button type="button" onClick={() => cameraInputRef.current?.click()} className="px-2 py-1 text-xs font-bold text-slate-600">Camera</button><button type="button" onClick={() => photoInputRef.current?.click()} className="px-2 py-1 text-xs font-bold text-slate-600">Photo / video</button><button type="button" onClick={() => gifInputRef.current?.click()} className="px-2 py-1 text-xs font-bold text-slate-600">GIF file</button>{["❤️", "😂", "🔥", "👏"].map((emoji) => <button key={emoji} type="button" onClick={() => setDraft((current) => `${current}${emoji}`)} className="grid h-8 w-8 place-items-center text-lg" aria-label={`Add ${emoji}`}>{emoji}</button>)}</div>
            <div className="mt-2 flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Campus stickers · development</span>{stickers.map((sticker) => <button key={sticker.label} type="button" onClick={() => setAttachment({ type: "sticker", label: sticker.label, url: sticker.glyph })} className="text-xl" aria-label={`Attach ${sticker.label}`}>{sticker.glyph}</button>)}</div>
            <p className="mt-2 text-[10px] text-slate-400">Attachments and messages in this preview stay on this device.</p>
            {attachmentError && <p className="mt-1 text-xs font-semibold text-[var(--app-danger)]">{attachmentError}</p>}
            <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" onChange={(event) => void selectFile(event, "camera")} className="sr-only" />
            <input ref={photoInputRef} type="file" accept="image/*,video/*" onChange={(event) => void selectFile(event, "image")} className="sr-only" />
            <input ref={gifInputRef} type="file" accept="image/gif" onChange={(event) => void selectFile(event, "gif")} className="sr-only" />
          </div>
        )}
        <div className="flex items-end gap-2"><button type="button" onClick={() => setToolsOpen((current) => !current)} aria-expanded={toolsOpen} aria-label="Message attachments" className="grid h-11 w-10 shrink-0 place-items-center text-2xl text-slate-500">+</button><textarea ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder={`Message @${otherUser.profile.username}`} className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-[var(--app-accent)] sm:text-sm" /><button type="submit" disabled={!draft.trim() && !attachment} className="flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-sm font-black text-[var(--app-accent-contrast)] disabled:opacity-40" style={{ backgroundColor: theme.primary }}>Send</button></div>
      </form>
    </section>
  );
}
