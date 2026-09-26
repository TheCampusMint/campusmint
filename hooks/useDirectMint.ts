"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import {
  mergeConversationOrder,
  moveConversationId,
  moveConversationIdToIndex,
  sanitizeProfileNote,
  sortConversationIdsWithPins,
  toggleConversationPin as toggleConversationPinRecord,
  type ProfileNote,
} from "@/lib/social/privateMessages";

export type DirectMintDeliveryStatus = "sent" | "delivered" | "seen";

export type DirectMintAttachment = {
  type: "image" | "video" | "gif" | "sticker";
  label: string;
  url?: string;
};

export type DirectMintMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  status: DirectMintDeliveryStatus;
  seenAt: string | null;
  attachment?: DirectMintAttachment | null;
  replyToMessageId?: string | null;
};

export type DirectMintConversation = {
  id: string;
  participantIds: [string, string];
  createdAt: string;
  updatedAt: string;
};

type StoredDirectMintState = {
  version: 2 | 3;
  conversations: DirectMintConversation[];
  messages: DirectMintMessage[];
  conversationOrder: string[];
  profileNote: ProfileNote | null;
  pinnedConversationIds?: string[];
};

function conversationIdFor(a: string, b: string) {
  return `direct-mint:${[a, b].sort().join(":")}`;
}

function storageKeyFor(userId: string) {
  return `campusmint:private-messages:${userId}:v3`;
}

function legacyStorageKeyFor(userId: string) {
  return `campusmint:private-messages:${userId}:v2`;
}

