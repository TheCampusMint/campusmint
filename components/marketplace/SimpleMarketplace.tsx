"use client";

import Image from "next/image";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { MarketplaceDetailModal } from "@/components/marketplace/MarketplaceDetailModal";
import { MarketplacePhotoPlaceholder } from "@/components/marketplace/MarketplacePhotoPlaceholder";
import { MarketplaceRestricted } from "@/components/marketplace/MarketplaceRestricted";
import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import type {
  UniversityId,
  UniversityTheme,
} from "@/data/universities";
import type { useMarketplace } from "@/hooks/useMarketplace";
import { canCreateListing, canMakeOffer, canMessageSeller, canSaveListing, canViewMarketplace, type MarketplacePermissionMode } from "@/lib/marketplacePermissions";
import { checkMarketplaceListingSafety } from "@/lib/marketplaceSafety";
import type { TemporaryUser } from "@/types/user";

type SimpleMarketplaceProps = {
  user: TemporaryUser;
  configuredUniversityId: UniversityId | null;
  theme: UniversityTheme;
  marketplace: ReturnType<typeof useMarketplace>;
  permissionMode: MarketplacePermissionMode;
  onOpenProfile: (userId: string) => void;
};

export function SimpleMarketplace({
  user,
  configuredUniversityId,
  theme,
  marketplace,
  permissionMode,
  onOpenProfile,
}: SimpleMarketplaceProps) {
  const [query, setQuery] = useState("");
  const [sellOpen, setSellOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messagePanel, setMessagePanel] = useState(false);
  const network = configuredUniversityId
    ? getCampusNetworkForUniversity(
        configuredUniversityId,
      )
    : null;
  const viewAllowed = canViewMarketplace(user, permissionMode);
  const createAllowed = canCreateListing(user, permissionMode);
  const interactionAllowed = canMakeOffer(user, permissionMode) && canMessageSeller(user, permissionMode) && canSaveListing(user, permissionMode);
  const listings = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return marketplace.listings.filter((listing) => listing.campusNetworkId === network?.id && (listing.status === "active" || listing.status === "reserved") && !marketplace.blockedSellerIds.includes(listing.sellerId) && (!normalized || `${listing.title} ${listing.description}`.toLowerCase().includes(normalized)));
  }, [marketplace.blockedSellerIds, marketplace.listings, network?.id, query]);
  const selected = marketplace.listings.find((listing) => listing.id === selectedId) ?? null;
  const activeOffer = selected ? marketplace.offers.find((offer) => offer.listingId === selected.id && offer.buyerId === marketplace.currentUserId && offer.status === "offer_sent") : undefined;

  if (!viewAllowed) return <MarketplaceRestricted user={user} theme={theme} />;
  if (!configuredUniversityId || !network) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center">
        <h2 className="font-black text-slate-900">
          Marketplace is not configured yet
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          A local Marketplace for {theme.shortName} will
          appear once its campus network is configured.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 px-1"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{network.name} network</p><h1 className="mt-1 text-3xl font-black text-slate-950">Marketplace</h1><p className="mt-2 text-sm text-slate-600">Simple listings with existing student access, safety, ticket, and Campus Network rules underneath.</p></div><button type="button" disabled={!createAllowed} onClick={() => setSellOpen(true)} className="shrink-0 rounded-full px-4 py-3 text-sm font-black disabled:opacity-50" style={{ backgroundColor: theme.primary, color: theme.secondary }}>＋ Sell</button></div>
      <label className="block"><span className="sr-only">Search Marketplace</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Marketplace…" className="w-full rounded-2xl border border-white/80 bg-white/95 px-4 py-3.5 text-sm shadow-sm outline-none focus:ring-2" /></label>
      {listings.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{listings.map((listing) => <article key={listing.id} className="overflow-hidden rounded-[1.4rem] border border-white/80 bg-white shadow-sm"><button type="button" onClick={() => { setSelectedId(listing.id); setMessagePanel(false); }} className="block w-full text-left"><div className="relative aspect-square overflow-hidden">{listing.photos[0]?.url ? <Image src={listing.photos[0].url} alt={listing.photos[0].alt} fill sizes="(max-width: 640px) 50vw, 280px" className="object-cover" unoptimized /> : <MarketplacePhotoPlaceholder category={listing.category} compact />}</div><div className="p-3"><p className="text-lg font-black text-slate-950">${listing.askingPrice.toFixed(2)}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{listing.description}</p><p className="mt-2 truncate text-[10px] font-bold text-slate-400">{listing.seller.firstName}</p></div></button><button type="button" onClick={() => { setSelectedId(listing.id); setMessagePanel(true); }} className="mx-3 mb-3 block rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-700" style={{ width: "calc(100% - 1.5rem)" }}>Message seller</button></article>)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white/65 p-10 text-center text-sm text-slate-500">No available listings match.</div>}

      {sellOpen && <SimpleSellModal theme={theme} onClose={() => setSellOpen(false)} onCreate={(description, price, photo) => { const title = description.trim().split(/\s+/).slice(0, 8).join(" "); const listing = marketplace.addListing({ title, description, askingPrice: price, category: "Other", condition: "Good", negotiable: false, pickupArea: "Campus", deliveryAvailable: false, sportsTicket: null, photo }, configuredUniversityId); setSellOpen(false); setSelectedId(listing.id); }} />}
      {selected && interactionAllowed && <MarketplaceDetailModal listing={selected} theme={theme} currentUserId={marketplace.currentUserId} saved={marketplace.savedListingIds.includes(selected.id)} activeOffer={activeOffer} messages={marketplace.messages.filter((message) => message.listingId === selected.id)} alreadyReported={marketplace.reports.some((report) => report.listingId === selected.id)} initialPanel={messagePanel ? "message" : "none"} onClose={() => setSelectedId(null)} onToggleSaved={() => marketplace.toggleSaved(selected.id)} onSendOffer={(amount, note) => marketplace.sendOffer(selected.id, amount, note)} onWithdrawOffer={marketplace.withdrawOffer} onSendMessage={(body) => marketplace.sendMessage(selected.id, body)} onReport={(reason, details) => marketplace.reportListing(selected.id, reason, details)} onBlockSeller={() => { marketplace.blockSeller(selected.sellerId); setSelectedId(null); }} onUpdateStatus={(status) => marketplace.updateListingStatus(selected.id, status)} onOpenSellerProfile={onOpenProfile} />}
    </div>
  );
}

