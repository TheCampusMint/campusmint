"use client";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { UniversityTheme } from "@/data/universities";
import { PUBLIC_ENDORSEMENT_ACTIVE_COLOR } from "@/lib/social/mintInteractions";
import type { CampusMintUser } from "@/types/profile";

function CommentGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4.2c-5.1 0-8.6 3.1-8.6 7.3 0 4 3.3 7 8 7.2l4.3 2.5-.6-3.2c3.2-1.1 5.4-3.5 5.4-6.5 0-4.2-3.5-7.3-8.5-7.3Z" />
    </svg>
  );
}

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <path d="m8.2 10.5 6.9-4M8.2 13.5l6.9 4" />
      <circle cx="6" cy="12" r="2.35" />
      <circle cx="17.2" cy="5.3" r="2.35" />
      <circle cx="17.2" cy="18.7" r="2.35" />
    </svg>
  );
}

function HeartGlyph({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20.3S4.2 15.7 4.2 9.7c0-3 2.1-4.9 4.7-4.9 1.5 0 2.6.7 3.1 1.7.6-1 1.7-1.7 3.2-1.7 2.6 0 4.7 1.9 4.7 4.9 0 6-7.9 10.6-7.9 10.6Z" />
    </svg>
  );
}

const baseAction =
  "interactive-pop inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]";

export function CommentAction({
  count,
  disabled = false,
  onClick,
  tone = "light",
}: {
  count: number;
  disabled?: boolean;
  onClick: () => void;
  tone?: "light" | "dark";
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-label={`Open comments, ${count} comments`} className={`${baseAction} ${tone === "dark" ? "text-white" : "text-slate-600"} disabled:opacity-40`}>
      <CommentGlyph />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

export function ShareAction({
  onClick,
  tone = "light",
}: {
  onClick: () => void;
  tone?: "light" | "dark";
}) {
  return (
    <button type="button" onClick={onClick} aria-label="Share Mint" className={`${baseAction} ${tone === "dark" ? "text-white" : "text-slate-600"}`}>
      <ShareGlyph />
      <span className="sr-only">Share</span>
    </button>
  );
}

export function PublicEndorsementAction({
  endorsed,
  onToggle,
}: {
  endorsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-pressed={endorsed}
      aria-label={endorsed ? "Remove public endorsement" : "Publicly endorse this Mint"}
      className="interactive-pop grid h-11 w-11 place-items-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
      style={{
        color: endorsed ? PUBLIC_ENDORSEMENT_ACTIVE_COLOR : "white",
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,.9))",
      }}
    >
      <span className={endorsed ? "cm-state-pop" : ""}>
        <HeartGlyph filled={endorsed} />
      </span>
    </button>
  );
}

export function FriendEndorsementStack({
  users,
  additionalCount,
  theme,
}: {
  users: readonly CampusMintUser[];
  additionalCount: number;
  theme: UniversityTheme;
}) {
  if (users.length === 0) return null;
  const label = `${users.map((user) => user.profile.displayName).join(", ")} endorsed this Mint${additionalCount ? ` and ${additionalCount} more` : ""}`;

  return (
    <div className="flex items-center" aria-label={label} title={label}>
      {users.map((user, index) => (
        <span key={user.account.id} className={index ? "-ml-2" : ""}>
          <span className="block rounded-full border-2 border-white shadow-sm">
            <ProfileAvatar user={user} size="xs" primaryColor={theme.primary} accentColor={theme.accent} />
          </span>
        </span>
      ))}
      {additionalCount > 0 && (
        <span className="-ml-1.5 grid h-6 min-w-6 place-items-center rounded-full border-2 border-white bg-slate-900 px-1 text-[9px] font-black text-white shadow-sm">
          +{additionalCount}
        </span>
      )}
    </div>
  );
}

export function CompactMetric({ label, tone = "light" }: { label: string; tone?: "light" | "dark" }) {
  return <span className={`whitespace-nowrap text-[11px] font-semibold tabular-nums ${tone === "dark" ? "text-white/75" : "text-slate-500"}`}>{label}</span>;
}