export function useDirectMint(currentUserId: string) {
  const [conversations, setConversations] = useState<DirectMintConversation[]>([]);
  const [messages, setMessages] = useState<DirectMintMessage[]>([]);
  const [conversationOrder, setConversationOrder] = useState<string[]>([]);
  const [profileNote, setProfileNote] = useState<ProfileNote | null>(null);
  const [pinnedConversationIds, setPinnedConversationIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKeyFor(currentUserId)) ?? window.localStorage.getItem(legacyStorageKeyFor(currentUserId));
      if (!stored) return;

      const parsed = JSON.parse(stored) as Partial<StoredDirectMintState>;
      const storedConversations = Array.isArray(parsed.conversations)
        ? parsed.conversations
        : [];
      const storedOrder = Array.isArray(parsed.conversationOrder)
        ? parsed.conversationOrder.filter(
            (id): id is string => typeof id === "string",
          )
        : storedConversations
            .slice()
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime(),
            )
            .map((conversation) => conversation.id);

      // Local storage is the hydration boundary for this development-only store.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConversations(storedConversations);
      setMessages(
        Array.isArray(parsed.messages)
          ? parsed.messages.map((message) => ({
              ...message,
              status: message.status ?? "delivered",
              seenAt: message.seenAt ?? null,
            }))
          : [],
      );
      setConversationOrder(storedOrder);
      setProfileNote(
        parsed.profileNote ? sanitizeProfileNote(parsed.profileNote) : null,
      );
      setPinnedConversationIds(
        Array.isArray(parsed.pinnedConversationIds)
          ? parsed.pinnedConversationIds.filter((id): id is string => typeof id === "string")
          : [],
      );
    } catch {
      // Corrupt local development state is ignored without touching other keys.
    } finally {
      setHydrated(true);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!hydrated) return;

    const state: StoredDirectMintState = {
      version: 3,
      conversations,
      messages,
      conversationOrder,
      profileNote,
      pinnedConversationIds,
    };
    window.localStorage.setItem(
      storageKeyFor(currentUserId),
      JSON.stringify(state),
    );
  }, [conversationOrder, conversations, currentUserId, hydrated, messages, pinnedConversationIds, profileNote]);

  function startConversation(otherUserId: string) {
    const id = conversationIdFor(currentUserId, otherUserId);

    setConversations((current) => {
      if (current.some((item) => item.id === id)) return current;
      const now = new Date().toISOString();
      return [
        ...current,
        {
          id,
          participantIds: [currentUserId, otherUserId],
          createdAt: now,
          updatedAt: now,
        },
      ];
    });
    setConversationOrder((current) =>
      current.includes(id) ? current : [...current, id],
    );

    return id;
  }

  function sendMessage(
    otherUserId: string,
    body: string,
    options: {
      attachment?: DirectMintAttachment | null;
      replyToMessageId?: string | null;
    } = {},
  ) {
    const trimmed = body.trim();
    if (!trimmed && !options.attachment) return null;

    const conversationId = startConversation(otherUserId);
    const now = new Date().toISOString();
    const message: DirectMintMessage = {
      id: crypto.randomUUID(),
      conversationId,
      senderId: currentUserId,
      body: trimmed,
      createdAt: now,
      status: "delivered",
      seenAt: null,
      attachment: options.attachment ?? null,
      replyToMessageId: options.replyToMessageId ?? null,
    };

    setMessages((current) => [...current, message]);
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, updatedAt: now }
          : conversation,
      ),
    );
    return message;
  }

  function messagesFor(otherUserId: string) {
    const id = conversationIdFor(currentUserId, otherUserId);
    return messages.filter((message) => message.conversationId === id);
  }

  function markConversationSeen(otherUserId: string) {
    const id = conversationIdFor(currentUserId, otherUserId);
    const seenAt = new Date().toISOString();
    setMessages((current) => {
      let changed = false;
      const next = current.map((message) => {
        if (
          message.conversationId !== id ||
          message.senderId === currentUserId ||
          message.status === "seen"
        ) {
          return message;
        }
        changed = true;
        return { ...message, status: "seen" as const, seenAt };
      });
      return changed ? next : current;
    });
  }

  function hasConversation(otherUserId: string) {
    return conversations.some(
      (conversation) =>
        conversation.id === conversationIdFor(currentUserId, otherUserId),
    );
  }

  function moveConversation(otherUserId: string, direction: -1 | 1) {
    const id = conversationIdFor(currentUserId, otherUserId);
    setConversationOrder((current) => moveConversationId(current, id, direction));
  }

  function moveConversationToIndex(otherUserId: string, destination: number) {
    const id = conversationIdFor(currentUserId, otherUserId);
    setConversationOrder((current) =>
      moveConversationIdToIndex(current, id, destination),
    );
  }

  function updateProfileNote(note: ProfileNote | null) {
    setProfileNote(note ? sanitizeProfileNote(note) : null);
  }

  function toggleConversationPin(otherUserId: string) {
    const id = conversationIdFor(currentUserId, otherUserId);
    if (!conversations.some((conversation) => conversation.id === id)) return;
    setPinnedConversationIds((current) => toggleConversationPinRecord(current, id));
  }

  function isConversationPinned(otherUserId: string) {
    return pinnedConversationIds.includes(conversationIdFor(currentUserId, otherUserId));
  }

  const conversationUserIds = useMemo(() => {
    const byId = new Map(
      conversations.map((conversation) => [conversation.id, conversation]),
    );
    const ordered = mergeConversationOrder(
      conversationOrder,
      conversations.map((conversation) => conversation.id),
    );

    return sortConversationIdsWithPins(ordered, pinnedConversationIds).flatMap(
      (id) =>
        byId
          .get(id)
          ?.participantIds.filter(
            (participantId) => participantId !== currentUserId,
          ) ?? [],
    );
  }, [conversationOrder, conversations, currentUserId, pinnedConversationIds]);

  return {
    conversations,
    messages,
    conversationOrder,
    conversationUserIds,
    profileNote,
    pinnedConversationIds,
    hydrated,
    startConversation,
    sendMessage,
    messagesFor,
    markConversationSeen,
    hasConversation,
    moveConversation,
    moveConversationToIndex,
    updateProfileNote,
    toggleConversationPin,
    isConversationPinned,
  };
}

export type DirectMintState = ReturnType<typeof useDirectMint>;
