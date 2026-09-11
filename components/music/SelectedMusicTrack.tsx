import type { MusicMetadata } from "@/types/content";

export function SelectedMusicTrack({ track, onChange, onRemove }: { track: MusicMetadata; onChange: () => void; onRemove: () => void }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-600 to-slate-900 text-white" aria-hidden="true">♫</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{track.trackTitle}</strong><span className="block truncate text-xs text-slate-500">{track.artist}</span></span><button type="button" onClick={onChange} className="text-xs font-black text-[var(--app-accent)]">Change</button><button type="button" onClick={onRemove} className="text-xs font-bold text-slate-500">Remove</button></div>;
}
