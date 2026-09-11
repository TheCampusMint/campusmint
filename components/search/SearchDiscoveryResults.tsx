"use client";

import { DiningLocationCard } from "@/components/dining/DiningLocationCard";
import { EventCard } from "@/components/events/EventCard";
import { MarketplaceCard } from "@/components/marketplace/MarketplaceCard";
import { diningLocations } from "@/data/discovery/dining";
import { getCampusName, type UniversityTheme } from "@/data/universities";
import type { EventMomentsState } from "@/hooks/useEventMoments";
import type { useMarketplace } from "@/hooks/useMarketplace";
import { rankEventContent } from "@/lib/content/eventRanking";
import type { UnifiedSearchCandidate, UnifiedSearchDetail, UnifiedSearchState } from "@/lib/search/unifiedSearch";
import type { Event } from "@/types/event";

type MarketplaceState = ReturnType<typeof useMarketplace>;

function EmptyResults({ query, category }: { query: string; category: UnifiedSearchState["category"] }) {
  const label = category === "marketplace" ? "Sell" : category === "food" ? "Food" : "Events";
  return <div className="rounded-3xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] p-9 text-center"><h2 className="font-black text-[var(--app-text-primary)]">{query.trim() ? "No matches yet" : `No ${label.toLocaleLowerCase()} available yet`}</h2><p className="mt-2 text-sm text-[var(--app-text-secondary)]">{query.trim() ? "Try another place, event, item, or keyword." : "New verified results will appear here."}</p></div>;
}

export function SearchDiscoveryResults({ state, candidates, theme, eventMoments, events, marketplace, viewerId, onOpen }: {
  state: UnifiedSearchState;
  candidates: readonly UnifiedSearchCandidate[];
  theme: UniversityTheme;
  eventMoments: EventMomentsState;
  events: Event[];
  marketplace: MarketplaceState;
  viewerId: string;
  onOpen: (detail: UnifiedSearchDetail) => void;
}) {
  if (candidates.length === 0) return <EmptyResults query={state.query} category={state.category} />;
  const candidateIds = new Set(candidates.map(({ id }) => id));
  const title = state.category === "food" ? "Food nearby" : state.category === "events" ? "What’s happening" : "Sell nearby";

  return <section><div className="mb-3 px-1"><h2 className="text-lg font-black text-[var(--app-text-primary)]">{title}</h2><p className="mt-0.5 text-xs font-semibold text-[var(--app-text-secondary)]">{candidates.length} {candidates.length === 1 ? "result" : "results"}</p></div>
    {state.category === "food" && <div className="grid gap-4 lg:grid-cols-2">{diningLocations.filter((location) => candidateIds.has(location.id)).map((location) => <DiningLocationCard key={location.id} location={location} theme={theme} onViewDetails={() => onOpen({ kind: "food", id: location.id })}/>)}</div>}
    {state.category === "events" && <div className="grid gap-4 lg:grid-cols-2">{rankEventContent(events, eventMoments.currentTime).filter((event) => candidateIds.has(event.id)).map((event) => <EventCard key={event.id} event={event} campusName={getCampusName(event.campus)} isGoing={eventMoments.isAttending(event.id, viewerId)} theme={theme} currentTime={eventMoments.currentTime} onToggleRsvp={() => eventMoments.toggleRsvp(event, viewerId)} onOpenDetails={() => onOpen({ kind: "event", id: event.id })}/>)}</div>}
    {state.category === "marketplace" && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{marketplace.listings.filter((listing) => candidateIds.has(listing.id)).map((listing) => <MarketplaceCard key={listing.id} listing={listing} theme={theme} saved={marketplace.savedListingIds.includes(listing.id)} onOpen={() => onOpen({ kind: "marketplace", id: listing.id })} onToggleSaved={() => marketplace.toggleSaved(listing.id)}/>)}</div>}
  </section>;
}
