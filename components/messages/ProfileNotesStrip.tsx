"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { MusicPicker } from "@/components/music/MusicPicker";
import { SelectedMusicTrack } from "@/components/music/SelectedMusicTrack";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { UniversityTheme } from "@/data/universities";
import type { DirectMintState } from "@/hooks/useDirectMint";
import { useModalLayer } from "@/hooks/useModalLayer";
import { areDevelopmentFixturesEnabled } from "@/lib/runtime/fixturePolicy";
import {
  normalizeSafeWebsiteUrl,
  PROFILE_NOTE_MAX_LENGTH,
  type ProfileNote,
} from "@/lib/social/privateMessages";
import type { MusicMetadata } from "@/types/content";
import type { CampusMintUser } from "@/types/profile";

type ProfileNotesStripProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  directMint: DirectMintState;
  relatedUsers: readonly CampusMintUser[];
  onOpenUser: (userId: string) => void;
};

const developmentNotes: Record<
  string,
  Pick<ProfileNote, "text" | "websiteUrl" | "music">
> = {
  "demo-tamu-noah": {
    text: "Library until 9",
    websiteUrl: null,
    music: null,
  },
  "demo-seller-tamu": {
    text: "new playlist",
    websiteUrl: null,
    music: {
      id: "spotify:dev-campus-dawn",
      provider: "spotify",
      providerTrackId: "dev-campus-dawn",
      trackId: "dev-campus-dawn",
      trackTitle: "Campus Dawn (Development Instrumental)",
      artist: "North Quad Sessions",
      album: "Study Hours",
      artworkUrl: null,
      previewUrl: null,
      externalUrl: null,
    },
  },
  "demo-seller-blinn": {
    text: "Running at 6?",
    websiteUrl: "https://example.com/campus-mint-demo-note",
    music: null,
  },
};
const runtimeNotes = areDevelopmentFixturesEnabled() ? developmentNotes : {};

function ProfileNoteUnit({ children, onClick, label, offset = 0 }: { children: ReactNode; onClick: () => void; label?: string; offset?: number }) {
  return <button type="button" onClick={onClick} aria-label={label} className="relative h-[7.25rem] w-[5.25rem] shrink-0 text-center transition-transform" style={{ transform: `translateY(${offset}px)` }} data-note-cell data-profile-note-unit>{children}</button>;
}

function NoteBubble({
  text,
  hasMusic,
  hasLink,
  own,
}: {
  text: string;
  hasMusic: boolean;
  hasLink: boolean;
  own?: boolean;
}) {
  return (
    <span className="absolute left-1/2 top-0 z-10 flex min-h-8 w-[4.75rem] -translate-x-1/2 items-center justify-center rounded-2xl border border-slate-200 bg-white px-1.5 py-1 text-center text-[9px] font-semibold leading-3 text-slate-700 shadow-[0_6px_20px_-14px_rgba(15,23,42,.75)] before:absolute before:-bottom-1 before:left-1/2 before:h-2 before:w-2 before:-translate-x-1/2 before:rotate-45 before:border-b before:border-r before:border-slate-200 before:bg-white">
      <span className="line-clamp-2 break-words">
        {text}
        {(hasMusic || hasLink) && (
          <span className="ml-1 whitespace-nowrap text-[8px] text-slate-400" aria-hidden="true">
            {hasMusic ? "♫" : ""}{hasLink ? "↗" : ""}
          </span>
        )}
      </span>
      {own && <span className="sr-only">Your profile Note</span>}
    </span>
  );
}

