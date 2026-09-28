import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { developmentUsers } from "../data/development/users.ts";
import {
  mergeConversationOrder,
  moveConversationId,
  moveConversationIdToIndex,
  normalizeSafeMusicUrl,
  normalizeSafeWebsiteUrl,
  PROFILE_NOTE_MAX_LENGTH,
  rankPrivateMessageSuggestions,
  sanitizeProfileNote,
} from "../lib/social/privateMessages.ts";

const viewer = developmentUsers[0];
const messagesSource = readFileSync(
  new URL("../components/messages/MessagesSkeleton.tsx", import.meta.url),
  "utf8",
);
const notesSource = readFileSync(
  new URL("../components/messages/ProfileNotesStrip.tsx", import.meta.url),
  "utf8",
);
const threadSource = readFileSync(
  new URL("../components/messages/DirectMintThread.tsx", import.meta.url),
  "utf8",
);

test("Private Messages uses the concise heading without legacy DM instructions", () => {
  assert.match(messagesSource, />\s*Private Messages\s*</);
  assert.doesNotMatch(
    messagesSource,
    /Start a DM|No conversation selected|Open a student and tap Messages/i,
  );
});

test("Notes use a compact shared avatar-cell row with the viewer first", () => {
  assert.match(notesSource, /data-profile-notes-row/);
  assert.match(notesSource, /data-note-cell/);
  assert.match(notesSource, /w-\[5\.25rem\]/);
  assert.match(notesSource, /text-center/);
  assert.ok(notesSource.indexOf("onClick={openEditor}") < notesSource.indexOf("relatedUsers.slice"));
});

test("suggestion selection opens a nested scene without creating or reordering a conversation", () => {
  assert.match(messagesSource, /setThreadUserId\(userId\)/);
  assert.doesNotMatch(messagesSource, /startConversation\(/);
  assert.match(messagesSource, /return <DirectMintThread/);
  assert.ok(messagesSource.indexOf("return <DirectMintThread") < messagesSource.indexOf("data-message-list-scene"));
});

test("dedicated message thread has leaf Back, profile navigation, and a pinned composer", () => {
  assert.match(threadSource, /MintLeafBackButton/);
  assert.match(threadSource, /onOpenProfile\(otherUser\.account\.id\)/);
  assert.match(threadSource, /<form[^>]+className="shrink-0/);
  assert.match(threadSource, /markConversationSeen/);
});

test("Direct Mint exposes honest local attachments, emoji, stickers, and replies", () => {
  assert.match(threadSource, /replyToMessageId/);
  assert.match(threadSource, /Camera/);
  assert.match(threadSource, /Photo \/ video/);
  assert.match(threadSource, /GIF file/);
  assert.match(threadSource, /Campus stickers · development/);
  assert.match(threadSource, /Preview only · this device/);
});

test("profile Notes enforce 150 characters, safe web URLs, and migrate legacy music", () => {
  const note = sanitizeProfileNote({
    text: "x".repeat(200),
    websiteUrl: "campusmint.example/club",
    music: {
      provider: "spotify",
      title: "Study Mix",
      artist: "Demo Artist",
      url: "https://open.spotify.com/track/example",
    },
    updatedAt: "2026-08-29T12:00:00.000Z",
  });

  assert.equal(note.text.length, PROFILE_NOTE_MAX_LENGTH);
  assert.equal(note.websiteUrl, "https://campusmint.example/club");
  assert.equal(normalizeSafeWebsiteUrl("javascript:alert(1)"), null);
  assert.match(note.music.externalUrl, /^https:\/\/open\.spotify\.com\//);
  assert.equal(
    normalizeSafeMusicUrl(
      "https://music.apple.com/us/album/example",
      "spotify",
    ),
    null,
  );
});

test("manual conversation order changes only through explicit order operations", () => {
  const manual = ["chat-a", "chat-b", "chat-c"];
  assert.deepEqual(moveConversationId(manual, "chat-c", -1), [
    "chat-a",
    "chat-c",
    "chat-b",
  ]);
  assert.deepEqual(mergeConversationOrder(manual, ["chat-c", "chat-a", "chat-b"]), manual);
  assert.deepEqual(mergeConversationOrder(manual, ["chat-c", "chat-a", "chat-b", "chat-new"]), [
    "chat-a",
    "chat-b",
    "chat-c",
    "chat-new",
  ]);
  assert.deepEqual(moveConversationIdToIndex(manual, "chat-c", 0), [
    "chat-c",
    "chat-a",
    "chat-b",
  ]);
});

test("shared interests deterministically improve suggestion ranking", () => {
  const shared = {
    ...developmentUsers[1],
    account: { ...developmentUsers[1].account, id: "shared" },
    profile: {
      ...developmentUsers[1].profile,
      accountId: "shared",
      displayName: "Shared Interest",
      interests: [viewer.profile.interests[0]],
    },
  };
  const unrelated = {
    ...developmentUsers[1],
    account: { ...developmentUsers[1].account, id: "unrelated" },
    profile: {
      ...developmentUsers[1].profile,
      accountId: "unrelated",
      displayName: "Unrelated Interest",
      interests: ["A different interest"],
    },
  };
  const ranked = rankPrivateMessageSuggestions({
    viewer,
    candidates: [unrelated, shared],
    friendships: [],
    follows: [],
    blockedUserIds: [],
    existingConversationUserIds: [],
  });

  assert.equal(ranked[0].user.account.id, "shared");
  assert.match(ranked[0].reason, /shared interest/);
});

test("private-message suggestions exclude self, blocks, existing chats, and unrelated private accounts", () => {
  const suggestions = rankPrivateMessageSuggestions({
    viewer,
    candidates: developmentUsers,
    friendships: [],
    follows: [],
    blockedUserIds: ["demo-seller-blinn"],
    existingConversationUserIds: ["demo-blinn-taylor"],
  });
  const ids = suggestions.map(({ user }) => user.account.id);

  assert.equal(ids.includes(viewer.account.id), false);
  assert.equal(ids.includes("demo-seller-blinn"), false);
  assert.equal(ids.includes("demo-blinn-taylor"), false);
  assert.equal(ids.includes("demo-tamu-jordan"), false);
  assert.equal(ids.length > 0, true);
});
