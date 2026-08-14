"use client";

import { getAccountConfiguredUniversityId } from "@/data/universities";

import { useMemo, useState } from "react";

import type { PrimarySection } from "@/components/shell/navigation";
import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import { diningLocations } from "@/data/discovery/dining";
import { housingEntities } from "@/data/discovery/housing";
import { sampleEvents } from "@/data/events";
import { developmentOrganizations } from "@/data/organizations";
import type { UniversityTheme } from "@/data/universities";
import type { ProfilesState } from "@/hooks/useProfiles";
import type { MarketplaceListing } from "@/types/marketplace";
import type { CampusMintUser } from "@/types/profile";

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  type: "Profile" | "Club" | "Marketplace" | "Housing" | "Food" | "Event";
  href?: string;
  profileId?: string;
  section?: PrimarySection;
};

export function GlobalSearchSkeleton({ viewer, theme, profiles, listings, onOpenProfile, onSelectSection, autoFocus = false }: {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  listings: MarketplaceListing[];
  onOpenProfile: (userId: string) => void;
  onSelectSection: (section: PrimarySection) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const configuredUniversityId =
    getAccountConfiguredUniversityId(
      viewer.account,
    );

  const networkId = configuredUniversityId
    ? getCampusNetworkForUniversity(
        configuredUniversityId,
      )?.id
    : null;
    const candidates: SearchResult[] = [
      ...profiles.users.filter((user) => user.account.id !== viewer.account.id && !profiles.isBlocked(user.account.id) && theme.accessibleCampuses.includes(user.account.universityId)).map((user) => ({ id: user.account.id, title: user.profile.displayName, subtitle: `@${user.profile.username}`, type: "Profile" as const, profileId: user.account.id })),
      ...developmentOrganizations.filter((organization) => theme.accessibleCampuses.includes(organization.universityId)).map((organization) => ({ id: organization.id, title: organization.name, subtitle: organization.shortDescription, type: "Club" as const, href: `/clubs/${organization.handle}` })),
      ...listings.filter((listing) => listing.campusNetworkId === networkId && listing.status === "active").map((listing) => ({ id: listing.id, title: listing.title, subtitle: `$${listing.askingPrice.toFixed(2)} · ${listing.description}`, type: "Marketplace" as const, section: "marketplace" as const })),
      ...housingEntities.filter((item) => Boolean(
      configuredUniversityId &&
      item.accessibleUniversityIds.includes(
        configuredUniversityId,
      )
    )).map((item) => ({ id: item.id, title: item.name, subtitle: item.campusName, type: "Housing" as const, section: "housing" as const })),
      ...diningLocations.filter((item) => Boolean(
      configuredUniversityId &&
      item.accessibleUniversityIds.includes(
        configuredUniversityId,
      )
    )).map((item) => ({ id: item.id, title: item.name, subtitle: item.area, type: "Food" as const, section: "food" as const })),
      ...sampleEvents.filter((event) => theme.accessibleCampuses.includes(event.campus)).map((event) => ({ id: event.id, title: event.title, subtitle: `${event.date} · ${event.location}`, type: "Event" as const })),
    ];
    return candidates.filter((candidate) => `${candidate.title} ${candidate.subtitle} ${candidate.type}`.toLowerCase().includes(normalized)).slice(0, 18);
  }, [listings, profiles, query, theme.accessibleCampuses, viewer.account.id, viewer.account.universityId]);

  function resultContent(result: SearchResult) {
    return <><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black" style={{ backgroundColor: theme.accent, color: theme.primary }}>{result.type.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-950">{result.title}</strong><span className="mt-0.5 block truncate text-xs text-slate-500">{result.subtitle}</span></span><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-500">{result.type}</span></>;
  }

  return (
    <div className="space-y-5"><div className="px-1"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">One search</p><h1 className="mt-1 text-3xl font-black text-slate-950">Search</h1><p className="mt-2 text-sm text-slate-600">Discover profiles, clubs, listings, housing, food, and events from the data already available to your university.</p></div>
      <label className="relative block"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-400" aria-hidden="true">⌕</span><input autoFocus={autoFocus} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Campus Mint…" className="w-full rounded-2xl border border-white/80 bg-white/95 py-4 pl-12 pr-4 text-base shadow-sm outline-none focus:ring-2" style={{ caretColor: theme.primary }} /></label>
      {!query.trim() && <div className="rounded-3xl border border-dashed border-slate-300 bg-white/65 p-10 text-center"><h2 className="font-black text-slate-900">Start with a name or place</h2><p className="mt-2 text-sm text-slate-500">Results stay labeled by type so similarly named entities remain clear.</p></div>}
      {query.trim() && results.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 bg-white/65 p-10 text-center text-sm text-slate-500">No available development records match.</div>}
      {results.length > 0 && <div className="divide-y divide-slate-100 overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/95 shadow-sm">{results.map((result) => result.href ? <a key={`${result.type}-${result.id}`} href={result.href} className="flex items-center gap-3 p-4 hover:bg-slate-50">{resultContent(result)}</a> : <button key={`${result.type}-${result.id}`} type="button" onClick={() => result.profileId ? onOpenProfile(result.profileId) : result.section ? onSelectSection(result.section) : undefined} className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50">{resultContent(result)}</button>)}</div>}
    </div>
  );
}
