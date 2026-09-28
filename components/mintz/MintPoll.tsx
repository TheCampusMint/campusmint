"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { ContentPoll } from "@/types/content";

type Props = { mintId: string; poll: ContentPoll; isDevelopment: boolean; active?: boolean };

/** Server totals and the signed-in account's choice; never a device-local vote. */
export function MintPoll({ mintId, poll: initialPoll, isDevelopment, active = true }: Props) {
  const headingId = useId();
  const [poll, setPoll] = useState(initialPoll);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const voting = useRef(false);

  useEffect(() => {
    if (isDevelopment || !active) return;
    let disposed = false;
    const refresh = async () => {
      if (document.hidden || voting.current) return;
      const version = ++requestVersion.current;
      try {
        const response = await fetch(`/api/mintz/${mintId}/poll`, { cache: "no-store" });
        const body = await response.json();
        if (!disposed && version === requestVersion.current && response.ok && body.ok && body.poll) setPoll(body.poll);
      } catch { /* A transient refresh keeps the last confirmed result visible. */ }
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [mintId, isDevelopment, active]);

  async function vote(optionId: string) {
    if (voting.current || isDevelopment) return;
    voting.current = true;
    ++requestVersion.current;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/mintz/${mintId}/poll`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok || !body.poll) throw new Error(body.message || "Your vote couldn't be saved. Try again.");
      setPoll(body.poll);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Your vote couldn't be saved. Try again.");
    } finally {
      voting.current = false;
      setPending(false);
    }
  }

  return <section className="my-3" aria-labelledby={headingId} aria-busy={pending}>
    <h3 id={headingId} className="mb-3 text-base font-bold text-[var(--app-text-primary)]">{poll.question}</h3>
    <div className="space-y-2" role="group" aria-label="Choose one poll answer">
      {poll.options.map((option) => {
        const selected = poll.selectedOptionId === option.id;
        const percentage = poll.totalVotes > 0 ? Math.round(option.voteCount / poll.totalVotes * 100) : 0;
        return <button key={option.id} type="button" aria-pressed={selected}
          disabled={pending || isDevelopment} onClick={() => { void vote(option.id); }}
          className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-left text-sm text-[var(--app-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)] disabled:cursor-default"
          style={{ background: "var(--app-surface-elevated)" }}>
          <span aria-hidden="true" className="absolute inset-y-0 left-0 rounded-2xl" style={{ width: `${percentage}%`, background: "var(--app-personal-soft)", opacity: selected ? 1 : 0.6 }} />
          <span className="relative min-w-0 flex-1 break-words font-semibold">{option.label}{selected && <span className="ml-2 text-[var(--app-personal)]" aria-label="Your vote">✓</span>}</span>
          <span className="relative text-xs tabular-nums text-[var(--app-text-secondary)]" aria-label={`${option.voteCount} votes`}>{percentage}%</span>
        </button>;
      })}
    </div>
    <p className="mt-2 text-xs text-[var(--app-text-secondary)]" aria-live="polite">{isDevelopment ? "Preview poll · voting requires a published post" : pending ? "Saving your vote…" : `${poll.totalVotes} ${poll.totalVotes === 1 ? "vote" : "votes"} · ${poll.selectedOptionId ? "You can change your answer" : "Choose one answer"}`}</p>
    {error && <p role="alert" className="mt-2 text-xs text-[var(--app-danger)]">{error}</p>}
  </section>;
}
