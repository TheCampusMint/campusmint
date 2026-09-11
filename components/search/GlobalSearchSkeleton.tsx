"use client";

import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";

import { CalendarIcon, FoodIcon, SearchIcon, SellIcon } from "@/components/icons/CampusIcons";
import { MarketplaceRestricted } from "@/components/marketplace/MarketplaceRestricted";
import { SearchDiscoveryResults } from "@/components/search/SearchDiscoveryResults";
import { SearchResultDetails } from "@/components/search/SearchResultDetails";
import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import { diningLocations } from "@/data/discovery/dining";
import { getAccountConfiguredUniversityId, type UniversityTheme } from "@/data/universities";
import type { EventMomentsState } from "@/hooks/useEventMoments";
import type { useMarketplace } from "@/hooks/useMarketplace";
import type { MintzState } from "@/hooks/useMintz";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import type { ProfilesState } from "@/hooks/useProfiles";
import { rankEventContent } from "@/lib/content/eventRanking";
import { isUpcomingDiscoverableEvent } from "@/lib/events/systemEventIngestion";
import { canViewMarketplace, type MarketplacePermissionMode } from "@/lib/marketplacePermissions";
import { filterUnifiedSearchCandidates, getAnchoredSearchScrollY, getUnifiedSearchCategoryCount, openUnifiedSearchDetail, setUnifiedSearchCategory, type UnifiedSearchAccess, type UnifiedSearchCandidate, type UnifiedSearchCategory, type UnifiedSearchState } from "@/lib/search/unifiedSearch";
import type { CampusMintUser } from "@/types/profile";
import type { Story } from "@/types/story";
import type { TemporaryUser } from "@/types/user";
import type { Event } from "@/types/event";

type MarketplaceState = ReturnType<typeof useMarketplace>;
const categoryOptions: { id: UnifiedSearchCategory; label: string; icon: ReactNode; description: string }[] = [
  { id: "food", label: "Food", icon: <FoodIcon />, description: "Places to eat" },
  { id: "events", label: "Events", icon: <CalendarIcon />, description: "What’s happening" },
  { id: "marketplace", label: "Sell", icon: <SellIcon />, description: "Buy and sell nearby" },
];
const searchPlaceholders: Record<UnifiedSearchCategory, string> = { food: "Search food and dining…", events: "Search nearby events…", marketplace: "Search items to buy or sell…" };
const searchText = (values: Array<string | null | undefined>) => values.filter(Boolean).join(" ").toLocaleLowerCase();

type Props = {
  viewer: CampusMintUser; user: TemporaryUser; theme: UniversityTheme; profiles: ProfilesState; mintz: MintzState;
  eventMoments: EventMomentsState; marketplace: MarketplaceState; marketplacePermissionMode: MarketplacePermissionMode;
  events: Event[];
  organizations: OrganizationsState; stories: Story[]; searchState: UnifiedSearchState;
  onSearchStateChange: (state: UnifiedSearchState) => void; onOpenDirectMint: (userId: string) => void; onLogout: () => void;
  autoFocus?: boolean;
};

