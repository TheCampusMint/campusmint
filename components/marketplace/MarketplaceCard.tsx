import Image from "next/image";

import { MarketplacePhotoPlaceholder } from "@/components/marketplace/MarketplacePhotoPlaceholder";
import type { MarketplaceDetailPanel } from "@/components/marketplace/MarketplaceDetailModal";
import { getCampusNetwork } from "@/data/campusNetworks";
import { universities, type UniversityTheme } from "@/data/universities";
import type { MarketplaceListing } from "@/types/marketplace";

type MarketplaceCardProps = {
  listing: MarketplaceListing;
  saved: boolean;
  theme: UniversityTheme;
  onOpen: (listingId: string, panel?: MarketplaceDetailPanel) => void;
  onToggleSaved: (listingId: string) => void;
};

function formatPrice(price: number) {
  return price === 0 ? "Price not set" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

function ticketTypeLabel(listing: MarketplaceListing) {
  const ticket = listing.sportsTicket;
  if (!ticket) return "Ticket / Pass";
  return ticket.ticketType === "Other" ? ticket.customTicketType ?? "Other" : ticket.ticketType;
}

function ListingPhoto({
  listing,
}: {
  listing: MarketplaceListing;
}) {
  const photo = listing.photos[0];
  return photo?.url ? (
    <Image
      src={photo.url}
      alt={photo.alt}
      fill
      sizes="(max-width: 640px) 50vw, 320px"
      className="object-cover"
      unoptimized
    />
  ) : (
    <MarketplacePhotoPlaceholder category={listing.category} />
  );
}

export function MarketplaceCard({ listing, saved, theme, onOpen, onToggleSaved }: MarketplaceCardProps) {
  const ticket = listing.sportsTicket;
  const campusNetwork = getCampusNetwork(listing.campusNetworkId);
  const offerAvailable = listing.negotiable && listing.status === "active";

  if (ticket) {
    return (
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <button type="button" onClick={() => onOpen(listing.id)} className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px]" style={{ outlineColor: theme.primary }}>
          <div className="relative aspect-[16/8] overflow-hidden"><ListingPhoto listing={listing} /></div>
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">{listing.status}</span>
              {listing.negotiable && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Negotiable</span>}
            </div>
            <h3 className="mt-3 text-lg font-extrabold leading-6 text-slate-950">{ticket.eventName}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">{ticket.eventDate ?? "Date not provided"}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Sport</p><p className="mt-1 font-semibold text-slate-800">{ticket.sport}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Type</p><p className="mt-1 font-semibold text-slate-800">{ticketTypeLabel(listing)}</p></div>
            </div>
            <p className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950">{formatPrice(listing.askingPrice)}</p>
            <div className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-600">
              <p className="font-bold text-slate-800">{universities[listing.seller.universityId].name}</p>
              <p className="mt-1 font-semibold text-emerald-700">✓ Verified Student <span className="font-normal text-amber-700">(dev)</span></p>
              <p className="mt-1">{campusNetwork?.name ?? "Campus Network unavailable"} Campus Network</p>
            </div>
          </div>
        </button>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-4">
          <button type="button" onClick={() => onOpen(listing.id, "message")} className="rounded-xl px-3 py-2.5 text-xs font-bold" style={{ backgroundColor: theme.primary, color: theme.secondary }}>Message Seller</button>
          <button type="button" disabled={!offerAvailable} onClick={() => onOpen(listing.id, "offer")} className="rounded-xl border px-3 py-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400" style={offerAvailable ? { borderColor: theme.primary, color: theme.primary } : undefined}>Make Offer</button>
          <button type="button" aria-pressed={saved} onClick={() => onToggleSaved(listing.id)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700">{saved ? "♥ Saved" : "♡ Save"}</button>
          <button type="button" onClick={() => onOpen(listing.id, "report")} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700">Report</button>
        </div>
      </article>
    );
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden">
        <ListingPhoto listing={listing} />
        <button type="button" aria-label={saved ? `Remove ${listing.title} from saved` : `Save ${listing.title}`} aria-pressed={saved} onClick={() => onToggleSaved(listing.id)} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/95 text-xl shadow-sm" style={{ color: saved ? theme.primary : "#64748b" }}>
          <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
        </button>
      </div>

      <button type="button" onClick={() => onOpen(listing.id)} className="block w-full p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px]" style={{ outlineColor: theme.primary }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-extrabold tracking-tight text-slate-950">{formatPrice(listing.askingPrice)}</p>
            <h3 className="mt-1 font-semibold text-slate-900 group-hover:underline">{listing.title}</h3>
          </div>
          {listing.negotiable && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">Negotiable</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500"><span>{listing.category}</span><span aria-hidden="true">•</span><span>{listing.condition}</span></div>
        <p className="mt-3 text-sm text-slate-600">{listing.pickupArea} · {universities[listing.universityId].shortName}</p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
          <span className="font-semibold text-slate-700">✓ Verified Student <span className="font-normal text-amber-700">(dev)</span></span>
          <time className="text-slate-500" dateTime={listing.createdAt}>Posted {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(listing.createdAt))}</time>
        </div>
      </button>
    </article>
  );
}
