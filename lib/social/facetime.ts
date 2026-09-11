import type { CampusMintUser } from "../../types/profile.ts";
import type { Follow, Friendship } from "../../types/social.ts";

export type FaceTimeAvailability =
  | { available: true; href: string }
  | { available: false; reason: "unsupported_device" | "missing_contact" | "privacy" };

export function supportsFaceTimeHandoff(userAgent: string, platform = "") {
  const value = `${userAgent} ${platform}`.toLocaleLowerCase();
  return /iphone|ipad|ipod|macintosh|macintel/.test(value);
}

function related(input: {
  viewerId: string;
  targetId: string;
  friendships: readonly Friendship[];
  follows: readonly Follow[];
}) {
  const friends = input.friendships.some(
    (item) => item.status === "friends" &&
      ((item.requesterId === input.viewerId && item.addresseeId === input.targetId) ||
        (item.requesterId === input.targetId && item.addresseeId === input.viewerId)),
  );
  const connected = input.follows.some(
    (item) =>
      (item.followerId === input.viewerId && item.followingId === input.targetId) ||
      (item.followerId === input.targetId && item.followingId === input.viewerId),
  );
  return { friends, connected: connected || friends };
}

export function resolveFaceTimeHandoff(input: {
  viewer: CampusMintUser;
  target: CampusMintUser;
  friendships: readonly Friendship[];
  follows: readonly Follow[];
  supported: boolean;
}): FaceTimeAvailability {
  if (!input.supported) return { available: false, reason: "unsupported_device" };
  const contact = input.target.account.faceTimeContact;
  if (!contact?.verified || !contact.value.trim()) {
    return { available: false, reason: "missing_contact" };
  }
  const relation = related({
    viewerId: input.viewer.account.id,
    targetId: input.target.account.id,
    friendships: input.friendships,
    follows: input.follows,
  });
  const permitted =
    contact.visibility === "connections"
      ? relation.connected
      : contact.visibility === "friends"
        ? relation.friends
        : false;
  if (!permitted) return { available: false, reason: "privacy" };
  return { available: true, href: `facetime:${encodeURIComponent(contact.value)}` };
}