export function GlobalSearchSkeleton(props: Props) {
  const { viewer, user, theme, profiles, mintz, eventMoments, events, marketplace, marketplacePermissionMode, organizations, stories, searchState, onSearchStateChange, onOpenDirectMint, onLogout, autoFocus = false } = props;
  const controlsAnchorRef = useRef<HTMLDivElement>(null); const pendingAnchorYRef = useRef<number | null>(null);
  const configuredUniversityId = getAccountConfiguredUniversityId(viewer.account);
  const campusNetworkId = configuredUniversityId ? getCampusNetworkForUniversity(configuredUniversityId)?.id ?? null : null;
  const marketplaceAllowed = canViewMarketplace(user, marketplacePermissionMode);
  const access: UnifiedSearchAccess = { configuredUniversityId, accessibleCampusIds: theme.accessibleCampuses, campusNetworkId, blockedUserIds: [], marketplaceAllowed };

  const candidates = useMemo<UnifiedSearchCandidate[]>(() => {
    const food: UnifiedSearchCandidate[] = diningLocations.filter((item) => !item.source.isDevelopment).map((item) => ({ id: item.id, title: item.name, subtitle: item.area, category: "food", typeLabel: "Food", detail: { kind: "food", id: item.id }, scope: { kind: "universities", universityIds: item.accessibleUniversityIds }, searchText: searchText([item.name, item.area, item.address, item.description, ...item.categories]) }));
    const eventCandidates: UnifiedSearchCandidate[] = rankEventContent(events.filter((event) => isUpcomingDiscoverableEvent(event, eventMoments.currentTime)), eventMoments.currentTime).map((event) => ({ id: event.id, title: event.title, subtitle: `${event.date} · ${event.location}`, category: "events", typeLabel: "Event", detail: { kind: "event", id: event.id }, scope: { kind: "campus", campusId: event.campus }, searchText: searchText([event.title, event.description, event.category, event.location, event.organizer]) }));
    const sell: UnifiedSearchCandidate[] = marketplace.listings.filter((listing) => listing.status === "active" && !marketplace.blockedSellerIds.includes(listing.sellerId)).map((listing) => ({ id: listing.id, title: listing.title, subtitle: `$${listing.askingPrice.toFixed(2)} · ${listing.description}`, category: "marketplace", typeLabel: "Sell", detail: { kind: "marketplace", id: listing.id }, scope: { kind: "campus_network", campusNetworkId: listing.campusNetworkId }, searchText: searchText([listing.title, listing.description, listing.category, listing.condition, listing.pickupArea]) }));
    return [...food, ...eventCandidates, ...sell];
  }, [eventMoments.currentTime, events, marketplace.blockedSellerIds, marketplace.listings]);
  const filtered = filterUnifiedSearchCandidates(candidates, searchState, access);

  useLayoutEffect(() => {
    const previousAnchorY = pendingAnchorYRef.current; const anchor = controlsAnchorRef.current; pendingAnchorYRef.current = null;
    if (previousAnchorY === null || !anchor) return;
    const scrollContainer = anchor.closest<HTMLElement>("[data-search-scroll-container]");
    const currentScrollY = scrollContainer?.scrollTop ?? window.scrollY;
    const nextScrollY = getAnchoredSearchScrollY({ currentScrollY, previousAnchorY, nextAnchorY: anchor.getBoundingClientRect().top });
    if (Math.abs(nextScrollY - currentScrollY) > .5) (scrollContainer ?? window).scrollTo({ top: nextScrollY, behavior: "auto" });
  }, [searchState.category]);

  function selectCategory(category: UnifiedSearchCategory) {
    if (category === searchState.category) return;
    pendingAnchorYRef.current = controlsAnchorRef.current?.getBoundingClientRect().top ?? null;
    onSearchStateChange(setUnifiedSearchCategory(searchState, category));
  }

  return <div className="space-y-5"><div ref={controlsAnchorRef} className="space-y-5" data-search-controls-anchor>
    <label className="relative block"><span className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--app-text-secondary)]"><SearchIcon /></span><span className="sr-only">Search {searchState.category === "marketplace" ? "Sell" : searchState.category}</span><input data-initial-focus autoFocus={autoFocus} value={searchState.query} onChange={(event) => onSearchStateChange({ ...searchState, query: event.target.value, history: [] })} placeholder={searchPlaceholders[searchState.category]} className="w-full rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] py-4 pl-12 pr-4 text-base text-[var(--app-text-primary)] shadow-sm outline-none placeholder:text-[var(--app-text-secondary)] focus:ring-2 focus:ring-[var(--app-accent)]"/></label>
    <div className="grid grid-cols-3 gap-2 sm:gap-3">{categoryOptions.map((option) => { const selected = searchState.category === option.id; return <button key={option.id} type="button" aria-pressed={selected} onClick={() => selectCategory(option.id)} className="interactive-pop min-h-[104px] rounded-3xl border p-3 text-left shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-4" style={selected ? { backgroundColor: "var(--app-accent)", borderColor: "var(--app-accent)", color: "var(--app-accent-contrast)", outlineColor: "var(--app-accent-contrast)" } : { backgroundColor: "var(--app-surface)", borderColor: "var(--app-border)", color: "var(--app-text-primary)", outlineColor: "var(--app-accent)" }}><div className="flex items-start justify-between gap-2"><span className="block h-6 w-6" aria-hidden="true">{option.icon}</span><span className={`cm-eyebrow rounded-full px-2 py-0.5 ${selected ? "bg-white/15" : "bg-[var(--app-surface-elevated)] text-[var(--app-text-secondary)]"}`}>{getUnifiedSearchCategoryCount(candidates, option.id, access)}</span></div><strong className="mt-3 block text-sm font-black">{option.label}</strong><span className={`mt-0.5 hidden text-[11px] sm:block ${selected ? "opacity-80" : "text-[var(--app-text-secondary)]"}`}>{option.description}</span></button>; })}</div>
  </div>
  <div key={searchState.category} className="cm-content-swap">{!configuredUniversityId ? <div className="rounded-3xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] p-8 text-center"><h2 className="font-black">Campus discovery isn&apos;t configured yet</h2><p className="mt-2 text-sm text-[var(--app-text-secondary)]">Verified results will appear when this university is configured.</p></div> : searchState.category === "marketplace" && !marketplaceAllowed ? <MarketplaceRestricted user={user} theme={theme}/> : <SearchDiscoveryResults state={searchState} candidates={filtered} theme={theme} eventMoments={eventMoments} events={events} marketplace={marketplace} viewerId={viewer.account.id} onOpen={(detail) => onSearchStateChange(openUnifiedSearchDetail(searchState, detail))}/>}</div>
  <SearchResultDetails state={searchState} onStateChange={onSearchStateChange} viewer={viewer} user={user} configuredUniversityId={configuredUniversityId} theme={theme} profiles={profiles} mintz={mintz} eventMoments={eventMoments} events={events} marketplace={marketplace} marketplacePermissionMode={marketplacePermissionMode} organizations={organizations} stories={stories} onOpenDirectMint={onOpenDirectMint} onLogout={onLogout}/>
  </div>;
}
