"use client";

import { useMemo, useState, type FormEvent } from "react";

import { DiningLocationCard } from "@/components/dining/DiningLocationCard";
import { DiningLocationDetail } from "@/components/dining/DiningLocationDetail";
import { ProviderPlaceCard } from "@/components/dining/ProviderPlaceCard";
import { diningLocations } from "@/data/discovery/dining";
import type { UniversityId, UniversityTheme } from "@/data/universities";
import type { PlaceProviderResult } from "@/lib/providers/places/types";
import type { DiningCategory, DiningLocation } from "@/types/discovery";

const categories: Array<"All" | DiningCategory> = ["All", "Dining hall", "Restaurant", "Coffee shop", "Fast food", "On-campus dining"];

type DiningHubProps = {
  universityId: UniversityId;
  accessibleCampuses: string[];
  theme: UniversityTheme;
};

function locationRating(location: DiningLocation) {
  return location.externalReviews?.rating ?? location.campusMintReviews.rating;
}

export function DiningHub({ universityId, accessibleCampuses, theme }: DiningHubProps) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | DiningLocation["scope"]>("all");
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [campus, setCampus] = useState("all");
  const [maxDistance, setMaxDistance] = useState("any");
  const [price, setPrice] = useState("any");
  const [minimumRating, setMinimumRating] = useState("any");
  const [openNow, setOpenNow] = useState(false);
  const [sort, setSort] = useState<"recommended" | "rating">("recommended");
  const [selected, setSelected] = useState<DiningLocation | null>(null);
  const [providerQuery, setProviderQuery] = useState("");
  const [providerResults, setProviderResults] = useState<PlaceProviderResult[]>([]);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [providerLoading, setProviderLoading] = useState(false);

  const available = useMemo(() => diningLocations.filter((location) =>
    location.accessibleUniversityIds.some((id) => accessibleCampuses.includes(id))
    && (!location.source.isDevelopment || process.env.NODE_ENV === "development")
  ), [accessibleCampuses]);

  const campuses = useMemo(() => Array.from(new Map(available.map((item) => [item.campusId, item.area])).entries()), [available]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const items = available.filter((location) => {
      const searchable = [location.name, location.area, location.address ?? "", location.categories.join(" ")].join(" ").toLowerCase();
      const rating = locationRating(location);
      return (!normalizedQuery || searchable.includes(normalizedQuery))
        && (scope === "all" || location.scope === scope)
        && (category === "All" || location.categories.includes(category))
        && (campus === "all" || location.campusId === campus)
        && (maxDistance === "any" || (location.distanceMiles !== null && location.distanceMiles <= Number(maxDistance)))
        && (price === "any" || location.priceLevel === Number(price))
        && (minimumRating === "any" || (rating !== null && rating >= Number(minimumRating)))
        && (!openNow || location.openNow === true);
    });
    if (sort === "rating") items.sort((a, b) => (locationRating(b) ?? -1) - (locationRating(a) ?? -1));
    return items;
  }, [available, campus, category, maxDistance, minimumRating, openNow, price, query, scope, sort]);

  async function searchProvider(event: FormEvent) {
    event.preventDefault();
    if (providerQuery.trim().length < 2) {
      setProviderMessage("Enter at least two characters.");
      return;
    }
    setProviderLoading(true);
    setProviderMessage(null);
    setProviderResults([]);
    try {
      const response = await fetch(`/api/places/search?query=${encodeURIComponent(providerQuery.trim())}&universityId=${universityId}`, { cache: "no-store" });
      const body = await response.json() as { error?: string; results?: PlaceProviderResult[] };
      if (!response.ok) throw new Error(body.error ?? "External place search is unavailable.");
      setProviderResults(body.results ?? []);
      setProviderMessage((body.results ?? []).length ? null : "No provider results found.");
    } catch (error) {
      setProviderMessage(error instanceof Error ? error.message : "External place search is unavailable.");
    } finally {
      setProviderLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl p-7 shadow-sm lg:p-9" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary}e6)`, color: theme.secondary }}>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] opacity-75">Campus guide</p>
        <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Find your next meal</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 opacity-85">Official campus dining and clearly sourced local discovery—without made-up ratings, wait times, or popularity.</p>
        <div className="mt-6 rounded-2xl bg-white p-2 shadow-lg">
          <label htmlFor="dining-search" className="sr-only">Search dining</label>
          <input id="dining-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dining halls, coffee, restaurants, or campus…" className="w-full rounded-xl px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400" />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2" aria-label="Dining scope">
          {(["all", "on_campus", "off_campus"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setScope(value)} className="rounded-full border px-4 py-2 text-sm font-semibold" style={scope === value ? { backgroundColor: theme.primary, borderColor: theme.primary, color: theme.secondary } : { borderColor: "#e2e8f0", color: "#475569" }}>
              {value === "all" ? "All dining" : value === "on_campus" ? "On campus" : "Off campus"}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-semibold text-slate-600">Category<select value={category} onChange={(event) => setCategory(event.target.value as (typeof categories)[number])} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800">{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Campus<select value={campus} onChange={(event) => setCampus(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800"><option value="all">All accessible campuses</option>{campuses.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Distance<select value={maxDistance} onChange={(event) => setMaxDistance(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800"><option value="any">Any distance</option><option value="1">Within 1 mile</option><option value="3">Within 3 miles</option><option value="5">Within 5 miles</option></select></label>
          <label className="text-xs font-semibold text-slate-600">Price<select value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800"><option value="any">Any price</option>{[1, 2, 3, 4].map((level) => <option key={level} value={level}>{"$".repeat(level)}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Rating<select value={minimumRating} onChange={(event) => setMinimumRating(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800"><option value="any">Any rating</option><option value="4">4.0+</option><option value="3">3.0+</option></select></label>
          <label className="text-xs font-semibold text-slate-600">Sort<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800"><option value="recommended">Source order</option><option value="rating">Highest rated</option></select></label>
          <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700"><input type="checkbox" checked={openNow} onChange={(event) => setOpenNow(event.target.checked)} />Open now</label>
        </div>
      </section>

      <div className="flex items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-slate-500">Dining directory</p><h3 className="mt-1 text-2xl font-bold text-slate-950">{filtered.length} {filtered.length === 1 ? "place" : "places"}</h3></div>
        <p className="max-w-md text-right text-xs leading-5 text-slate-500">University records are source-backed. Development examples appear only in development mode.</p>
      </div>

      {filtered.length ? <div className="grid gap-5 xl:grid-cols-2">{filtered.map((location) => <DiningLocationCard key={location.id} location={location} theme={theme} onViewDetails={setSelected} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h3 className="font-semibold text-slate-900">No dining records match</h3><p className="mt-2 text-sm text-slate-500">Try clearing a filter or use live off-campus search below.</p></div>}

      {selected && <DiningLocationDetail location={selected} onClose={() => setSelected(null)} />}

      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Optional live provider</p>
        <h3 className="mt-2 text-2xl font-bold">Search nearby places</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">When a server-only Google Places key is configured, this searches live data without persisting provider content. No review text or photo bytes are cached.</p>
        <form onSubmit={searchProvider} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="provider-search" className="sr-only">Search live nearby places</label>
          <input id="provider-search" value={providerQuery} onChange={(event) => setProviderQuery(event.target.value)} placeholder="Try coffee, tacos, or late-night food" className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 text-sm text-slate-950" />
          <button disabled={providerLoading} className="rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-60" style={{ backgroundColor: theme.secondary, color: theme.primary }}>{providerLoading ? "Searching…" : "Search live places"}</button>
        </form>
        {providerMessage && <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm text-slate-200">{providerMessage}</p>}
        {providerResults.length > 0 && <div className="mt-5 grid gap-4 text-slate-950 lg:grid-cols-2">{providerResults.map((place) => <ProviderPlaceCard key={place.placeId} place={place} />)}</div>}
        {providerResults.length > 0 && <p translate="no" className="mt-4 text-sm font-normal text-slate-300">Google Maps</p>}
      </section>
    </div>
  );
}
