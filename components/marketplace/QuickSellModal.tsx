"use client";
import { useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CloseButton } from "@/components/ui/CloseButton";
import { useModalLayer } from "@/hooks/useModalLayer";
import { parseQuickListing, quickListingInput } from "@/lib/marketplace/listing";
import type { NewMarketplaceListingInput } from "@/types/marketplace";

export function QuickSellModal({ areaLabel, onClose, onPublish }: { areaLabel?: string; onClose: () => void; onPublish: (input: NewMarketplaceListingInput, requestId: string) => Promise<void> }) {
  const dialog = useRef<HTMLElement>(null);
  const requestId = useRef(crypto.randomUUID());
  const lastInput = useRef("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useModalLayer(dialog, () => { if (!busy) onClose(); });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget);
    try {
      const input = quickListingInput(parseQuickListing({ title: data.get("title"), brand: data.get("brand"), askingPrice: Number(data.get("price")), condition: data.get("condition"), pickupArea: data.get("pickupArea") }));
      input.shareNearbyArea = data.get("shareNearbyArea") === "on";
      const signature = JSON.stringify(input);
      if (lastInput.current && lastInput.current !== signature) requestId.current = crypto.randomUUID();
      lastInput.current = signature;
      setBusy(true); setError(null);
      await onPublish(input, requestId.current); onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Couldn’t post this item. Your details are still here."); }
    finally { setBusy(false); }
  }
  const field = "cm-composer-field w-full rounded-2xl bg-[var(--app-surface-elevated)] px-3 py-3 text-base";
  return createPortal(<div className="cm-overlay-backdrop fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sell-title" className="cm-create-composer max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[1.75rem] bg-[var(--app-surface)] p-5 text-[var(--app-text-primary)]">
      <header className="mb-4 flex items-center justify-between"><h2 id="sell-title" className="text-lg font-bold">Post item</h2><CloseButton onClick={() => { if (!busy) onClose(); }} /></header>
      <form onSubmit={submit}><fieldset disabled={busy} className="space-y-3">
        <label className="block text-xs">Item name<input data-initial-focus name="title" required minLength={2} maxLength={100} placeholder="What are you selling?" className={field} /></label>
        <div className="grid grid-cols-2 gap-3"><label className="block text-xs">Price ($)<input name="price" type="number" inputMode="decimal" required min={0} max={999999} step="0.01" placeholder="0.00" className={field}/></label><label className="block text-xs">Brand <span className="text-[var(--app-text-secondary)]">(optional)</span><input name="brand" maxLength={80} className={field}/></label></div>
        <label className="block text-xs">Condition<select name="condition" defaultValue="Good" className={field}><option value="New">New</option><option value="Like New">Used – Like New</option><option value="Good">Used</option></select></label>
        <label className="block text-xs">Meetup location<input name="pickupArea" required minLength={2} maxLength={120} placeholder="e.g. Student center" className={field}/></label>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" name="shareNearbyArea" className="mt-0.5"/><span>Show nearby · {areaLabel ?? "Near campus"}<span className="mt-1 block text-[var(--app-text-secondary)]">Approximate area · off: only you</span></span></label>
        <div className="flex justify-end"><button disabled={busy} type="submit" className="rounded-full px-4 py-2 font-semibold text-[var(--app-accent)]">{busy ? "Posting…" : "Post item"}</button></div>
      </fieldset>{error && <p role="alert" className="mt-3 text-sm text-[var(--app-danger)]">{error}</p>}</form>
    </section></div>, document.body);
}
