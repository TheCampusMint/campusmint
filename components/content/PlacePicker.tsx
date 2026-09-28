"use client";

import { useEffect, useId, useState } from "react";
import type { UniversityId } from "@/data/universities";

type Place = { placeId: string; name: string; address: string | null };

export function PlacePicker({ universityId, value, onChange }: {
  universityId: UniversityId | null; value: string; onChange: (address: string) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (query.trim().length < 3 || !universityId || value) return;
    const timer = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const response = await fetch("/api/places/search?query=" + encodeURIComponent(query.trim()) + "&universityId=" + universityId, { signal: controller.signal, cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.configured === false ? "Address search isn’t connected yet. You can link a campus event below." : "Address search is temporarily unavailable. Try again shortly.");
        if (!controller.signal.aborted) setResults((body.results ?? []).filter((place: Place) => place.address));
      } catch (error) { if (!controller.signal.aborted) { setResults([]); setError(error instanceof Error ? error.message : "Address search unavailable."); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, universityId, value]);
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-xs font-semibold text-[var(--app-text-secondary)]">Location</label>
    {value ? <div className="flex items-center gap-3 rounded-2xl bg-[var(--app-surface-elevated)] px-3 py-3"><span className="flex-1 text-sm">{value}</span><button type="button" aria-label="Change location" onClick={() => { onChange(""); setQuery(""); setResults([]); }} className="rounded-full p-1">×</button></div>
      : <input id={id} value={query} autoComplete="off" placeholder="Find a place or address" onChange={(event) => { setQuery(event.target.value); setResults([]); setLoading(false); setError(null); }} className="cm-composer-field w-full rounded-2xl bg-[var(--app-surface-elevated)] px-3 py-3 text-base" />}
    {!value && <div aria-live="polite">
      {loading && <p className="text-xs text-[var(--app-text-secondary)]">Finding places…</p>}
      {error && <p role="status" className="text-xs text-[var(--app-text-secondary)]">{error}</p>}
      {results.map((place) => <button key={place.placeId} type="button" onClick={() => { onChange(place.name + " · " + place.address); setResults([]); }} className="block w-full rounded-xl p-3 text-left hover:bg-[var(--app-accent-soft)]"><strong className="block text-sm">{place.name}</strong><span className="text-xs text-[var(--app-text-secondary)]">{place.address}</span></button>)}
      {results.length > 0 && <p className="text-xs text-[var(--app-text-secondary)]">Google Maps · Select to confirm</p>}
    </div>}
  </div>;
}
