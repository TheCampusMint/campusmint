"use client";

import { useMemo, useState, type FormEvent } from "react";

import type { CampusNetwork } from "@/data/campusNetworks";
import { sampleEvents } from "@/data/events";
import { safeMeetupAreas } from "@/data/marketplace";
import { universities, type UniversityId, type UniversityTheme } from "@/data/universities";
import { checkMarketplaceListingSafety, prohibitedMarketplaceItems } from "@/lib/marketplaceSafety";
import {
  marketplaceCategories,
  marketplaceConditions,
  marketplaceTicketPassTypes,
  type MarketplaceCategory,
  type MarketplaceCondition,
  type MarketplaceTicketPassType,
  type NewMarketplaceListingInput,
} from "@/types/marketplace";

const marketplaceSports = ["Football", "Basketball", "Baseball", "Softball", "Soccer", "Volleyball", "Other"] as const;
const customEventValue = "custom-event";

type SellListingModalProps = {
  universityId: UniversityId;
  campusNetwork: CampusNetwork;
  theme: UniversityTheme;
  onClose: () => void;
  onCreate: (listing: NewMarketplaceListingInput) => void;
};

export function SellListingModal({ universityId, campusNetwork, theme, onClose, onCreate }: SellListingModalProps) {
  const [category, setCategory] = useState<MarketplaceCategory>("Textbooks");
  const [condition, setCondition] = useState<MarketplaceCondition>("Good");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [pickupArea, setPickupArea] = useState<(typeof safeMeetupAreas)[number]>("Campus");
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [sport, setSport] = useState<(typeof marketplaceSports)[number]>("Football");
  const [customSport, setCustomSport] = useState("");
  const [eventId, setEventId] = useState("");
  const [customEventName, setCustomEventName] = useState("");
  const [customEventDate, setCustomEventDate] = useState("");
  const [ticketType, setTicketType] = useState<MarketplaceTicketPassType>("Student Sports Pass");
  const [customTicketType, setCustomTicketType] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [seatDetails, setSeatDetails] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSportsListing = category === "Sports Passes / Tickets";
  const sportsListingEnabled = theme.marketplace.ticketMarketplaceEnabled;
  const networkSportsEvents = useMemo(() => sampleEvents.filter((item) =>
    item.category === "Sports" && campusNetwork.universityIds.includes(item.campus as UniversityId)
  ), [campusNetwork.universityIds]);
  const selectedEvent = networkSportsEvents.find((item) => item.id === eventId) ?? null;

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) return setError("Enter a valid non-negative price.");

    if (isSportsListing) {
      if (!sportsListingEnabled) return setError("Sports ticket listing creation is not configured for this university yet.");
      const resolvedSport = sport === "Other" ? customSport.trim() : sport;
      const resolvedEventName = selectedEvent?.title ?? customEventName.trim();
      const resolvedEventDate = selectedEvent?.date ?? (customEventDate || null);
      const resolvedTicketType = ticketType === "Other" ? customTicketType.trim() : ticketType;
      const parsedQuantity = Number(quantity);
      if (!resolvedSport) return setError("Add the sport.");
      if (!resolvedEventName) return setError("Select an event or enter an event name.");
      if (!resolvedTicketType) return setError("Enter the ticket or pass type.");
      if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) return setError("Quantity must be at least 1.");
      if (!description.trim()) return setError("Add notes that accurately describe the listing.");
      const derivedTitle = `${resolvedEventName} — ${resolvedTicketType}`;
      const safety = checkMarketplaceListingSafety(derivedTitle, description, category);
      if (!safety.allowed) return setError(safety.message);
      onCreate({
        title: derivedTitle,
        description: description.trim(),
        category,
        condition: "Ticket / Pass",
        askingPrice: parsedPrice,
        negotiable,
        pickupArea: "Transfer arranged in messages",
        deliveryAvailable: false,
        sportsTicket: {
          sport: resolvedSport,
          eventId: selectedEvent?.id ?? null,
          eventName: resolvedEventName,
          eventDate: resolvedEventDate,
          ticketType,
          customTicketType: ticketType === "Other" ? resolvedTicketType : null,
          quantity: parsedQuantity,
          seatDetails: seatDetails.trim() || null,
          transferNotes: transferNotes.trim() || null,
        },
      });
      return;
    }

    if (!title.trim() || !description.trim()) return setError("Add a title and description.");
    const safety = checkMarketplaceListingSafety(title, description, category);
    if (!safety.allowed) return setError(safety.message);
    onCreate({
      title: title.trim(), description: description.trim(), category,
      condition: category === "Services" ? "Service" : condition,
      askingPrice: parsedPrice, negotiable, pickupArea, deliveryAvailable,
      sportsTicket: null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="sell-listing-title" className="mx-auto my-4 max-w-3xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: theme.primary }}>Local development flow</p><h2 id="sell-listing-title" className="mt-1 text-2xl font-bold text-slate-950">Sell something</h2><p className="mt-1 text-sm text-slate-500">Your listing stays in this browser session only.</p></div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Close</button>
        </div>

        <form onSubmit={submit} className="space-y-5 p-6">
          <div className={isSportsListing ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
            <label className="text-sm font-semibold text-slate-700">Category<select value={category} onChange={(event) => setCategory(event.target.value as MarketplaceCategory)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal">{marketplaceCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
            {!isSportsListing && <label className="text-sm font-semibold text-slate-700">Condition<select value={condition} disabled={category === "Services"} onChange={(event) => setCondition(event.target.value as MarketplaceCondition)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal disabled:bg-slate-100">{marketplaceConditions.filter((item) => item !== "Ticket / Pass" && item !== "Service").map((item) => <option key={item}>{item}</option>)}</select></label>}
          </div>

          {isSportsListing ? <>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">University / Campus Network</p>
              <p className="mt-2 font-bold text-slate-900">{universities[universityId].name}</p>
              <p className="mt-1 text-sm text-slate-600">{campusNetwork.name} Campus Network</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-bold">Campus Mint is for discovery and negotiation only.</p>
              <p className="mt-1 leading-5">Campus Mint does not issue or transfer tickets. Complete any permitted transfer outside Campus Mint under applicable university and ticketing rules.</p>
              {!sportsListingEnabled && <p className="mt-2 font-semibold">Sports ticket listing creation is not configured for this university yet.</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Sport<select value={sport} onChange={(event) => setSport(event.target.value as typeof sport)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal">{marketplaceSports.map((item) => <option key={item}>{item}</option>)}</select></label>
              {sport === "Other" && <label className="text-sm font-semibold text-slate-700">Custom sport<input value={customSport} maxLength={60} onChange={(event) => setCustomSport(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>}
              <label className="text-sm font-semibold text-slate-700">Event<select value={eventId} onChange={(event) => setEventId(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal"><option value="">Select an event</option>{networkSportsEvents.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.date}</option>)}<option value={customEventValue}>Other / enter manually</option></select></label>
              {eventId === customEventValue && <><label className="text-sm font-semibold text-slate-700">Event name<input value={customEventName} maxLength={100} onChange={(event) => setCustomEventName(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label><label className="text-sm font-semibold text-slate-700">Event date <span className="font-normal text-slate-400">(optional)</span><input value={customEventDate} onChange={(event) => setCustomEventDate(event.target.value)} type="date" className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label></>}
              <label className="text-sm font-semibold text-slate-700">Ticket / pass type<select value={ticketType} onChange={(event) => setTicketType(event.target.value as MarketplaceTicketPassType)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal">{marketplaceTicketPassTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
              {ticketType === "Other" && <label className="text-sm font-semibold text-slate-700">Custom ticket / pass type<input value={customTicketType} maxLength={80} onChange={(event) => setCustomTicketType(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>}
              <label className="text-sm font-semibold text-slate-700">Quantity<input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min="1" step="1" className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
              <label className="text-sm font-semibold text-slate-700">Asking price (USD)<input value={price} onChange={(event) => setPrice(event.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700"><input type="checkbox" checked={negotiable} onChange={(event) => setNegotiable(event.target.checked)} />Open to offers</label>
            <label className="block text-sm font-semibold text-slate-700">Notes<textarea value={description} maxLength={1200} rows={4} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what is included and any important restrictions. Never include a ticket code or transfer credential." className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
            <label className="block text-sm font-semibold text-slate-700">Seat / section information <span className="font-normal text-slate-400">(optional)</span><input value={seatDetails} maxLength={120} onChange={(event) => setSeatDetails(event.target.value)} placeholder="Section or general location only" className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
            <label className="block text-sm font-semibold text-slate-700">Meetup / transfer notes <span className="font-normal text-slate-400">(optional)</span><textarea value={transferNotes} maxLength={500} rows={3} onChange={(event) => setTransferNotes(event.target.value)} placeholder="Discuss timing or the appropriate outside transfer method. Do not paste credentials." className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5"><p className="font-bold text-red-900">No QR codes, barcodes, or transfer credentials</p><p className="mt-1 text-sm leading-5 text-red-800">Sports listings cannot upload scannable codes, screenshots containing them, or account-transfer credentials. Generic event imagery and non-scannable seat information may be supported later.</p></div>
          </> : <>
            <label className="block text-sm font-semibold text-slate-700">Title<input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="What are you selling?" className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
            <label className="block text-sm font-semibold text-slate-700">Description<textarea value={description} maxLength={1200} rows={5} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the item honestly. Do not include a full home address." className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Price (USD)<input value={price} onChange={(event) => setPrice(event.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="mt-1 block w-full rounded-xl border border-slate-200 px-4 py-3 font-normal" /></label>
              <label className="text-sm font-semibold text-slate-700">Approximate meetup area<select value={pickupArea} onChange={(event) => setPickupArea(event.target.value as typeof pickupArea)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal">{safeMeetupAreas.map((area) => <option key={area}>{area}</option>)}</select></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700"><input type="checkbox" checked={negotiable} onChange={(event) => setNegotiable(event.target.checked)} />Open to offers</label><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700"><input type="checkbox" checked={deliveryAvailable} onChange={(event) => setDeliveryAvailable(event.target.checked)} />Delivery available</label></div>
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center"><p className="font-semibold text-slate-700">Photo upload placeholder</p><p className="mt-1 text-xs text-slate-500">Secure uploads will be enabled with verified accounts and storage.</p><button type="button" disabled className="mt-3 cursor-not-allowed rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">Add photos later</button></div>
          </>}

          <details className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><summary className="cursor-pointer font-semibold text-slate-800">Prohibited items and services</summary><p className="mt-2 leading-5">Campus Mint blocks categories including {prohibitedMarketplaceItems.map((item) => item.label.toLowerCase()).join(", ")}.</p></details>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" className="rounded-xl px-5 py-3 text-sm font-bold" style={{ backgroundColor: theme.primary, color: theme.secondary }}>Publish local listing</button></div>
        </form>
      </div>
    </div>
  );
}
