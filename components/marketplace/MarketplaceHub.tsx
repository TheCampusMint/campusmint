"use client";

import { useMemo, useState } from "react";

import { MarketplaceCard } from "@/components/marketplace/MarketplaceCard";
import { MarketplaceDetailModal, type MarketplaceDetailPanel } from "@/components/marketplace/MarketplaceDetailModal";
import { MarketplaceRestricted } from "@/components/marketplace/MarketplaceRestricted";
import { SellListingModal } from "@/components/marketplace/SellListingModal";
import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import { marketplaceCategoryDetails, safeMeetupAreas } from "@/data/marketplace";
import { universities, type UniversityTheme } from "@/data/universities";
import type { useMarketplace } from "@/hooks/useMarketplace";
import { canCreateListing, canMakeOffer, canMessageSeller, canSaveListing, canViewMarketplace, type MarketplacePermissionMode } from "@/lib/marketplacePermissions";
import { marketplaceCategories, marketplaceConditions, type MarketplaceCategory, type MarketplaceCondition } from "@/types/marketplace";
import type { TemporaryUser } from "@/types/user";

type MarketplaceHubProps = {
  user: TemporaryUser;
  theme: UniversityTheme;
  permissionMode: MarketplacePermissionMode;
  marketplace: ReturnType<typeof useMarketplace>;
  onOpenProfile?: (userId: string) => void;
};

type MarketplaceSort = "newest" | "price_asc" | "price_desc";

