"use client";

import { useState } from "react";

import { housingEntities } from "@/data/discovery/housing";
import type { UniversityId, UniversityTheme } from "@/data/universities";

type HousingFilter = "all" | "on_campus" | "off_campus";

export function HousingSkeleton({ universityId, theme }: { universityId: UniversityId; theme: UniversityTheme }) {
  const [filter, setFilter] = useState<HousingFilter>("all");
  const listings = housingEntities.filter((housing) => housing.accessibleUniversityIds.includes(universityId) && (filter === "all" || housing.scope === filter));
  return <div className="space-y-5"><div className="px-1"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Find your place</p><h1 className="mt-1 text-3xl font-black text-slate-950">Housing</h1><p className="mt-2 text-sm text-slate-600">Official campus options and clearly labeled development records from existing housing data.</p></div><div className="flex gap-2">{(["all", "on_campus", "off_campus"] as HousingFilter[]).map((option) => <button key={option} type="button" onClick={() => setFilter(option)} className="rounded-full px-4 py-2 text-xs font-black" style={filter === option ? { backgroundColor: theme.primary, color: theme.secondary } : { backgroundColor: "white", color: "#64748b" }}>{option === "all" ? "All" : option === "on_campus" ? "On campus" : "Off campus"}</button>)}</div>
    <div className="space-y-3">{listings.map((housing) => <article key={housing.id} className="grid overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/90 shadow-sm sm:grid-cols-[11rem_1fr]"><div className="flex min-h-36 items-end p-4 text-white" style={{ background: `linear-gradient(145deg, ${theme.primary}, color-mix(in srgb, ${theme.primary} 62%, #111827))` }}><span className="rounded-full bg-white/15 px-2 py-1 text-[9px] font-black uppercase tracking-wide">{housing.scope === "on_campus" ? "On campus" : "Off campus"}</span></div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-slate-950">{housing.name}</h2><p className="mt-1 text-xs font-bold" style={{ color: theme.primary }}>{housing.campusName}</p></div><span className="shrink-0 text-[10px] font-bold text-slate-400">No verified rating</span></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{housing.description}</p><div className="mt-4 flex items-center justify-between gap-3"><p className="truncate text-[10px] font-semibold text-slate-400">Source: {housing.source.label}</p>{housing.website && <a href={housing.website} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-black" style={{ color: theme.primary }}>Official site ↗</a>}</div></div></article>)}</div>
  </div>;
}
