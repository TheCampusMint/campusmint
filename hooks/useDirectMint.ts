"use client";

import { useMemo, useState } from "react";

export type DirectMintMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type DirectMintConversation = {
  id: string;
  participantIds: [string, string];
  createdAt: string;
  updatedAt: string;
};

function conversationIdFor(a: string, b: string) {
  return `direct-mint:${[a, b].sort().join(":")}`;
}

export function useDirectMint(currentUserId: string) {
  const [conversations, setConversations] =
    useState<DirectMintConversation[]>([]);
  const [messages, setMessages] =
    useState<DirectMintMessage[]>([]);

  function startConversation(otherUserId: string) {
    const id = conversationIdFor(
      currentUserId,
      otherUserId,
    );

    setConversations((current) => {
      if (current.some((item) => item.id === id)) {
        return current;
      }

      const now = new Date().toISOString();

      return [
        ...current,
        {
          id,
          participantIds: [
            currentUserId,
            otherUserId,
          ],
          createdAt: now,
          updatedAt: now,
        },
      ];
    });

    return id;
  }

  function sendMessage(
    otherUserId: string,
    body: string,
  ) {
    const trimmed = body.trim();
    if (!trimmed) return null;

    const conversationId =
      startConversation(otherUserId);

    const now = new Date().toISOString();

    const message: DirectMintMessage = {
      id: crypto.randomUUID(),
      conversationId,
      senderId: currentUserId,
      body: trimmed,
      createdAt: now,
    };

    setMessages((current) => [
      ...current,
      message,
    ]);

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              updatedAt: now,
            }
          : conversation,
      ),
    );

    return message;
  }

  function messagesFor(otherUserId: string) {
    const id = conversationIdFor(
      currentUserId,
      otherUserId,
    );

    return messages.filter(
      (message) =>
        message.conversationId === id,
    );
  }

  function hasConversation(otherUserId: string) {
    const id = conversationIdFor(
      currentUserId,
      otherUserId,
    );

    return conversations.some(
      (conversation) =>
        conversation.id === id,
    );
  }

  const conversationUserIds = useMemo(
    () =>
      conversations
        .slice()
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() -
            new Date(a.updatedAt).getTime(),
        )
        .flatMap((conversation) =>
          conversation.participantIds.filter(
            (id) => id !== currentUserId,
          ),
        ),
    [conversations, currentUserId],
  );

  return {
    conversations,
    messages,
    conversationUserIds,
    startConversation,
    sendMessage,
    messagesFor,
    hasConversation,
  };
}

export type DirectMintState =
  ReturnType<typeof useDirectMint>;
