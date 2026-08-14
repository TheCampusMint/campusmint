"use client";

import { useState } from "react";

import { diningLocations } from "@/data/discovery/dining";
import type { UniversityId, UniversityTheme } from "@/data/universities";

type FoodFilter = "all" | "on_campus" | "off_campus";

export function FoodSkeleton({
  universityId,
  theme,
}: {
  universityId: UniversityId | null;
  theme: UniversityTheme;
}) {
  const [filter, setFilter] = useState<FoodFilter>("all");
  const locations = universityId
    ? diningLocations.filter(
        (location) =>
          location.accessibleUniversityIds.includes(
            universityId,
          ) &&
          (filter === "all" ||
            location.scope === filter),
      )
    : [];

  if (!universityId) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center">
        <h2 className="font-black text-slate-900">
          Food discovery is not configured yet
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Campus dining for {theme.shortName} will appear
          once university metadata is configured.
        </p>
      </div>
    );
  }
  return <div className="space-y-5"><div className="px-1"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Campus + nearby</p><h1 className="mt-1 text-3xl font-black text-slate-950">Food</h1><p className="mt-2 text-sm text-slate-600">Dining halls, restaurants, and coffee from existing university-scoped sources.</p></div><FilterRow value={filter} onChange={setFilter} theme={theme} />
    <div className="grid gap-3 sm:grid-cols-2">{locations.map((location) => <article key={location.id} className="rounded-[1.5rem] border border-white/80 bg-white/90 p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl" style={{ backgroundColor: theme.accent }}>◒</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-500">{location.scope === "on_campus" ? "On campus" : "Off campus"}</span></div><h2 className="mt-4 font-black text-slate-950">{location.name}</h2><p className="mt-1 text-xs font-bold" style={{ color: theme.primary }}>{location.area}</p><p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">{location.description}</p><div className="mt-4 flex flex-wrap gap-1.5">{location.categories.map((category) => <span key={category} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{category}</span>)}</div><p className="mt-4 text-[10px] font-semibold text-slate-400">Source: {location.source.label}</p></article>)}</div>
  </div>;
}

function FilterRow({ value, onChange, theme }: { value: FoodFilter; onChange: (value: FoodFilter) => void; theme: UniversityTheme }) {
  return <div className="flex gap-2">{(["all", "on_campus", "off_campus"] as FoodFilter[]).map((option) => <button key={option} type="button" onClick={() => onChange(option)} className="rounded-full px-4 py-2 text-xs font-black" style={value === option ? { backgroundColor: theme.primary, color: theme.secondary } : { backgroundColor: "white", color: "#64748b" }}>{option === "all" ? "All" : option === "on_campus" ? "On campus" : "Off campus"}</button>)}</div>;
}

