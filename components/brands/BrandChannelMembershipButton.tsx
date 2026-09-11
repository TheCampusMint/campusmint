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
  return <div><button type="button" onClick={toggle} disabled={pending} aria-pressed={joined} className="rounded-full bg-[#6f1d2c] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{pending ? "Saving…" : joined ? "Leave Channel" : "Join Channel"}</button>{message && <p role="status" className="mt-2 text-xs text-[#725d63]">{message}</p>}</div>;
}
