"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { cuisines, type Coordinates, type Cuisine, type NearbyItem } from "@/lib/discovery/nearby";
import { sharePublicItem } from "@/lib/sharing/share";
import { fetchPlaceJson, refreshPlaceSession, requestPlaceSession } from "@/lib/providers/places/session";
import type { PlaceDetails, PlacePhoto, PlaceReviews } from "@/lib/providers/places/google";
import { usePlaceData } from "@/hooks/usePlaceData";

type DiscoveryResult = { items: NearbyItem[]; configured?: boolean; partial?: boolean };
const interactive = "rounded-full px-2 py-2 text-sm text-[var(--app-accent)] focus-visible:outline-2 focus-visible:outline-offset-2";
export function NearbyDiscovery({ kind, origin, revision, query, sessionKey }: { kind: "food" | "events"; origin: Coordinates; revision: number; query: string; sessionKey: string }) {
  const [cuisine, setCuisine] = useState<Cuisine>("All");
  const [state, setState] = useState<{ key: string; items: NearbyItem[]; message: string; partial?: boolean }>({ key: "", items: [], message: "" });
  const key = `search:${kind}:${origin.latitude}:${origin.longitude}:${cuisine}:${revision}`;
  const scopedKey = `${sessionKey}:${key}`;
  const [now, setNow] = useState(0);
  useEffect(() => { if (kind !== "events") return; const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, [kind]);
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    const parameters = new URLSearchParams({ kind, lat: String(origin.latitude), lng: String(origin.longitude), cuisine });
    requestPlaceSession(sessionKey, key, () => fetchPlaceJson<DiscoveryResult>(`/api/discovery/nearby?${parameters}`)).then(data => {
      if (!active) return;
      setNow(Date.now());
      setState({ key: scopedKey, items: data.items ?? [], message: data.configured === false ? "Nearby food is coming soon" : "", partial: data.partial });
    }).catch(error => { if (active) setState({ key: scopedKey, items: [], message: error.message }); });
    return () => { active = false; };
  }, [key, scopedKey, kind, sessionKey, origin.latitude, origin.longitude, cuisine, retry]);
  function refresh() { refreshPlaceSession(sessionKey, key); setRetry(n => n + 1); }
  const items = state.key === scopedKey ? state.items.filter(i => `${i.title} ${i.address} ${i.description}`.toLowerCase().includes(query.trim().toLowerCase())) : [];
  return <section className="space-y-4">
    {kind === "food" && <div aria-label="Cuisine" className="flex gap-2 overflow-x-auto pb-1">{cuisines.map(c => <button key={c} onClick={() => setCuisine(c)} aria-pressed={cuisine === c} className="cm-choice-control shrink-0 rounded-full px-3 py-2 text-sm"><span className="cm-choice-highlight">{c}</span></button>)}</div>}
    <div className="flex justify-end"><button onClick={refresh} className={interactive}>Refresh</button></div>
    {state.key !== scopedKey ? <p role="status" className="py-12 text-center text-sm">Finding nearby…</p> : state.message ? <div role="status" className="py-12 text-center text-sm">{state.message}{!state.message.includes("coming soon") && <button className={interactive} onClick={refresh}>Retry</button>}</div> : !items.length ? <p className="rounded-3xl bg-[var(--app-surface)] py-12 text-center text-sm">{query.trim() ? "No matches" : kind === "events" ? "No events" : "No places"}</p> : null}
    {state.partial && <p role="status" className="text-xs text-[var(--app-text-secondary)]">Some events couldn’t load. <button onClick={refresh} className={interactive}>Retry</button></p>}
    <div className="grid gap-4 sm:grid-cols-2">{items.map(item => <NearbyCard key={item.id} item={item} kind={kind} now={now} sessionKey={sessionKey} onShare={async () => setNotice(await sharePublicItem(item.title, `/share/event/${encodeURIComponent(item.id)}`))} />)}</div>
    {notice && <p role="status" className="text-sm text-[var(--app-accent)]">{notice}</p>}
  </section>;
}
function Attributions({ values }: { values?: NearbyItem["attributions"] }) {
  return <>{values?.map(a => a.url ? <a key={a.name} href={a.url} target="_blank" rel="noreferrer" className="ml-2 text-xs">{a.name}</a> : <span key={a.name} className="ml-2 text-xs">{a.name}</span>)}</>;
}
function NearbyCard({ item, kind, now, sessionKey, onShare }: { item: NearbyItem; kind: "food" | "events"; now: number; sessionKey: string; onShare: () => void }) {
  const [open, setOpen] = useState(false);
  return <article className="overflow-hidden rounded-3xl bg-[var(--app-surface)]">
    {item.googlePlaceId ? <LazyPlacePhoto placeId={item.googlePlaceId} sessionKey={sessionKey} index={0} /> : item.image && <figure><img src={item.image} alt="" loading="lazy" className="max-h-60 w-full object-cover" referrerPolicy="no-referrer" />{item.imageCredit && <figcaption className="px-4 text-xs text-[var(--app-text-secondary)]">{item.imageCreditUrl ? <a href={item.imageCreditUrl} target="_blank" rel="noreferrer">{item.imageCredit}</a> : item.imageCredit}{item.imageSourceUrl && <a className="ml-2" href={item.imageSourceUrl} target="_blank" rel="noreferrer">View photo ↗</a>}</figcaption>}</figure>}
    <div className="space-y-2 p-4"><h2 className="font-bold">{item.title}</h2>{item.startsAt && <p className="text-sm text-[var(--app-accent)]">{Date.parse(item.startsAt) < now && item.endsAt && Date.parse(item.endsAt) > now ? `Now · until ${new Date(item.endsAt).toLocaleDateString([], { month: "short", day: "numeric" })}` : new Date(item.startsAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: item.timeZone })}</p>}
      {item.rating != null && <p className="text-sm">★ {item.rating.toFixed(1)} <span className="text-[var(--app-text-secondary)]">({item.ratingCount ?? 0})</span></p>}
      {item.description && <p className="text-sm text-[var(--app-text-secondary)]">{item.description}</p>}<p className="text-xs text-[var(--app-text-secondary)]">{item.address}</p>
      <div className="flex flex-wrap gap-4 text-sm text-[var(--app-accent)]">{item.website && <a href={item.website} target="_blank" rel="noreferrer">Website ↗</a>}{kind === "events" && <button className={interactive} onClick={onShare}>Share</button>}{item.googlePlaceId && <button className={interactive} aria-expanded={open} onClick={() => setOpen(value => !value)}>Details</button>}</div>
      {item.googlePlaceId && open && <PlaceExpanded placeId={item.googlePlaceId} sessionKey={sessionKey} sourceUrl={item.sourceUrl} />}
      <a translate="no" className="inline-block whitespace-nowrap text-xs font-normal not-italic text-[var(--app-text-primary)]" href={item.sourceUrl} target="_blank" rel="noreferrer">{item.source}</a><Attributions values={item.attributions} />
    </div>
  </article>;
}
function LazyPlacePhoto({ placeId, sessionKey, index }: { placeId: string; sessionKey: string; index: number }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    if (!container.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "0px", threshold: .01 });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const { data, error, refresh } = usePlaceData<{ photo: PlacePhoto | null }>(sessionKey, `photo:${placeId}:${index}`, `/api/places/${encodeURIComponent(placeId)}/photo?index=${index}`, visible);
  const photo = data?.photo;
  return <div ref={container} className="min-h-8">
    {photo && !imageFailed && <figure><img src={photo.url} alt="" referrerPolicy="no-referrer" className="max-h-60 w-full object-cover" onError={() => setImageFailed(true)} /><figcaption className="space-x-2 px-4 py-1 text-xs text-[var(--app-text-secondary)]">{photo.authors.map((a, index) => <span key={index}>{a.avatar && <img src={a.avatar} alt="" width={20} height={20} className="mr-1 inline-block rounded-full" />}{a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.name}</a> : a.name}</span>)}{photo.sourceUrl && <a href={photo.sourceUrl} target="_blank" rel="noreferrer">View photo ↗</a>}</figcaption></figure>}
    {(error || imageFailed) && <button className={interactive} onClick={() => { setImageFailed(false); refresh(); }}>Retry photo</button>}
    {!visible && <button className={interactive} onClick={() => setVisible(true)}>Photo</button>}
  </div>;
}
function PlaceExpanded({ placeId, sessionKey, sourceUrl }: { placeId: string; sessionKey: string; sourceUrl: string }) {
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [extraPhotos, setExtraPhotos] = useState(0);
  const detail = usePlaceData<PlaceDetails>(sessionKey, `details:${placeId}`, `/api/places/${encodeURIComponent(placeId)}?view=details`, true);
  const reviews = usePlaceData<PlaceReviews>(sessionKey, `reviews:${placeId}`, `/api/places/${encodeURIComponent(placeId)}?view=reviews`, reviewsOpen);
  return <div className="space-y-3 py-2">
    {detail.error ? <button className={interactive} onClick={detail.refresh}>Retry details</button> : !detail.data ? <p role="status" className="text-sm">Loading…</p> : <>
      <div className="flex flex-wrap gap-4 text-sm text-[var(--app-accent)]">{detail.data.website && <a href={detail.data.website} target="_blank" rel="noreferrer">Website ↗</a>}{detail.data.phone && <span className="text-[var(--app-text-primary)]">{detail.data.phone}</span>}</div>
      {!!detail.data.hours.length && <details><summary className="text-sm">Hours{detail.data.openNow === undefined ? "" : detail.data.openNow ? " · Open" : " · Closed"}</summary><ul className="py-2 text-xs">{detail.data.hours.map(line => <li key={line}>{line}</li>)}</ul></details>}
      <Attributions values={detail.data.attributions} />
      <button onClick={detail.refresh} className={interactive}>Refresh details</button>
    </>}
    <div className="flex gap-2"><button className={interactive} aria-expanded={reviewsOpen} onClick={() => setReviewsOpen(open => !open)}>Google reviews</button>{extraPhotos < 4 && <button className={interactive} onClick={() => setExtraPhotos(value => value + 1)}>More photos</button>}</div>
    {reviewsOpen && <div>{reviews.error ? <button className={interactive} onClick={reviews.refresh}>Retry reviews</button> : !reviews.data ? <p role="status" className="text-sm">Loading…</p> : <><p className="mb-2 text-xs text-[var(--app-text-secondary)]">Most relevant · Google Maps</p>{!reviews.data.reviews.length && <p className="text-sm">No reviews</p>}{reviews.data.reviews.map((r, index) => <blockquote key={index} className="mb-3 text-sm">{r.avatar && <img src={r.avatar} alt="" width={24} height={24} className="mr-2 inline-block rounded-full" />}<a href={r.authorUrl ?? sourceUrl} target="_blank" rel="noreferrer" className="font-semibold">{r.author}</a> · {r.rating}/5<p>{r.text}</p>{r.url && <a href={r.url} className="text-xs text-[var(--app-accent)]" target="_blank" rel="noreferrer">View review ↗</a>}</blockquote>)}<Attributions values={reviews.data.attributions} /></>}</div>}
    {Array.from({ length: extraPhotos }, (_, index) => <LazyPlacePhoto key={index + 1} placeId={placeId} sessionKey={sessionKey} index={index + 1} />)}
  </div>;
}
