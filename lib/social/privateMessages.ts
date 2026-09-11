import { getAccountUniversityIdentityKey } from "../../data/universities.ts";
import { isEligibleForDiscoveryScope } from "./mintPermissions.ts";
import type { CampusMintUser } from "../../types/profile.ts";
import type { Follow, Friendship } from "../../types/social.ts";
import type { MusicMetadata } from "../../types/content.ts";
import { migrateLegacyMusicMetadata } from "../content/music.ts";

export const PROFILE_NOTE_MAX_LENGTH = 150;

export type ProfileNoteMusic = MusicMetadata;

export type ProfileNote = {
  text: string;
  websiteUrl: string | null;
  music: ProfileNoteMusic | null;
  updatedAt: string;
};

export function normalizeSafeWebsiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const candidate = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    return candidate.protocol === "http:" || candidate.protocol === "https:"
      ? candidate.toString()
      : null;
  } catch {
    return null;
  }
}

export function normalizeSafeMusicUrl(value: string, provider: ProfileNoteMusic["provider"]) {
  const safeUrl = normalizeSafeWebsiteUrl(value);
  if (!safeUrl) return null;

  const url = new URL(safeUrl);
  const expectedHost =
    provider === "spotify" ? "open.spotify.com" : "music.apple.com";
  return url.hostname === expectedHost ? url.toString() : null;
}

export function sanitizeProfileNote(note: ProfileNote): ProfileNote {
  const legacyMusic = note.music as ProfileNoteMusic & { title?: string; url?: string };
  const music = note.music
    ? migrateLegacyMusicMetadata({
        ...note.music,
        trackTitle: note.music.trackTitle ?? legacyMusic.title,
        trackId: note.music.trackId ?? note.music.providerTrackId ?? legacyMusic.url,
        externalUrl: note.music.externalUrl ?? note.music.providerUrl ?? legacyMusic.url,
      })
    : null;

  return {
    text: note.text.trim().slice(0, PROFILE_NOTE_MAX_LENGTH),
    websiteUrl: normalizeSafeWebsiteUrl(note.websiteUrl ?? ""),
    music,
    updatedAt: note.updatedAt,
  };
}

function normalizedValues(values: readonly string[] | undefined) {
  return new Set(
    (values ?? []).map((value) => value.trim().toLocaleLowerCase()),
  );
}

function intersectionCount(first: Set<string>, second: Set<string>) {
  let count = 0;
  for (const value of first) {
    if (second.has(value)) count += 1;
  }
  return count;
}

function hasFriendship(
  friendships: readonly Friendship[],
  firstId: string,
  secondId: string,
) {
  return friendships.some(
    (friendship) =>
      friendship.status === "friends" &&
      ((friendship.requesterId === firstId &&
        friendship.addresseeId === secondId) ||
        (friendship.requesterId === secondId &&
          friendship.addresseeId === firstId)),
  );
}

export type PrivateMessageSuggestion = {
  user: CampusMintUser;
  score: number;
  reason: string;
};

