import type { CampusMintUser } from "../../types/profile.ts";
import type { Follow, Friendship, UserBlock } from "../../types/social.ts";

function normalized(values: readonly string[]) {
  return new Set(values.map((value) => value.trim().toLocaleLowerCase()));
}

function overlap(first: Set<string>, second: Set<string>) {
  let count = 0;
  for (const value of first) if (second.has(value)) count += 1;
  return count;
}

export function rankRelevantEventAttendees(input: {
  viewer: CampusMintUser;
  candidates: readonly CampusMintUser[];
  attendingUserIds: readonly string[];
  friendships: readonly Friendship[];
  follows: readonly Follow[];
  blocks: readonly UserBlock[];
  messageAffinityByUserId?: Readonly<Record<string, number>>;
  maximum?: number;
}) {
  const attending = new Set(input.attendingUserIds);
  const viewerId = input.viewer.account.id;
  const viewerInterests = normalized(input.viewer.profile.interests);
  const viewerClubs = new Set(input.viewer.profile.clubIds);
  const blocked = new Set(input.blocks.flatMap((item) => item.blockerId === viewerId ? [item.blockedId] : item.blockedId === viewerId ? [item.blockerId] : []));

  return input.candidates.flatMap((candidate) => {
    const candidateId = candidate.account.id;
    if (candidateId === viewerId || !attending.has(candidateId) || blocked.has(candidateId)) return [];
    const friends = input.friendships.some((item) => item.status === "friends" && ((item.requesterId === viewerId && item.addresseeId === candidateId) || (item.requesterId === candidateId && item.addresseeId === viewerId)));
    const viewerFollows = input.follows.some((item) => item.followerId === viewerId && item.followingId === candidateId);
    const candidateFollows = input.follows.some((item) => item.followerId === candidateId && item.followingId === viewerId);
    const connected = friends || viewerFollows || candidateFollows;
    if (!connected) return [];
    if (candidate.socialSettings.accountType === "private" && !friends && !(viewerFollows && candidateFollows)) return [];
    const sharedInterests = overlap(viewerInterests, normalized(candidate.profile.interests));
    const sharedGroups = candidate.profile.clubIds.filter((id) => viewerClubs.has(id)).length;
    const dmAffinity = Math.min(30, Math.max(0, input.messageAffinityByUserId?.[candidateId] ?? 0) * 4);
    const score = (friends ? 120 : viewerFollows && candidateFollows ? 90 : 35) + sharedInterests * 22 + sharedGroups * 28 + dmAffinity;
    return [{ user: candidate, score }];
  }).sort((a, b) => b.score - a.score || a.user.account.id.localeCompare(b.user.account.id)).slice(0, input.maximum ?? 3);
}
