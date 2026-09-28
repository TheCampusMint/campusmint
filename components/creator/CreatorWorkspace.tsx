"use client";

import type { CreatorSessionProfile } from "@/types/accountSession";
import { CreatorBadge } from "@/components/creator/CreatorBadge";

export function CreatorWorkspace({ creator, onLogout }: { creator: CreatorSessionProfile; onLogout: () => void }) {
  const status = creator.application?.status ?? "pending";
  return <main className="cm-themed-portal min-h-dvh bg-[var(--app-background,#f7f1f2)] px-5 py-12 text-[var(--app-text-primary,#2a171b)]"><section className="mx-auto max-w-xl rounded-[2rem] bg-[var(--app-surface,#fff)] p-7"><p className="cm-eyebrow text-[var(--app-accent,#6f1d2c)]">Creator application</p><div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-black">{creator.displayName}</h1><CreatorBadge approved={creator.creatorApproved} /></div><p className="mt-1 text-sm text-[var(--app-text-secondary,#725d63)]">@{creator.username}</p><div className="mt-6 rounded-2xl bg-[var(--app-surface-elevated,#f8fafc)] p-5"><p className="text-xs font-black uppercase tracking-[.14em]">{status.replace("_", " ")}</p><p className="mt-2 text-sm leading-6 text-[var(--app-text-secondary,#725d63)]">{creator.creatorApproved ? "Creator approved" : "Verification and review pending"}</p></div><button type="button" onClick={onLogout} className="mt-6 rounded-full border border-[var(--app-border)] px-5 py-3 text-sm font-black">Sign out</button></section></main>;
}
