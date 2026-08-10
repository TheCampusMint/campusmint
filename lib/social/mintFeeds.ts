import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import { getFriendshipStatus } from "@/lib/social/relationships";
import {
  canViewMint,
  hasEligibleSocialConnection,
  type MintPermissionContext,
} from "@/lib/social/mintPermissions";
import type { Mint } from "@/types/mint";
import type { CampusMintUser } from "@/types/profile";
import type { Follow, Friendship, UserBlock } from "@/types/social";
import type { OrganizationMembership } from "@/types/organization";
import { canViewOrganizationContent } from "@/lib/organizationPermissions";

export type MintFeed = "following" | "campus" | "discover";

export type MintFeedState = {
  viewer: CampusMintUser;
  users: CampusMintUser[];
  friendships: Friendship[];
  follows: Follow[];
  blocks: UserBlock[];
  currentTime: number;
  organizationMemberships?: OrganizationMembership[];
  followedOrganizationIds?: string[];
};

export function createMintPermissionContext(
  mint: Mint,
  author: CampusMintUser,
  state: MintFeedState,
): MintPermissionContext {
  const viewerId = state.viewer.account.id;
  const authorId = author.account.id;
  return {
    mint,
    viewer: state.viewer,
    author,
    friendshipStatus: getFriendshipStatus(state.friendships, viewerId, authorId),
    viewerFollowsAuthor: state.follows.some((follow) => follow.followerId === viewerId && follow.followingId === authorId),
    authorFollowsViewer: state.follows.some((follow) => follow.followerId === authorId && follow.followingId === viewerId),
    blocked: state.blocks.some((block) =>
      (block.blockerId === viewerId && block.blockedId === authorId) ||
      (block.blockerId === authorId && block.blockedId === viewerId)),
    currentTime: state.currentTime,
  };
}

export function getMintFeed(mints: Mint[], feed: MintFeed, state: MintFeedState) {
  const viewerNetworkId = getCampusNetworkForUniversity(state.viewer.account.universityId)?.id;
  return mints.filter((mint) => {
    const author = state.users.find((user) => user.account.id === mint.authorId);
    if (!author) return false;
    const context = createMintPermissionContext(mint, author, state);
    if (!canViewMint(context)) return false;
    if (mint.organizationId && !canViewOrganizationContent(
      { id: state.viewer.account.id, universityId: state.viewer.account.universityId },
      mint.organizationId,
      mint.organizationAudience,
      state.organizationMemberships ?? [],
    )) return false;
    if (feed === "following") {
      return mint.authorId === state.viewer.account.id
        || hasEligibleSocialConnection(context)
        || Boolean(mint.organizationId && state.followedOrganizationIds?.includes(mint.organizationId));
    }
    if (feed === "campus") {
      return mint.universityId === state.viewer.account.universityId || mint.campusNetworkId === viewerNetworkId;
    }
    return true;
  }).sort((first, second) =>
    new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
}

export function getVisibleProfileMintz(mints: Mint[], profileUserId: string, state: MintFeedState) {
  return getMintFeed(mints, "discover", state).filter((mint) => mint.authorId === profileUserId);
}

export function getVisibleTaggedMintz(mints: Mint[], profileUserId: string, state: MintFeedState) {
  return getMintFeed(mints, "discover", state).filter((mint) => mint.taggedUserIds.includes(profileUserId));
}
