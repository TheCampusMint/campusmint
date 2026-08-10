"use client";

import { useMemo, useState } from "react";

import { HousingCard } from "@/components/housing/HousingCard";
import { HousingDetail } from "@/components/housing/HousingDetail";
import { housingEntities } from "@/data/discovery/housing";
import type { UniversityId, UniversityTheme } from "@/data/universities";
import { housingReviewCategories, type HousingEntity } from "@/types/discovery";

type HousingTab = "on_campus" | "off_campus" | "roommates" | "reviews";

const tabs: Array<{ id: HousingTab; label: string }> = [
  { id: "on_campus", label: "On campus" },
  { id: "off_campus", label: "Off campus" },
  { id: "roommates", label: "Roommates" },
  { id: "reviews", label: "Reviews" },
];

type HousingHubProps = {
  universityId: UniversityId;
  accessibleCampuses: string[];
  theme: UniversityTheme;
};

function housingRating(housing: HousingEntity) {
  return housing.externalReviews?.rating ?? housing.campusMintReviews.rating;
}

export function HousingHub({ universityId, accessibleCampuses, theme }: HousingHubProps) {
  const [tab, setTab] = useState<HousingTab>("on_campus");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [maximumPrice, setMaximumPrice] = useState("any");
  const [maximumDistance, setMaximumDistance] = useState("any");
  const [minimumRating, setMinimumRating] = useState("any");
  const [amenity, setAmenity] = useState("all");
  const [selected, setSelected] = useState<HousingEntity | null>(null);

  const available = useMemo(() => housingEntities.filter((housing) => {
    if (housing.source.isDevelopment && process.env.NODE_ENV !== "development") return false;
    if (housing.scope === "on_campus") return housing.universityId === universityId;
    return housing.accessibleUniversityIds.some((id) => accessibleCampuses.includes(id));
  }), [accessibleCampuses, universityId]);

  const amenities = useMemo(() => Array.from(new Set(available.flatMap((housing) => housing.amenities))).sort(), [available]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return available.filter((housing) => {
      const rate = housing.rates[0]?.amount ?? null;
      const rating = housingRating(housing);
      const searchable = [housing.name, housing.campusName, housing.address ?? "", housing.description].join(" ").toLowerCase();
      return housing.scope === tab
        && (!normalizedQuery || searchable.includes(normalizedQuery))
        && (type === "all" || housing.housingType === type)
        && (maximumPrice === "any" || (rate !== null && rate <= Number(maximumPrice)))
        && (maximumDistance === "any" || (housing.distanceMiles !== null && housing.distanceMiles <= Number(maximumDistance)))
        && (minimumRating === "any" || (rating !== null && rating >= Number(minimumRating)))
        && (amenity === "all" || housing.amenities.includes(amenity));
    });
  }, [amenity, available, maximumDistance, maximumPrice, minimumRating, query, tab, type]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl p-7 shadow-sm lg:p-9" style={{ backgroundColor: theme.accent }}>
        <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: theme.primary }}>Housing guide</p>
        <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">A clearer place to start</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">Compare official campus housing and provider-ready off-campus listings. Unknown rates, amenities, and availability stay unknown.</p>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-2" role="tablist" aria-label="Housing sections">
          {tabs.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} type="button" onClick={() => { setTab(item.id); setSelected(null); }} className="rounded-xl px-5 py-2.5 text-sm font-semibold" style={tab === item.id ? { backgroundColor: theme.primary, color: theme.secondary } : { color: "#475569" }}>{item.label}</button>)}
        </div>
      </div>

      {(tab === "on_campus" || tab === "off_campus") && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <label htmlFor="housing-search" className="text-xs font-semibold text-slate-600">Search housing</label>
            <input id="housing-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search property, campus, or area…" className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <label className="text-xs font-semibold text-slate-600">Property type<select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="all">All types</option><option value="residence_hall">Residence hall</option><option value="university_apartment">University apartment</option><option value="apartment">Apartment</option><option value="shared_housing">Shared housing</option></select></label>
              <label className="text-xs font-semibold text-slate-600">Maximum price<select value={maximumPrice} onChange={(event) => setMaximumPrice(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="any">Any verified rate</option><option value="1000">$1,000</option><option value="2500">$2,500</option><option value="4000">$4,000</option></select></label>
              <label className="text-xs font-semibold text-slate-600">Distance<select value={maximumDistance} onChange={(event) => setMaximumDistance(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="any">Any distance</option><option value="1">Within 1 mile</option><option value="3">Within 3 miles</option><option value="5">Within 5 miles</option></select></label>
              <label className="text-xs font-semibold text-slate-600">Rating<select value={minimumRating} onChange={(event) => setMinimumRating(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="any">Any rating</option><option value="4">4.0+</option><option value="3">3.0+</option></select></label>
              <label className="text-xs font-semibold text-slate-600">Amenity<select value={amenity} onChange={(event) => setAmenity(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="all">Any amenity</option>{amenities.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
          </section>

          <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">{tab === "on_campus" ? "Official university housing" : "Off-campus housing"}</p><h3 className="mt-1 text-2xl font-bold text-slate-950">{filtered.length} {filtered.length === 1 ? "property" : "properties"}</h3></div><p className="max-w-sm text-right text-xs leading-5 text-slate-500">On-campus housing is restricted to the selected university, even when event access spans campuses.</p></div>

          {filtered.length ? <div className="grid gap-5 xl:grid-cols-2">{filtered.map((housing) => <HousingCard key={housing.id} housing={housing} theme={theme} onViewDetails={setSelected} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h3 className="font-semibold text-slate-900">No verified listings match</h3><p className="mt-2 text-sm text-slate-500">Current data stays intentionally small until an official or authorized source is connected.</p></div>}
          {selected && <HousingDetail housing={selected} onClose={() => setSelected(null)} />}
        </>
      )}

      {tab === "roommates" && <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl" aria-hidden="true">⌂</div><h3 className="mt-4 text-xl font-bold text-slate-950">Roommate matching is not active yet</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Verified profiles, privacy controls, reporting, and moderation are required before real roommate posts can be accepted.</p><button type="button" disabled className="mt-5 cursor-not-allowed rounded-xl bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-500">Authentication required</button></section>}

      {tab === "reviews" && <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm lg:p-9"><p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Campus Mint housing reviews</p><h3 className="mt-2 text-2xl font-bold text-slate-950">No verified reviews yet</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">External ratings and Campus Mint reviews will remain separate. Campus Mint reviews will cover these categories:</p><div className="mt-5 flex flex-wrap gap-2">{housingReviewCategories.map((category) => <span key={category} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">{category}</span>)}</div><button type="button" disabled className="mt-6 cursor-not-allowed rounded-xl bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-500">Sign in to write a verified review</button></section>}
    </div>
  );
}
