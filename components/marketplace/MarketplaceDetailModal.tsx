"use client";

import { useState, type FormEvent } from "react";

import { MarketplacePhotoPlaceholder } from "@/components/marketplace/MarketplacePhotoPlaceholder";
import { MintLeafBackButton } from "@/components/ui/MintLeafBackButton";
import { getCampusNetwork } from "@/data/campusNetworks";
import { universities, type UniversityTheme } from "@/data/universities";
import type { MarketplaceListing, MarketplaceListingStatus, MarketplaceMessage, MarketplaceOffer, MarketplaceReportReason } from "@/types/marketplace";

export type MarketplaceDetailPanel = "none" | "offer" | "message" | "report";

type MarketplaceDetailModalProps = {
  listing: MarketplaceListing;
  theme: UniversityTheme;
  currentUserId: string;
  saved: boolean;
  activeOffer?: MarketplaceOffer;
  messages: MarketplaceMessage[];
  alreadyReported: boolean;
  initialPanel?: MarketplaceDetailPanel;
  onClose: () => void;
  closeLabel?: string;
  onToggleSaved: () => void;
  onSendOffer: (amount: number, note: string | null) => void;
  onWithdrawOffer: (offerId: string) => void;
  onSendMessage: (body: string) => void;
  onReport: (reason: MarketplaceReportReason, details: string) => void;
  onBlockSeller: () => void;
  onUpdateStatus: (status: MarketplaceListingStatus) => void;
  onOpenSellerProfile?: (userId: string) => void;
};

const sellerStatuses: MarketplaceListingStatus[] = ["active", "reserved", "sold", "removed"];

function priceLabel(price: number) {
  return price === 0 ? "Price not set" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);
}

function ticketTypeLabel(listing: MarketplaceListing) {
  const ticket = listing.sportsTicket;
  if (!ticket) return "Ticket / Pass";
  return ticket.ticketType === "Other" ? ticket.customTicketType ?? "Other" : ticket.ticketType;
}

