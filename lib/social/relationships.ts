import type { Friendship, FriendshipStatus } from "@/types/social";

export function getFriendshipStatus(
  friendships: Friendship[],
  firstUserId: string,
  secondUserId: string,
): FriendshipStatus {
  const relationship = friendships.find((friendship) =>
    (friendship.requesterId === firstUserId && friendship.addresseeId === secondUserId) ||
    (friendship.requesterId === secondUserId && friendship.addresseeId === firstUserId));
  return relationship?.status ?? "none";
}

export function getNextFriendshipStatus(status: FriendshipStatus): FriendshipStatus {
  if (status === "none") return "requested";
  if (status === "requested") return "friends";
  if (status === "friends") return "none";
  return "blocked";
}