export function ProfileNotesStrip({
  viewer,
  theme,
  directMint,
  relatedUsers,
  onOpenUser,
}: ProfileNotesStripProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [website, setWebsite] = useState("");
  const [music, setMusic] = useState<MusicMetadata | null>(null);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLElement>(null);

  function closeEditor() {
    setEditing(false);
    setError(null);
  }

  useModalLayer(editorRef, closeEditor, editing);

  function openEditor() {
    const note = directMint.profileNote;
    setText(note?.text ?? "");
    setWebsite(note?.websiteUrl ?? "");
    setMusic(note?.music ?? null);
    setError(null);
    setEditing(true);
  }

  function saveNote() {
    const websiteUrl = normalizeSafeWebsiteUrl(website);
    if (website.trim() && !websiteUrl) {
      setError("Enter a valid website URL.");
      return;
    }
    const hasContent = Boolean(text.trim() || websiteUrl || music);

    directMint.updateProfileNote(
      hasContent
        ? {
            text: text.slice(0, PROFILE_NOTE_MAX_LENGTH),
            websiteUrl,
            music,
            updatedAt: new Date().toISOString(),
          }
        : null,
    );
    closeEditor();
  }

  const ownText = directMint.profileNote?.text || "Add note";

  return (
    <section aria-label="Profile Notes" data-profile-notes-row>
      <div className="flex items-start gap-1 overflow-x-auto px-1 pb-2 pt-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ProfileNoteUnit onClick={openEditor} label="Edit your Profile Note">
          <NoteBubble
            text={ownText}
            hasMusic={Boolean(directMint.profileNote?.music)}
            hasLink={Boolean(directMint.profileNote?.websiteUrl)}
            own
          />
          <span className="absolute left-1/2 top-[2.65rem] -translate-x-1/2">
            <ProfileAvatar user={viewer} size="md" primaryColor={theme.primary} accentColor={theme.accent} />
            <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-[var(--app-background)] text-xs font-black text-white" style={{ backgroundColor: theme.primary }} aria-hidden="true">+</span>
          </span>
          <span className="absolute inset-x-0 bottom-0 block truncate px-1 text-center text-[10px] font-bold text-slate-700">You</span>
        </ProfileNoteUnit>

        {relatedUsers.slice(0, 8).map((user, index) => {
          const note = runtimeNotes[user.account.id];
          return (
            <ProfileNoteUnit key={user.account.id} onClick={() => onOpenUser(user.account.id)} label={`${user.profile.displayName}${note ? `: ${note.text}` : ""}`} offset={index % 2 === 0 ? 10 : 0}>
              {note && <NoteBubble text={note.text} hasMusic={Boolean(note.music)} hasLink={Boolean(note.websiteUrl)} />}
              <span className={`absolute left-1/2 -translate-x-1/2 ${note ? "top-[2.65rem]" : "top-4"}`}>
                <ProfileAvatar user={user} size="md" primaryColor={theme.primary} accentColor={theme.accent} />
              </span>
              <span className="absolute inset-x-0 bottom-0 block truncate px-1 text-center text-[10px] font-semibold text-slate-600">{user.profile.firstName}</span>
            </ProfileNoteUnit>
          );
        })}
      </div>

      {editing && typeof document !== "undefined" && createPortal(
        <div className="cm-overlay-backdrop fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/25 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
          <section ref={editorRef} role="dialog" aria-modal="true" aria-labelledby="profile-note-editor-title" className="cm-panel-sheet w-full rounded-t-[2rem] border border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-[2rem] sm:p-5">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
            <div className="flex items-center justify-between gap-4">
              <h2 id="profile-note-editor-title" className="text-base font-black text-slate-950">Note</h2>
              <span className="text-[10px] font-semibold tabular-nums text-slate-400">{text.length}/{PROFILE_NOTE_MAX_LENGTH}</span>
            </div>

            <textarea value={text} onChange={(event) => setText(event.target.value.slice(0, PROFILE_NOTE_MAX_LENGTH))} rows={3} maxLength={PROFILE_NOTE_MAX_LENGTH} autoFocus placeholder="Share a thought" className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none focus:border-[var(--app-accent)]" />

            <div className="mt-3">{music ? <SelectedMusicTrack track={music} onChange={() => setMusicPickerOpen(true)} onRemove={() => setMusic(null)} /> : <button type="button" onClick={() => setMusicPickerOpen(true)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-left text-xs font-black text-slate-700">♫ Add Music</button>}</div>

            <label className="mt-3 block text-xs font-black text-slate-700">Link<input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="Website (optional)" inputMode="url" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal" /></label>
            {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

            <div className="mt-4 flex items-center justify-between gap-2">
              {directMint.profileNote ? <button type="button" onClick={() => { directMint.updateProfileNote(null); closeEditor(); }} className="rounded-full px-3 py-2 text-xs font-bold text-slate-500">Clear</button> : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={closeEditor} className="rounded-full px-3 py-2 text-xs font-bold text-slate-500">Cancel</button>
                <button type="button" onClick={saveNote} className="rounded-full px-4 py-2 text-xs font-black text-white" style={{ backgroundColor: theme.primary }}>Save</button>
              </div>
            </div>
            <MusicPicker open={musicPickerOpen} selected={music} onSelect={setMusic} onClose={() => setMusicPickerOpen(false)} />
          </section>
        </div>,
        document.body,
      )}
    </section>
  );
}
