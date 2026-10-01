"use client";

import { useEffect, useId, useState } from "react";
import type { UniversityId } from "@/data/universities";
import type { PlaceProviderResult } from "@/lib/providers/places/types";
import { fetchPlaceJson, requestPlaceSession, refreshPlaceSession } from "@/lib/providers/places/session";

type Place = PlaceProviderResult;

type Props = {
  sessionKey: string; universityId: UniversityId | null; value: string; onChange: (address: string) => void;
};
export function PlacePicker(props: Props) { return <PlacePickerSession key={`${props.sessionKey}:${props.universityId}`} {...props} />; }
function PlacePickerSession({ sessionKey, universityId, value, onChange }: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [confirmation, setConfirmation] = useState<Place | null>(null);
  useEffect(() => {
    let active = true;
    if (query.trim().length < 3 || !universityId || value) return;
    const timer = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const url = "/api/places/search?query=" + encodeURIComponent(query.trim()) + "&universityId=" + universityId;
        const body = await requestPlaceSession(sessionKey, url, () => fetchPlaceJson<{ results: Place[] }>(url));
        if (active) setResults((body.results ?? []).filter((place) => place.address));
      } catch (error) { if (active) { setResults([]); setError(error instanceof Error ? error.message : "Address search unavailable."); } }
      finally { if (active) setLoading(false); }
    }, 400);
    return () => { clearTimeout(timer); active = false; };
  }, [query, universityId, value, sessionKey, revision]);
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-xs font-semibold text-[var(--app-text-secondary)]">Location</label>
    {value ? <div className="flex items-center gap-3 rounded-2xl bg-[var(--app-surface-elevated)] px-3 py-3"><span className="flex-1 text-sm">{value}</span><button type="button" aria-label="Change location" onClick={() => { onChange(""); setQuery(""); setResults([]); setConfirmation(null); }} className="rounded-full p-1">×</button></div>
      : <input id={id} value={query} maxLength={200} autoComplete="off" placeholder="Find a place or address" onChange={(event) => { setQuery(event.target.value); setResults([]); setLoading(false); setError(null); setConfirmation(null); }} className="cm-composer-field w-full rounded-2xl bg-[var(--app-surface-elevated)] px-3 py-3 text-base" />}
    {!value && <div aria-live="polite">
      {loading && <p className="text-xs text-[var(--app-text-secondary)]">Finding places…</p>}
      {error && <p role="status" className="text-xs text-[var(--app-text-secondary)]">{error}</p>}
      {error && <button type="button" onClick={() => { refreshPlaceSession(sessionKey, "/api/places/search?"); setRevision(revision + 1); }}>Retry</button>}
      {results.map((place) => <div key={place.placeId}><button type="button" onClick={() => { setConfirmation(place); setResults([]); }} className="block w-full rounded-xl p-3 text-left hover:bg-[var(--app-accent-soft)]"><strong className="block text-sm">{place.name}</strong><span className="text-xs text-[var(--app-text-secondary)]">{place.address}</span></button>{place.attributions.map((a, i) => <span key={i} className="text-xs">{a.providerUri ? <a href={a.providerUri} target="_blank" rel="noreferrer">{a.provider}</a> : a.provider}</span>)}</div>)}
      {confirmation && <div className="text-sm"><p>{confirmation.name} · {confirmation.address}</p><p translate="no">Google Maps</p>{confirmation.attributions.map((a, i) => <span key={i}>{a.providerUri ? <a href={a.providerUri} target="_blank" rel="noreferrer">{a.provider}</a> : a.provider}</span>)}<button type="button" className="mt-2 rounded-full text-[var(--app-accent)]" onClick={() => { onChange(query.trim()); setConfirmation(null); }}>Use my location text: {query.trim()}</button></div>}
      {results.length > 0 && <p className="text-xs text-[var(--app-text-secondary)]">Google Maps · Select to confirm</p>}
    </div>}
  </div>;
}
