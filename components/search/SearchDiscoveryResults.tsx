"use client";

import { DiningLocationCard } from "@/components/dining/DiningLocationCard";
import { EventCard } from "@/components/events/EventCard";
import { conditionLabel } from "@/lib/marketplace/listing";
import { diningLocations } from "@/data/discovery/dining";
import { getCampusName, type UniversityTheme } from "@/data/universities";
import type { EventMomentsState } from "@/hooks/useEventMoments";
import type { useMarketplace } from "@/hooks/useMarketplace";
import { rankEventContent } from "@/lib/content/eventRanking";
import type { UnifiedSearchCandidate, UnifiedSearchDetail, UnifiedSearchState } from "@/lib/search/unifiedSearch";
import type { Event } from "@/types/event";

type MarketplaceState = ReturnType<typeof useMarketplace>;

function EmptyResults({ query, category }: { query: string; category: UnifiedSearchState["category"] }) {
  return <div className="rounded-3xl bg-[var(--app-surface)] p-12 text-center text-sm">{query.trim() ? "No matches" : category === "marketplace" ? "No items" : category === "food" ? "No places" : "No events"}</div>;
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
    {state.category === "marketplace" && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{marketplace.listings.filter((listing) => candidateIds.has(listing.id)).map((listing) => <button key={listing.id} type="button" onClick={() => onOpen({ kind: "marketplace", id: listing.id })} className="rounded-3xl bg-[var(--app-surface)] p-5 text-left focus-visible:outline-2 focus-visible:outline-[var(--app-accent)]"><p className="text-xl font-bold text-[var(--app-accent)]">${listing.askingPrice.toFixed(2)}</p><h3 className="mt-1 font-semibold">{listing.title}</h3><p className="mt-2 text-sm text-[var(--app-text-secondary)]">{[listing.brand, conditionLabel(listing.condition)].filter(Boolean).join(" · ")}</p><p className="mt-2 text-xs text-[var(--app-text-secondary)]">{listing.pickupArea}</p><span className="mt-3 block text-xs text-[var(--app-accent)]">{listing.sellerId === marketplace.currentUserId ? `Your listing · ${listing.status === "sold" ? "Sold" : "View messages"}` : "View item / Message"}</span></button>)}</div>}
  </section>;
}
