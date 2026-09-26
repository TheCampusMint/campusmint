"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BrandChannelMembershipButton({ channelId, initiallyJoined }: { channelId: string; initiallyJoined: boolean }) {
  const router = useRouter();
  const [joined, setJoined] = useState(initiallyJoined);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function toggle() {
    setPending(true); setMessage(null);
    const response = await fetch(`/api/brand/channels/${channelId}/membership`, { method: joined ? "DELETE" : "POST" });
    const result = await response.json().catch(() => null) as { ok?: boolean; joined?: boolean; message?: string } | null;
    setPending(false);
    if (!response.ok || !result?.ok || typeof result.joined !== "boolean") { setMessage(result?.message ?? "Channel membership is temporarily unavailable."); return; }
    setJoined(result.joined); router.refresh();
  }
  return <div><button type="button" onClick={toggle} disabled={pending} aria-pressed={joined} className="rounded-full bg-[var(--app-accent)] px-5 py-2.5 text-sm font-black text-[var(--app-accent-contrast)] disabled:opacity-50">{pending ? "Saving…" : joined ? "Leave Channel" : "Join Channel"}</button>{message && <p role="status" className="mt-2 text-xs text-[var(--app-text-secondary)]">{message}</p>}</div>;
}
