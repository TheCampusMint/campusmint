"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ConversationBubble } from "@/components/messages/ConversationBubble";
import { DirectMintThread } from "@/components/messages/DirectMintThread";
import { ProfileNotesStrip } from "@/components/messages/ProfileNotesStrip";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { UniversityTheme } from "@/data/universities";
import type { DirectMintState } from "@/hooks/useDirectMint";
import type { ProfilesState } from "@/hooks/useProfiles";
import { rankPrivateMessageSuggestions } from "@/lib/social/privateMessages";
import type { CampusMintUser } from "@/types/profile";

type MessagesSkeletonProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  directMint: DirectMintState;
  requestedUserId?: string | null;
  onBackToProfile?: () => void;
  onOpenProfile: (userId: string) => void;
  onThreadChange?: (userId: string | null) => void;
  onBackToNotifications?: () => void;
};

function normalizedSearch(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function MessagesSkeleton({
  viewer,
  theme,
  profiles,
  directMint,
  requestedUserId = null,
  onBackToProfile,
  onOpenProfile,
  onThreadChange,
  onBackToNotifications,
}: MessagesSkeletonProps) {
  const [query, setQuery] = useState("");
  const [threadUserId, setThreadUserId] = useState<string | null>(requestedUserId);
  const returnScrollRef = useRef(0);

  const blockedUserIds = useMemo(
    () => profiles.blocks.flatMap((block) =>
      block.blockerId === viewer.account.id
        ? [block.blockedId]
        : block.blockedId === viewer.account.id
          ? [block.blockerId]
          : [],
    ),
    [profiles.blocks, viewer.account.id],
  );

  const searchablePeople = useMemo(
    () => rankPrivateMessageSuggestions({
      viewer,
      candidates: profiles.users,
      friendships: profiles.friendships,
      follows: profiles.follows,
      blockedUserIds,
      existingConversationUserIds: [],
    }),
    [blockedUserIds, profiles.friendships, profiles.follows, profiles.users, viewer],
  );

  const suggestions = useMemo(
    () => rankPrivateMessageSuggestions({
      viewer,
      candidates: profiles.users,
      friendships: profiles.friendships,
      follows: profiles.follows,
      blockedUserIds,
      existingConversationUserIds: directMint.conversationUserIds,
    }).slice(0, 6),
    [blockedUserIds, directMint.conversationUserIds, profiles.friendships, profiles.follows, profiles.users, viewer],
  );

  const candidates = searchablePeople.map((suggestion) => suggestion.user);
  const normalizedQuery = normalizedSearch(query);
  const searchResults = normalizedQuery
    ? searchablePeople.filter(({ user }) =>
        [user.profile.displayName, user.profile.username, user.profile.major ?? "", ...user.profile.interests]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      ).slice(0, 6)
    : [];

  useEffect(() => {
    if (!requestedUserId) return;
    // External navigation selects the nested scene; sending creates the record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThreadUserId(requestedUserId);
  }, [requestedUserId]);

  const conversationUsers = directMint.conversationUserIds
    .map((id) => candidates.find((user) => user.account.id === id))
    .filter((user): user is CampusMintUser => Boolean(user));
  const selected = candidates.find((user) => user.account.id === threadUserId) ?? null;

  function openConversation(userId: string) {
    returnScrollRef.current = window.scrollY;
    setThreadUserId(userId);
    onThreadChange?.(userId);
    setQuery("");
  }

  function closeThread() {
    setThreadUserId(null);
    onThreadChange?.(null);
    if (onBackToNotifications) {
      onBackToNotifications();
      return;
    }
    if (onBackToProfile) {
      onBackToProfile();
      return;
    }
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: returnScrollRef.current, behavior: "auto" });
    });
  }

  if (selected) {
    return <DirectMintThread viewer={viewer} otherUser={selected} theme={theme} directMint={directMint} onBack={closeThread} onOpenProfile={onOpenProfile} friendships={profiles.friendships} follows={profiles.follows} />;
  }

  return (
    <div className="space-y-4" data-private-messages data-message-list-scene>
      <h1 className="text-xl font-black tracking-tight text-[var(--app-text-primary)] sm:text-2xl">Private Messages</h1>

      <div className="relative max-w-2xl">
        <label htmlFor="private-message-search" className="sr-only">Search people to message</label>
        <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
        <input id="private-message-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" autoComplete="off" className="h-11 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm shadow-[0_8px_26px_-24px_rgba(15,23,42,.6)] outline-none focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-accent-soft)]" />
        {normalizedQuery && (
          <div className="absolute inset-x-0 top-12 z-30 rounded-3xl border border-slate-200 bg-white p-2 shadow-xl">
            {searchResults.length > 0 ? searchResults.map(({ user, reason }) => (
              <button key={user.account.id} type="button" onClick={() => openConversation(user.account.id)} className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--app-accent)]">
                <ProfileAvatar user={user} size="sm" primaryColor={theme.primary} accentColor={theme.accent} />
                <span className="min-w-0"><strong className="block truncate text-sm text-slate-900">{user.profile.displayName}</strong><span className="block truncate text-xs text-slate-500">@{user.profile.username} · {reason}</span></span>
              </button>
            )) : <p className="px-3 py-4 text-sm text-slate-500">No people found</p>}
          </div>
        )}
      </div>

      <ProfileNotesStrip viewer={viewer} theme={theme} directMint={directMint} relatedUsers={conversationUsers.length > 0 ? conversationUsers : suggestions.map(({ user }) => user)} onOpenUser={openConversation} />

      <div className="space-y-2" aria-label="Conversations">
        {conversationUsers.map((user) => {
          const messages = directMint.messagesFor(user.account.id);
          return (
            <ConversationBubble
              key={user.account.id}
              user={user}
              theme={theme}
              latestMessage={messages.at(-1) ?? null}
              currentUserId={viewer.account.id}
              pinned={directMint.isConversationPinned(user.account.id)}
              onSelect={() => openConversation(user.account.id)}
              onTogglePin={() => directMint.toggleConversationPin(user.account.id)}
            />
          );
        })}

        {suggestions.length > 0 && (
          <section className="pt-3" aria-labelledby="message-suggestions-heading">
            <h2 id="message-suggestions-heading" className="px-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">Suggested</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {suggestions.map(({ user, reason }) => (
                <button key={user.account.id} type="button" onClick={() => openConversation(user.account.id)} className="interactive-pop flex items-center gap-3 rounded-[1.25rem] border border-white/90 bg-white p-2.5 text-left shadow-[0_8px_26px_-24px_rgba(15,23,42,.55)] hover:border-slate-200 focus-visible:outline-2 focus-visible:outline-[var(--app-accent)]">
                  <ProfileAvatar user={user} size="sm" primaryColor={theme.primary} accentColor={theme.accent} />
                  <span className="min-w-0"><strong className="block truncate text-sm text-slate-900">{user.profile.displayName}</strong><span className="block truncate text-xs text-slate-500">{reason}</span></span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