export function rankPrivateMessageSuggestions(input: {
  viewer: CampusMintUser;
  candidates: readonly CampusMintUser[];
  friendships: readonly Friendship[];
  follows: readonly Follow[];
  blockedUserIds: readonly string[];
  existingConversationUserIds: readonly string[];
}) {
  const { viewer, candidates, friendships } = input;
  const viewerInterests = normalizedValues(viewer.profile.interests);
  const viewerHobbies = normalizedValues(viewer.profile.hobbies);
  const viewerClubs = new Set(viewer.profile.clubIds);
  const viewerIdentity = getAccountUniversityIdentityKey(viewer.account);
  const blocked = new Set(input.blockedUserIds);
  const existing = new Set(input.existingConversationUserIds);

  return candidates
    .filter((candidate) => {
      if (candidate.account.id === viewer.account.id) return false;
      if (blocked.has(candidate.account.id) || existing.has(candidate.account.id)) {
        return false;
      }

      const friends = hasFriendship(
        friendships,
        viewer.account.id,
        candidate.account.id,
      );
      const related =
        friends ||
        input.follows.some(
          (follow) =>
            (follow.followerId === viewer.account.id &&
              follow.followingId === candidate.account.id) ||
            (follow.followerId === candidate.account.id &&
              follow.followingId === viewer.account.id),
        );

      if (candidate.socialSettings.accountType === "private" && !related) {
        return false;
      }

      return isEligibleForDiscoveryScope(
        viewer,
        candidate,
        candidate.socialSettings.discoveryScope,
      );
    })
    .map((candidate): PrivateMessageSuggestion => {
      const sharedClubs = candidate.profile.clubIds.filter((id) =>
        viewerClubs.has(id),
      ).length;
      const sharedInterests = intersectionCount(
        viewerInterests,
        normalizedValues(candidate.profile.interests),
      );
      const sharedHobbies = intersectionCount(
        viewerHobbies,
        normalizedValues(candidate.profile.hobbies),
      );
      const sameUniversity =
        viewerIdentity === getAccountUniversityIdentityKey(candidate.account);
      const friends = hasFriendship(
        friendships,
        viewer.account.id,
        candidate.account.id,
      );
      const follows = input.follows.some(
        (follow) =>
          (follow.followerId === viewer.account.id &&
            follow.followingId === candidate.account.id) ||
          (follow.followerId === candidate.account.id &&
            follow.followingId === viewer.account.id),
      );
      const score =
        (friends ? 120 : 0) +
        (follows ? 75 : 0) +
        (sameUniversity ? 55 : 0) +
        sharedClubs * 45 +
        sharedInterests * 18 +
        sharedHobbies * 14;
      const reason = friends
        ? "Friend"
        : sharedClubs > 0
          ? `${sharedClubs} shared club${sharedClubs === 1 ? "" : "s"}`
          : sharedInterests > 0
            ? `${sharedInterests} shared interest${sharedInterests === 1 ? "" : "s"}`
            : sharedHobbies > 0
              ? `${sharedHobbies} shared activit${sharedHobbies === 1 ? "y" : "ies"}`
              : sameUniversity
                ? "Same university"
                : "Campus Mint community";

      return { user: candidate, score, reason };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.user.profile.displayName.localeCompare(b.user.profile.displayName),
    );
}

export function moveConversationId(
  order: readonly string[],
  conversationId: string,
  direction: -1 | 1,
) {
  const index = order.indexOf(conversationId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= order.length) {
    return [...order];
  }

  const next = [...order];
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}

export function moveConversationIdToIndex(
  order: readonly string[],
  conversationId: string,
  destination: number,
) {
  const source = order.indexOf(conversationId);
  if (source < 0 || destination < 0 || destination >= order.length) {
    return [...order];
  }

  const next = [...order];
  next.splice(source, 1);
  next.splice(destination, 0, conversationId);
  return next;
}

export function mergeConversationOrder(
  order: readonly string[],
  conversationIds: readonly string[],
) {
  const validIds = new Set(conversationIds);
  return [
    ...order.filter((id) => validIds.has(id)),
    ...conversationIds.filter((id) => !order.includes(id)),
  ];
}

export function toggleConversationPin(
  pinnedConversationIds: readonly string[],
  conversationId: string,
) {
  return pinnedConversationIds.includes(conversationId)
    ? pinnedConversationIds.filter((id) => id !== conversationId)
    : [...pinnedConversationIds, conversationId];
}

export function sortConversationIdsWithPins(
  orderedConversationIds: readonly string[],
  pinnedConversationIds: readonly string[],
) {
  const pinned = new Set(pinnedConversationIds);
  return [
    ...orderedConversationIds.filter((id) => pinned.has(id)),
    ...orderedConversationIds.filter((id) => !pinned.has(id)),
  ];
}