function SimpleSellModal({ theme, onClose, onCreate }: { theme: UniversityTheme; onClose: () => void; onCreate: (description: string, price: number, photo?: { url: string | null; alt: string; isDevelopmentPlaceholder: boolean }) => void }) {
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(null);
    if (!file) return setPhoto(null);
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) return setError("Choose an image smaller than 5 MB.");
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && setPhoto({ url: reader.result, name: file.name });
    reader.readAsDataURL(file);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(price);
    const body = description.trim();
    if (!photo) return setError("Add a photo for the listing.");
    if (!body) return setError("Add a short description.");
    if (!Number.isFinite(amount) || amount < 0) return setError("Enter a valid non-negative price.");
    const title = body.split(/\s+/).slice(0, 8).join(" ");
    const safety = checkMarketplaceListingSafety(title, body, "Other");
    if (!safety.allowed) return setError(safety.message);
    onCreate(body, amount, { url: photo.url, alt: `Photo for ${title}`, isDevelopmentPlaceholder: false });
  }

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-sm sm:items-center" role="presentation"><form onSubmit={submit} className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-wider" style={{ color: theme.primary }}>New listing</p><h2 className="mt-1 text-2xl font-black text-slate-950">Sell something</h2></div><button type="button" onClick={onClose} aria-label="Close listing form" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl">×</button></div><div className="mt-6 space-y-4"><label className="block text-sm font-black text-slate-700">Photo<input type="file" accept="image/*" onChange={choosePhoto} className="mt-2 block w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label>{photo && <div className="relative aspect-[16/8] overflow-hidden rounded-2xl"><Image src={photo.url} alt="Selected listing preview" fill className="object-cover" unoptimized /></div>}<label className="block text-sm font-black text-slate-700">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="What are you selling?" className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label><label className="block text-sm font-black text-slate-700">Price<input value={price} onChange={(event) => setPrice(event.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}<button type="submit" className="w-full rounded-xl py-3 text-sm font-black" style={{ backgroundColor: theme.primary, color: theme.secondary }}>Create listing</button></div></form></div>;
}
