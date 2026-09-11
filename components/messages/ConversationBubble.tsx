"use client";

import { PinIcon } from "@/components/icons/CampusIcons";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { UniversityTheme } from "@/data/universities";
import type { DirectMintMessage } from "@/hooks/useDirectMint";
import type { CampusMintUser } from "@/types/profile";

export function ConversationBubble({ user, theme, latestMessage, currentUserId, pinned, onSelect, onTogglePin }: {
  user: CampusMintUser;
  theme: UniversityTheme;
  latestMessage: DirectMintMessage | null;
  currentUserId: string;
  pinned: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}) {
  const unread = Boolean(latestMessage && latestMessage.senderId !== currentUserId && latestMessage.status !== "seen");
  return <article className="flex items-center gap-2 py-2" data-conversation-row data-pinned={pinned ? "true" : "false"}>
    <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]">
      <span className="relative shrink-0"><ProfileAvatar user={user} size="sm" primaryColor={theme.primary} accentColor={theme.accent}/>{unread && <span aria-label="Unread messages" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--app-background)] bg-[var(--app-accent)]"/>}</span>
      <strong className={`truncate text-sm text-[var(--app-text-primary)] ${unread ? "font-black" : "font-bold"}`}>{user.profile.displayName}</strong>
    </button>
    <button type="button" aria-label={`${pinned ? "Unpin" : "Pin"} conversation with ${user.profile.displayName}`} aria-pressed={pinned} onClick={onTogglePin} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--app-text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]" style={pinned ? { color: "var(--app-accent)" } : undefined}><PinIcon filled={pinned} className="h-[19px] w-[19px]"/></button>
  </article>;
}
