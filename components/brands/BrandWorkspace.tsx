"use client";

import { useState } from "react";
import { configuredUniversityIds, universities } from "@/data/universities";
import { eventCategories, type EventCategory } from "@/types/event";
import type { BrandSessionProfile } from "@/types/accountSession";

type BrandEventDraft = {
  title: string; description: string; campusId: string; category: EventCategory;
  startsAt: string; endsAt: string; location: string; address: string; city: string;
  latitude: string; longitude: string;
};

const emptyEvent: BrandEventDraft = {
  title: "", description: "", campusId: "tamu", category: "Social", startsAt: "", endsAt: "",
  location: "", address: "", city: "", latitude: "", longitude: "",
};

export function BrandWorkspace({ brand, onLogout }: { brand: BrandSessionProfile; onLogout: () => void }) {
  const [draft, setDraft] = useState("");
  const [posts, setPosts] = useState<Array<{ id: string; body: string; created_at: string }>>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [eventDraft, setEventDraft] = useState<BrandEventDraft>(emptyEvent);
  const [eventPending, setEventPending] = useState(false);
  const [eventMessage, setEventMessage] = useState<string | null>(null);

  async function publish(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setMessage(null);
    const response = await fetch("/api/brand/channel/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: draft }) });
    const result = await response.json().catch(() => null) as { ok?: boolean; message?: string; post?: { id: string; body: string; created_at: string } } | null;
    setPending(false);
    if (!response.ok || !result?.ok || !result.post) { setMessage(result?.message ?? "We couldn't publish that post."); return; }
    setPosts((current) => [result.post!, ...current]); setDraft(""); setMessage("Published to your Channel.");
  }

  async function publishEvent(submitEvent: React.FormEvent) {
    submitEvent.preventDefault(); setEventPending(true); setEventMessage(null);
    const response = await fetch("/api/brand/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...eventDraft, latitude: Number(eventDraft.latitude), longitude: Number(eventDraft.longitude) }),
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; message?: string; event?: { id: string } } | null;
    setEventPending(false);
    if (!response.ok || !result?.ok) { setEventMessage(result?.message ?? "We couldn't publish that event."); return; }
    setEventDraft(emptyEvent); setEventMessage("Event published to Campus Mint Events.");
  }

  return <main className="min-h-dvh bg-[#f8f3f2] px-5 py-8 text-[#2a171b]"><div className="mx-auto max-w-2xl space-y-5">
    <header className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#6f1d2c]">The Campus Mint · Brand</p><h1 className="mt-2 text-3xl font-black">{brand.displayName}</h1><p className="mt-1 text-sm text-[#725d63]">@{brand.username}</p></div><button type="button" onClick={onLogout} className="rounded-full border border-[#dfced1] px-4 py-2 text-xs font-black">Sign out</button></header>
    <section className="rounded-[1.75rem] border border-[#dfced1] bg-[#fffaf9] p-5"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">Brand profile</h2>{brand.verificationStatus === "verified" ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700">Verified Brand</span> : <span className="rounded-full bg-[#f0dfe3] px-2 py-1 text-[9px] font-black uppercase text-[#6f1d2c]">{brand.verificationStatus}</span>}</div>{brand.bio && <p className="mt-3 text-sm leading-6 text-[#725d63]">{brand.bio}</p>}{brand.websiteUrl && <a href={brand.websiteUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-bold text-[#6f1d2c] underline underline-offset-4">Visit external website ↗</a>}{brand.businessCategory && <p className="mt-3 text-xs font-semibold text-[#725d63]">{brand.businessCategory}</p>}</section>
    <section className="rounded-[1.75rem] border border-[#dfced1] bg-[#fffaf9] p-5"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#6f1d2c]">Brand Channel</p><h2 className="mt-2 text-xl font-black">{brand.channel?.name ?? "Channel setup pending"}</h2>{brand.channel && <p className="mt-1 text-sm text-[#725d63]">/channels/{brand.channel.handle}</p>}{brand.channel && <form onSubmit={publish} className="mt-5 space-y-3"><label className="text-xs font-black">Publish an update<textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={10_000} rows={4} placeholder="Discount, announcement, launch, or useful information…" className="mt-2 w-full resize-none rounded-2xl border border-[#dfced1] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-[#6f1d2c]"/></label><button disabled={pending || !draft.trim()} className="rounded-full bg-[#6f1d2c] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{pending ? "Publishing…" : "Publish to Channel"}</button></form>}{message && <p role="status" className="mt-3 text-xs font-semibold text-[#725d63]">{message}</p>}</section>
    <details className="rounded-[1.75rem] border border-[#dfced1] bg-[#fffaf9] p-5"><summary className="cursor-pointer text-lg font-black">Publish a local event</summary><p className="mt-2 text-xs leading-5 text-[#725d63]">Only real public happenings inside the selected campus radius are eligible. Venue coordinates are required for this first release.</p><form onSubmit={publishEvent} className="mt-5 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-black sm:col-span-2">Event title<input required maxLength={240} value={eventDraft.title} onChange={(event) => setEventDraft((current) => ({ ...current, title: event.target.value }))} className="mt-1 w-full rounded-xl border border-[#dfced1] bg-white p-3 text-sm"/></label>
      <label className="text-xs font-black sm:col-span-2">Short description<textarea required maxLength={600} rows={3} value={eventDraft.description} onChange={(event) => setEventDraft((current) => ({ ...current, description: event.target.value }))} className="mt-1 w-full rounded-xl border border-[#dfced1] bg-white p-3 text-sm"/></label>
      <label className="text-xs font-black">Campus<select value={eventDraft.campusId} onChange={(event) => setEventDraft((current) => ({ ...current, campusId: event.target.value }))} className="mt-1 w-full rounded-xl border border-[#dfced1] bg-white p-3 text-sm">{configuredUniversityIds.map((id) => <option key={id} value={id}>{universities[id].shortName}</option>)}</select></label>
      <label className="text-xs font-black">Category<select value={eventDraft.category} onChange={(event) => setEventDraft((current) => ({ ...current, category: event.target.value as EventCategory }))} className="mt-1 w-full rounded-xl border border-[#dfced1] bg-white p-3 text-sm">{eventCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="text-xs font-black">Starts<input required type="datetime-local" value={eventDraft.startsAt} onChange={(event) => setEventDraft((current) => ({ ...current, startsAt: event.target.value }))} className="mt-1 w-full rounded-xl border border-[#dfced1] bg-white p-3 text-sm"/></label>
      <label className="text-xs font-black">Ends (optional)<input type="datetime-local" value={eventDraft.endsAt} onChange={(event) => setEventDraft((current) => ({ ...current, endsAt: event.target.value }))} className="mt-1 w-full rounded-xl border border-[#dfced1] bg-white p-3 text-sm"/></label>
      <label className="text-xs font-black sm:col-span-2">Venue<input required maxLength={240} value={eventDraft.location} onChange={(event) => setEventDraft((current) => ({ ...current, location: event.target.value }))} className="mt-1 w-full rounded-xl border border-[#dfced1] bg-white p-3 text-sm"/></label>
      <label className="text-xs font-black">Address<input maxLength={300} value={eventDraft.address} onChange={(event) => setEventDraft((current) => ({ ...current, address: event.target.value }))} className="mt-1 w-full rounded-xl border border-[#dfced1] bg-white p-3 text-sm"/></label>
      <label className="text-xs font-black">City<input maxLength={120} value={eventDraft.city} onChange={(event) => setEventDraft((current) => ({ ...current, city: event.target.value }))} className="mt-1 w-full rounded-xl border border-[#dfced1] bg-white p-3 text-sm"/></label>
      <label className="text-xs font-black">Latitude<input required inputMode="decimal" value={eventDraft.latitude} onChange={(event) => setEventDraft((current) => ({ ...current, latitude: event.target.value }))} placeholder="30.6187" className="mt-1 w-full rounded-xl border border-[#dfced1] bg-white p-3 text-sm"/></label>
      <label className="text-xs font-black">Longitude<input required inputMode="decimal" value={eventDraft.longitude} onChange={(event) => setEventDraft((current) => ({ ...current, longitude: event.target.value }))} placeholder="-96.3365" className="mt-1 w-full rounded-xl border border-[#dfced1] bg-white p-3 text-sm"/></label>
      <button disabled={eventPending} className="rounded-full bg-[#6f1d2c] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 sm:col-span-2">{eventPending ? "Publishing…" : "Publish event"}</button>
    </form>{eventMessage && <p role="status" className="mt-3 text-xs font-semibold text-[#725d63]">{eventMessage}</p>}</details>
    {posts.map((post) => <article key={post.id} className="rounded-[1.5rem] border border-[#dfced1] bg-[#fffaf9] p-5"><p className="text-sm leading-6">{post.body}</p><time className="mt-3 block text-[10px] font-semibold text-[#725d63]" dateTime={post.created_at}>Just published</time></article>)}
    <p className="text-xs leading-5 text-[#725d63]">Brand Channels are brand-led publishing spaces, separate from student Groups. Event posts require a real time, location, and eligible campus radius before they can enter Events.</p>
  </div></main>;
}
