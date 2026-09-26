"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { developmentMusicTracks } from "@/data/development/music";
import { CloseButton } from "@/components/ui/CloseButton";
import { useModalLayer } from "@/hooks/useModalLayer";
import {
  canPreviewTrack,
  createDevelopmentMusicAdapter,
  type MusicSearchResult,
} from "@/lib/content/music";
import type { MusicMetadata } from "@/types/content";

type MusicPickerProps = {
  open: boolean;
  selected: MusicMetadata | null;
  onSelect: (track: MusicMetadata) => void;
  onClose: () => void;
};

const adapter = createDevelopmentMusicAdapter(developmentMusicTracks);

function providerLabel(provider: MusicSearchResult["provider"]) {
  return provider === "apple_music" ? "Apple Music" : "Spotify";
}

export function MusicPicker({ open, selected, onSelect, onClose }: MusicPickerProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MusicSearchResult[]>(developmentMusicTracks);
  const [status, setStatus] = useState<"ready" | "loading" | "error">("ready");
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  function closePicker() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPreviewingId(null);
    onClose();
  }

  useModalLayer(dialogRef, closePicker, open);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const request = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const next = await adapter.search(query, controller.signal);
        if (request !== requestRef.current) return;
        setResults(next);
        setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (request === requestRef.current) setStatus("error");
      }
    }, 120);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const selectedId = useMemo(
    () => selected?.id ?? (selected ? `${selected.provider}:${selected.trackId}` : null),
    [selected],
  );

  function togglePreview(track: MusicSearchResult) {
    if (!track.previewUrl) return;
    if (previewingId === track.id) {
      audioRef.current?.pause();
      setPreviewingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(track.previewUrl);
    audio.addEventListener("ended", () => setPreviewingId(null), { once: true });
    audioRef.current = audio;
    setPreviewingId(track.id);
    audio.play().catch(() => setPreviewingId(null));
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="cm-overlay-backdrop fixed inset-0 z-[160] flex items-end justify-center bg-slate-950/35 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) closePicker(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="music-picker-title" className="cm-panel-sheet max-h-[82dvh] w-full overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:max-w-lg sm:rounded-[2rem]">
        <header className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h2 id="music-picker-title" className="text-lg font-black text-slate-950">Add music</h2><p className="text-[10px] font-semibold text-slate-400">Fictional development catalog · provider-ready</p></div>
            <CloseButton label="Close music picker" onClick={closePicker} />
          </div>
          <input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs, artists, albums" className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-[var(--app-accent)]" />
        </header>
        <div className="max-h-[60dvh] overflow-y-auto overscroll-contain p-3 sm:p-4">
          {status === "error" ? <p className="py-12 text-center text-sm text-slate-500">Music search is unavailable right now</p> : status === "ready" && results.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">No songs found</p> : (
            <div className="space-y-1" aria-busy={status === "loading"}>
              {results.map((track, index) => (
                <div key={track.id} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-slate-50">
                  <button type="button" onClick={() => { onSelect(track); closePicker(); }} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg text-white shadow-sm" style={{ background: `linear-gradient(145deg, hsl(${(index * 67 + 150) % 360} 55% 38%), hsl(${(index * 67 + 205) % 360} 62% 24%))` }} aria-hidden="true">♫</span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{track.trackTitle}</strong><span className="block truncate text-xs text-slate-500">{track.artist}{track.album ? ` · ${track.album}` : ""}</span><span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-slate-400">{providerLabel(track.provider)}{selectedId === track.id ? " · Selected" : ""}</span></span>
                  </button>
                  {canPreviewTrack(track) && <button type="button" onClick={() => togglePreview(track)} aria-label={`${previewingId === track.id ? "Pause" : "Preview"} ${track.trackTitle}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 text-xs font-black text-slate-700">{previewingId === track.id ? "Ⅱ" : "▶"}</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