export function MarketplaceHub({ user, theme, permissionMode, marketplace, onOpenProfile }: MarketplaceHubProps) {
  const [tab, setTab] = useState<"browse" | "saved">("browse");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MarketplaceCategory | "all">("all");
  const [condition, setCondition] = useState<MarketplaceCondition | "all">("all");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [sort, setSort] = useState<MarketplaceSort>("newest");
  const [negotiableOnly, setNegotiableOnly] = useState(false);
  const [pickupArea, setPickupArea] = useState("all");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<MarketplaceDetailPanel>("none");
  const [sellOpen, setSellOpen] = useState(false);
  const campusNetwork = getCampusNetworkForUniversity(user.universityId);
  const campusNetworkId = campusNetwork?.id ?? null;
  const viewAllowed = canViewMarketplace(user, permissionMode);
  const createAllowed = canCreateListing(user, permissionMode);
  const interactionAllowed = canMakeOffer(user, permissionMode) && canMessageSeller(user, permissionMode) && canSaveListing(user, permissionMode);

  const listings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const minimum = minimumPrice === "" ? null : Number(minimumPrice);
    const maximum = maximumPrice === "" ? null : Number(maximumPrice);
    const current = marketplace.listings.filter((listing) => {
      const searchable = `${listing.title} ${listing.description} ${listing.category} ${listing.pickupArea} ${listing.sportsTicket?.sport ?? ""} ${listing.sportsTicket?.eventName ?? ""}`.toLowerCase();
      return listing.campusNetworkId === campusNetworkId
        && (listing.status === "active" || listing.status === "reserved")
        && !marketplace.blockedSellerIds.includes(listing.sellerId)
        && (tab === "browse" || marketplace.savedListingIds.includes(listing.id))
        && (!normalizedQuery || searchable.includes(normalizedQuery))
        && (category === "all" || listing.category === category)
        && (condition === "all" || listing.condition === condition)
        && (minimum === null || listing.askingPrice >= minimum)
        && (maximum === null || listing.askingPrice <= maximum)
        && (!negotiableOnly || listing.negotiable)
        && (pickupArea === "all" || listing.pickupArea === pickupArea);
    });
    return [...current].sort((a, b) => sort === "price_asc"
      ? a.askingPrice - b.askingPrice
      : sort === "price_desc"
        ? b.askingPrice - a.askingPrice
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [campusNetworkId, category, condition, marketplace.blockedSellerIds, marketplace.listings, marketplace.savedListingIds, maximumPrice, minimumPrice, negotiableOnly, pickupArea, query, sort, tab]);

  const selectedListing = marketplace.listings.find((listing) =>
    listing.id === selectedListingId && listing.campusNetworkId === campusNetworkId
  ) ?? null;
  const activeOffer = selectedListing
    ? marketplace.offers.find((offer) => offer.listingId === selectedListing.id && offer.buyerId === marketplace.currentUserId && offer.status === "offer_sent")
    : undefined;

  if (!viewAllowed) return <MarketplaceRestricted user={user} theme={theme} />;
  if (!campusNetwork) return <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-950"><h2 className="text-xl font-bold">Campus Network unavailable</h2><p className="mt-2 text-sm">Marketplace access has not been configured for this university.</p></div>;

  function openListing(listingId: string, panel: MarketplaceDetailPanel = "none") {
    setSelectedPanel(panel);
    setSelectedListingId(listingId);
  }

  function closeListing() {
    setSelectedListingId(null);
    setSelectedPanel("none");
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl p-7 shadow-sm lg:p-9" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary}e8)`, color: theme.secondary }}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-sm font-bold uppercase tracking-[0.18em] opacity-75">{campusNetwork.name} Campus Network</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Campus Marketplace</h2><p className="mt-3 max-w-xl text-sm leading-6 opacity-85">Shared regional listings for verified students. You remain identified as a {universities[user.universityId].name} student.</p></div>
          <button type="button" disabled={!createAllowed} onClick={() => setSellOpen(true)} className="rounded-xl bg-white px-5 py-3 text-sm font-extrabold shadow-sm disabled:cursor-not-allowed disabled:opacity-60" style={{ color: theme.primary }}>＋ Sell something</button>
        </div>
        <label htmlFor="marketplace-search" className="sr-only">Search Marketplace</label>
        <input id="marketplace-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search textbooks, furniture, tickets..." className="mt-7 block w-full rounded-2xl bg-white px-5 py-4 text-base text-slate-950 shadow-lg outline-none placeholder:text-slate-400" />
      </section>

      <section aria-label="Marketplace categories">
        <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">Shop by category</p><h3 className="mt-1 text-xl font-bold text-slate-950">Find what students need</h3></div><button type="button" onClick={() => setCategory("all")} className="text-sm font-semibold" style={{ color: theme.primary }}>View all</button></div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{marketplaceCategories.map((item) => {
          const detail = marketplaceCategoryDetails[item];
          const selected = category === item;
          return <button key={item} type="button" onClick={() => setCategory(selected ? "all" : item)} className="rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5" style={{ borderColor: selected ? theme.primary : "#e2e8f0", boxShadow: selected ? `0 0 0 1px ${theme.primary}` : undefined }}><span className="text-2xl" aria-hidden="true">{detail.icon}</span><span className="mt-3 block text-sm font-bold text-slate-800">{detail.shortLabel}</span>{item === "Sports Passes / Tickets" && !theme.marketplace.ticketMarketplaceEnabled && <span className="mt-1 block text-[10px] font-semibold text-amber-700">Policy not configured</span>}</button>;
        })}</div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex gap-2 border-b border-slate-100 pb-4" role="tablist" aria-label="Marketplace inventory"><button role="tab" aria-selected={tab === "browse"} type="button" onClick={() => setTab("browse")} className="rounded-xl px-4 py-2 text-sm font-bold" style={tab === "browse" ? { backgroundColor: theme.primary, color: theme.secondary } : { color: "#475569" }}>Browse</button><button role="tab" aria-selected={tab === "saved"} type="button" onClick={() => setTab("saved")} className="rounded-xl px-4 py-2 text-sm font-bold" style={tab === "saved" ? { backgroundColor: theme.primary, color: theme.secondary } : { color: "#475569" }}>Saved</button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-bold text-slate-600">Condition<select value={condition} onChange={(event) => setCondition(event.target.value as typeof condition)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="all">Any condition</option>{marketplaceConditions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600">Minimum price<input value={minimumPrice} onChange={(event) => setMinimumPrice(event.target.value)} type="number" min="0" placeholder="No minimum" className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-slate-600">Maximum price<input value={maximumPrice} onChange={(event) => setMaximumPrice(event.target.value)} type="number" min="0" placeholder="No maximum" className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-slate-600">Sort<select value={sort} onChange={(event) => setSort(event.target.value as MarketplaceSort)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="newest">Newest</option><option value="price_asc">Price low to high</option><option value="price_desc">Price high to low</option></select></label>
          <label className="text-xs font-bold text-slate-600">Pickup area<select value={pickupArea} onChange={(event) => setPickupArea(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="all">Any pickup area</option>{safeMeetupAreas.map((area) => <option key={area}>{area}</option>)}</select></label>
          <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700"><input type="checkbox" checked={negotiableOnly} onChange={(event) => setNegotiableOnly(event.target.checked)} />Negotiable only</label>
        </div>
      </section>

      <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">{tab === "saved" ? "Your saved items" : `${campusNetwork.name} Campus Network`}</p><h3 className="mt-1 text-2xl font-bold text-slate-950">{listings.length} {listings.length === 1 ? "listing" : "listings"}</h3></div><p className="max-w-md text-right text-xs leading-5 text-slate-500">Marketplace inventory is shared by Campus Network. Each seller keeps their actual verified university identity.</p></div>
      {listings.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{listings.map((listing) => <MarketplaceCard key={listing.id} listing={listing} saved={marketplace.savedListingIds.includes(listing.id)} theme={theme} onOpen={openListing} onToggleSaved={marketplace.toggleSaved} />)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><div className="text-3xl" aria-hidden="true">♡</div><h3 className="mt-3 text-lg font-bold text-slate-900">{tab === "saved" ? "No saved listings yet" : "No listings match"}</h3><p className="mt-2 text-sm text-slate-500">{tab === "saved" ? "Save a listing to find it here during this session." : "Try clearing a filter or create a local development listing."}</p></div>}

      <section className="grid gap-4 rounded-3xl bg-slate-950 p-6 text-white md:grid-cols-3"><div><p className="text-sm font-bold">Meet in public</p><p className="mt-1 text-xs leading-5 text-slate-400">Use campus, a student center, library area, or another public location.</p></div><div><p className="text-sm font-bold">Protect your account</p><p className="mt-1 text-xs leading-5 text-slate-400">Never bypass identity, ticket-transfer, or university controls.</p></div><div><p className="text-sm font-bold">No payments yet</p><p className="mt-1 text-xs leading-5 text-slate-400">Campus Mint does not process money or guarantee transactions in v1.</p></div></section>

      {sellOpen && <SellListingModal universityId={user.universityId} campusNetwork={campusNetwork} theme={theme} onClose={() => setSellOpen(false)} onCreate={(input) => { const listing = marketplace.addListing(input, user.universityId); setSellOpen(false); openListing(listing.id); }} />}
      {selectedListing && interactionAllowed && <MarketplaceDetailModal listing={selectedListing} theme={theme} currentUserId={marketplace.currentUserId} saved={marketplace.savedListingIds.includes(selectedListing.id)} activeOffer={activeOffer} messages={marketplace.messages.filter((message) => message.listingId === selectedListing.id)} alreadyReported={marketplace.reports.some((report) => report.listingId === selectedListing.id)} initialPanel={selectedPanel} onClose={closeListing} onToggleSaved={() => marketplace.toggleSaved(selectedListing.id)} onSendOffer={(amount, note) => marketplace.sendOffer(selectedListing.id, amount, note)} onWithdrawOffer={marketplace.withdrawOffer} onSendMessage={(body) => marketplace.sendMessage(selectedListing.id, body)} onReport={(reason, details) => marketplace.reportListing(selectedListing.id, reason, details)} onBlockSeller={() => { marketplace.blockSeller(selectedListing.sellerId); closeListing(); }} onUpdateStatus={(status) => marketplace.updateListingStatus(selectedListing.id, status)} onOpenSellerProfile={onOpenProfile} />}
    </div>
  );
}
