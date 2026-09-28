"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useCampusPreview } from "@/components/developer/CampusPreviewContext";
import { CloseButton } from "@/components/ui/CloseButton";
import { useModalLayer } from "@/hooks/useModalLayer";
import { conditionLabel } from "@/lib/marketplace/listing";
import type { MarketplaceListing } from "@/types/marketplace";

type Message = { id: string; buyer_id: string; sender_id: string; body: string; created_at: string };
export function QuickListingDetail({ listing, currentUserId, onClose, onStatusChange, readOnly: requestedReadOnly = false }: { listing: MarketplaceListing; currentUserId: string; onClose: () => void; onStatusChange: () => Promise<void>; readOnly?: boolean }) {
  const readOnly = useCampusPreview() || requestedReadOnly;
  const dialog = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [buyers, setBuyers] = useState<Array<{ user_id: string; first_name: string }>>([]);
  const [buyerId, setBuyerId] = useState("");
  const [messageOpen, setMessageOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const request = useRef({ id: crypto.randomUUID(), intent: "" });
  const own = listing.sellerId === currentUserId;
  useModalLayer(dialog, onClose);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (listing.isDevelopment) { setLoaded(true); return; }
    const response = await fetch(`/api/marketplace/messages?listingId=${encodeURIComponent(listing.id)}`, { cache: "no-store", signal });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Couldn’t load messages.");
    if (!signal?.aborted) { setMessages(payload.messages); setBuyers(payload.buyers); setLoaded(true); }
  }, [listing.id, listing.isDevelopment]);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => { if (document.visibilityState === "visible") void refresh(controller.signal).catch((error) => { if (!controller.signal.aborted) setError(error.message); }); };
    load(); const timer = setInterval(load, 15000); window.addEventListener("focus", load);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", load); };
  }, [refresh]);
  const selectedBuyer = own ? buyerId || buyers[0]?.user_id : currentUserId;
  const thread = messages.filter((message) => message.buyer_id === selectedBuyer);
  async function send(event: FormEvent) {
    event.preventDefault(); if (!body.trim() || busy || readOnly) return;
    setBusy(true); setError(null);
    const intent = JSON.stringify([selectedBuyer, body.trim()]);
    if (request.current.intent && request.current.intent !== intent) request.current.id = crypto.randomUUID();
    request.current.intent = intent;
    try {
      if (listing.isDevelopment) setMessages((current) => [...current, { id: request.current.id, buyer_id: selectedBuyer!, sender_id: currentUserId, body: body.trim(), created_at: new Date().toISOString() }]);
      else {
        const response = await fetch("/api/marketplace/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: listing.id, buyerId: selectedBuyer, body: body.trim(), requestId: request.current.id }) });
        const payload = await response.json(); if (!response.ok) throw new Error(payload.message ?? "Message wasn’t sent.");
        await refresh();
      }
      setBody(""); request.current = { id: crypto.randomUUID(), intent: "" }; input.current?.focus();
    } catch (error) { setError(error instanceof Error ? error.message : "Message wasn’t sent."); }
    finally { setBusy(false); }
  }
  return <div className="cm-overlay-backdrop fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}><section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="listing-title" className="cm-create-composer max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[1.75rem] bg-[var(--app-surface)] p-5 text-[var(--app-text-primary)]">
    <header className="flex items-start justify-between gap-4"><h2 id="listing-title" className="text-xl font-bold">{listing.title}</h2><CloseButton onClick={onClose}/></header>
    <p className="mt-3 text-2xl font-semibold text-[var(--app-accent)]">${listing.askingPrice.toFixed(2)}</p>
    <p className="mt-2 text-sm">{[listing.brand, conditionLabel(listing.condition)].filter(Boolean).join(" · ")}</p>
    <p className="mt-3 text-sm">Meet at {listing.pickupArea}</p><p className="mt-1 text-xs text-[var(--app-text-secondary)]">{own ? "Your listing" : listing.seller.firstName} · {listing.status === "sold" ? "Sold" : "Available"}</p>
    {own ? <><button type="button" disabled={busy || readOnly} className="mt-4 rounded-full py-2 text-sm text-[var(--app-accent)]" onClick={async () => { setBusy(true); try { if (listing.isDevelopment) await onStatusChange(); else { const response = await fetch("/api/marketplace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: listing.id, status: listing.status === "sold" ? "active" : "sold" }) }); if (!response.ok) throw new Error("Couldn’t update the listing."); await onStatusChange(); } } catch (error) { setError((error as Error).message); } finally { setBusy(false); } }}>{listing.status === "sold" ? "Mark available" : "Mark sold"}</button><h3 className="mt-4 text-sm font-semibold">Messages</h3>{buyers.length > 0 && <select aria-label="Buyer conversation" value={selectedBuyer} onChange={(e) => { setBuyerId(e.target.value); setBody(""); }} className="cm-composer-field mt-2 w-full rounded-2xl bg-[var(--app-surface-elevated)] p-3">{buyers.map((buyer) => <option key={buyer.user_id} value={buyer.user_id}>{buyer.first_name}</option>)}</select>}{loaded && !buyers.length && <p className="mt-2 text-sm text-[var(--app-text-secondary)]">No messages yet.</p>}</>
      : <button type="button" disabled={readOnly} onClick={() => setMessageOpen(!messageOpen)} aria-expanded={messageOpen} className="mt-4 rounded-full py-2 font-semibold text-[var(--app-accent)]">Message {listing.seller.firstName}</button>}
    {(own ? Boolean(selectedBuyer) : messageOpen) && <div className="cm-composer-reveal mt-3"><div className="max-h-52 space-y-2 overflow-y-auto" aria-label="Conversation">{thread.map((message) => <div key={message.id} className={`rounded-2xl p-3 text-sm ${message.sender_id === currentUserId ? "ml-6 bg-[var(--app-accent-soft)]" : "mr-6 bg-[var(--app-surface-elevated)]"}`}><span className="block whitespace-pre-wrap break-words">{message.body}</span><time className="mt-1 block text-[10px] text-[var(--app-text-secondary)]">{new Date(message.created_at).toLocaleString()}</time></div>)}</div><form onSubmit={send} className="mt-3 flex items-end gap-2"><textarea ref={input} aria-label="Message" placeholder="Write a message" maxLength={2000} rows={2} value={body} onChange={(e) => setBody(e.target.value)} className="cm-composer-field min-w-0 flex-1 resize-none rounded-2xl bg-[var(--app-surface-elevated)] p-3 text-base"/><button disabled={busy || readOnly || !body.trim()} className="rounded-full py-3 text-sm font-semibold text-[var(--app-accent)] disabled:opacity-40">{busy ? "Sending…" : "Send"}</button></form></div>}
    {error && <p role="alert" className="mt-3 text-sm text-[var(--app-danger)]">{error}</p>}
  </section></div>;
}