function statusLabel(status: MarketplaceListingStatus) {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

export function MarketplaceDetailModal(props: MarketplaceDetailModalProps) {
  const { listing, theme, currentUserId, saved, activeOffer, messages, alreadyReported } = props;
  const [panel, setPanel] = useState<MarketplaceDetailPanel>(props.initialPanel ?? "none");
  const [offerAmount, setOfferAmount] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [message, setMessage] = useState("");
  const [reportReason, setReportReason] = useState<MarketplaceReportReason>("prohibited_item");
  const [reportDetails, setReportDetails] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const ownListing = listing.sellerId === currentUserId;
  const ticket = listing.sportsTicket;
  const campusNetwork = getCampusNetwork(listing.campusNetworkId);
  const transactionActionsAllowed = !ownListing;
  const offerActionsAllowed = transactionActionsAllowed && listing.status === "active" && listing.negotiable;

  function submitOffer(event: FormEvent) {
    event.preventDefault();
    const amount = Number(offerAmount);
    if (!Number.isFinite(amount) || amount <= 0) return setFeedback("Enter a valid offer amount.");
    props.onSendOffer(amount, offerNote.trim() || null);
    setFeedback("Offer sent for this session. No payment has been processed.");
  }

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    props.onSendMessage(message.trim());
    setMessage("");
    setFeedback("Message added to this local placeholder conversation.");
  }

  function submitReport(event: FormEvent) {
    event.preventDefault();
    props.onReport(reportReason, reportDetails.trim());
    setFeedback("Report saved locally for this development session.");
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="marketplace-detail-title" className="mx-auto my-2 max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase text-amber-800">Development listing</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase text-slate-700">{statusLabel(listing.status)}</span><span className="text-xs text-slate-500">No real seller or item</span></div>
          {props.closeLabel ? (
            <MintLeafBackButton onClick={props.onClose} label={props.closeLabel} />
          ) : (
            <button type="button" onClick={props.onClose} aria-label="Close" title="Close" className="cm-icon-control flex items-center justify-center border border-slate-200 text-xl text-slate-600">×</button>
          )}
        </div>

        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r sm:p-7">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200"><MarketplacePhotoPlaceholder category={listing.category} /></div>
            <div className="mt-3 grid grid-cols-4 gap-2">{listing.photos.map((photo) => <div key={photo.id} title={photo.alt} className="aspect-square overflow-hidden rounded-xl border-2" style={{ borderColor: theme.primary }}><MarketplacePhotoPlaceholder category={listing.category} compact /></div>)}</div>
            <div className="mt-7">
              <div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{listing.category}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{listing.condition}</span>{listing.negotiable && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Negotiable</span>}</div>
              <h2 id="marketplace-detail-title" className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950">{ticket?.eventName ?? listing.title}</h2>
              {ticket && <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">Notes</p>}
              <p className={ticket ? "mt-1 text-sm leading-7 text-slate-600" : "mt-4 text-sm leading-7 text-slate-600"}>{listing.description}</p>
              {ticket ? <dl className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2">
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Event</dt><dd className="mt-1 font-semibold text-slate-900">{ticket.eventName}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Sport</dt><dd className="mt-1 font-semibold text-slate-900">{ticket.sport}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Date</dt><dd className="mt-1 font-semibold text-slate-900">{ticket.eventDate ?? "Not provided"}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Ticket / pass type</dt><dd className="mt-1 font-semibold text-slate-900">{ticketTypeLabel(listing)}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Quantity</dt><dd className="mt-1 font-semibold text-slate-900">{ticket.quantity}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Asking price</dt><dd className="mt-1 font-semibold text-slate-900">{priceLabel(listing.askingPrice)}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Negotiable</dt><dd className="mt-1 font-semibold text-slate-900">{listing.negotiable ? "Yes" : "No"}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Seller</dt><dd className="mt-1 font-semibold text-slate-900">{listing.seller.firstName}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Seller university</dt><dd className="mt-1 font-semibold text-slate-900">{universities[listing.seller.universityId].name}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Campus Network</dt><dd className="mt-1 font-semibold text-slate-900">{campusNetwork?.name ?? "Unavailable"}</dd></div>
                {ticket.seatDetails && <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Seat / section</dt><dd className="mt-1 font-semibold text-slate-900">{ticket.seatDetails}</dd></div>}
                {ticket.transferNotes && <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Meetup / transfer notes</dt><dd className="mt-1 font-semibold text-slate-900">{ticket.transferNotes}</dd></div>}
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Listing created</dt><dd className="mt-1 font-semibold text-slate-900"><time dateTime={listing.createdAt}>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(listing.createdAt))}</time></dd></div>
              </dl> : <dl className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2">
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">University</dt><dd className="mt-1 font-semibold text-slate-900">{universities[listing.universityId].name}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Campus Network</dt><dd className="mt-1 font-semibold text-slate-900">{campusNetwork?.name ?? "Unavailable"}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Approximate meetup</dt><dd className="mt-1 font-semibold text-slate-900">{listing.pickupArea}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Delivery</dt><dd className="mt-1 font-semibold text-slate-900">{listing.deliveryAvailable ? "Available" : "Not offered"}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Posted</dt><dd className="mt-1 font-semibold text-slate-900"><time dateTime={listing.createdAt}>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(listing.createdAt))}</time></dd></div>
              </dl>}
            </div>
          </div>

          <aside className="p-5 sm:p-7">
            <p className="text-3xl font-extrabold tracking-tight text-slate-950">{priceLabel(listing.askingPrice)}</p>
            <p className="mt-1 text-sm text-slate-500">No payment processing is connected.</p>
            {ticket && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">Campus Mint is a student marketplace and does not issue or transfer tickets.</p><p className="mt-1 leading-5">Buyers and sellers are responsible for completing any transfer in accordance with applicable university and ticketing rules.</p><p className="mt-2 text-xs leading-5">{theme.marketplace.ticketTransferMethod}</p></div>}

            <div className="mt-5 grid gap-3">
              <button type="button" disabled={!transactionActionsAllowed} onClick={() => setPanel("message")} className="rounded-xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500" style={transactionActionsAllowed ? { backgroundColor: theme.primary, color: theme.secondary } : undefined}>Message Seller</button>
              <button type="button" disabled={!offerActionsAllowed} onClick={() => setPanel("offer")} className="rounded-xl border px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400" style={offerActionsAllowed ? { borderColor: theme.primary, color: theme.primary } : undefined}>{activeOffer ? "View Offer" : "Make Offer"}</button>
              <div className="grid grid-cols-2 gap-3"><button type="button" aria-pressed={saved} onClick={props.onToggleSaved} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{saved ? "♥ Saved" : "♡ Save"}</button><button type="button" onClick={() => setPanel("report")} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Report</button></div>
            </div>

            {ownListing && <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-bold text-slate-900">Seller controls</h3><p className="mt-1 text-xs leading-5 text-slate-500">Reserved listings remain visible with their status. Sold and removed listings no longer appear in Marketplace results.</p><label className="mt-3 block text-sm font-semibold text-slate-700">Listing status<select value={listing.status} onChange={(event) => props.onUpdateStatus(event.target.value as MarketplaceListingStatus)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal">{sellerStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label></section>}

            <section className="mt-7 rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full font-bold" style={{ backgroundColor: theme.accent, color: theme.primary }}>DS</div><div><p className="font-bold text-slate-900">{listing.seller.firstName}</p><p className="text-xs text-slate-500">{universities[listing.seller.universityId].name}</p><p className="mt-1 text-xs font-semibold text-emerald-700">✓ Verified Student <span className="text-amber-700">(development simulation)</span></p></div></div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-500">Completed sales</p><p className="mt-1 font-bold text-slate-900">{listing.seller.completedSales}</p></div><div><p className="text-xs text-slate-500">Reputation</p><p className="mt-1 font-semibold text-slate-600">No marketplace ratings yet</p></div></div>
              {props.onOpenSellerProfile && <button type="button" onClick={() => { props.onClose(); props.onOpenSellerProfile?.(listing.sellerId); }} className="mt-4 w-full rounded-xl border px-4 py-2.5 text-sm font-bold" style={{ borderColor: theme.primary, color: theme.primary }}>View seller profile</button>}
            </section>

            {panel === "offer" && <section className="mt-5 rounded-2xl bg-slate-50 p-4"><h3 className="font-bold text-slate-900">Your offer</h3>{activeOffer ? <div className="mt-3"><p className="text-2xl font-bold text-slate-950">{priceLabel(activeOffer.amount)}</p>{activeOffer.note && <p className="mt-2 rounded-xl bg-white p-3 text-sm text-slate-600">{activeOffer.note}</p>}<p className="mt-2 text-xs text-slate-500">Sent locally · no payment or seller response</p><button type="button" onClick={() => props.onWithdrawOffer(activeOffer.id)} className="mt-3 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Withdraw offer</button></div> : <form onSubmit={submitOffer} className="mt-3 space-y-3"><label className="text-sm font-semibold text-slate-700">Offer amount<input value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} type="number" min="0.01" step="0.01" className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3" /></label><label className="text-sm font-semibold text-slate-700">Optional note<textarea value={offerNote} maxLength={500} onChange={(event) => setOfferNote(event.target.value)} rows={3} placeholder="Add timing or negotiation context." className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-3 font-normal" /></label><button className="w-full rounded-xl px-4 py-3 text-sm font-bold" style={{ backgroundColor: theme.primary, color: theme.secondary }}>Send local offer</button></form>}</section>}

            {panel === "message" && <section className="mt-5 rounded-2xl bg-slate-50 p-4"><h3 className="font-bold text-slate-900">Placeholder conversation</h3>{ticket && <p className="mt-1 text-xs leading-5 text-slate-500">Discuss price, timing, meetup, and the appropriate outside transfer method. Never send scannable codes or credentials here.</p>}<div className="mt-3 max-h-36 space-y-2 overflow-y-auto">{messages.length ? messages.map((item) => <p key={item.id} className="rounded-xl bg-white p-3 text-sm text-slate-700">{item.body}</p>) : <p className="text-sm text-slate-500">No messages in this session.</p>}</div><form onSubmit={submitMessage} className="mt-3"><label className="sr-only" htmlFor={`message-${listing.id}`}>Message seller</label><textarea id={`message-${listing.id}`} value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="Ask about the item or a safe meetup area…" className="block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm" /><button className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold" style={{ backgroundColor: theme.primary, color: theme.secondary }}>Send local message</button></form></section>}

            {panel === "report" && <section className="mt-5 rounded-2xl bg-slate-50 p-4"><h3 className="font-bold text-slate-900">Trust & safety</h3>{alreadyReported ? <p className="mt-2 text-sm text-slate-600">You reported this listing during this session.</p> : <form onSubmit={submitReport} className="mt-3 space-y-3"><label className="text-sm font-semibold text-slate-700">Reason<select value={reportReason} onChange={(event) => setReportReason(event.target.value as MarketplaceReportReason)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2"><option value="prohibited_item">Report prohibited item</option><option value="fraud_or_scam">Fraud or scam</option><option value="ticket_concern">Ticket concern</option><option value="misleading_listing">Misleading listing</option><option value="other">Other</option></select></label><label className="text-sm font-semibold text-slate-700">Optional details<textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} rows={3} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-3 font-normal" /></label><button className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Submit local report</button></form>}<button type="button" onClick={() => { props.onBlockSeller(); setFeedback("Seller blocked for this session."); }} className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Block seller</button></section>}
            {feedback && <p aria-live="polite" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{feedback}</p>}
          </aside>
        </div>
      </div>
    </div>
  );
}
