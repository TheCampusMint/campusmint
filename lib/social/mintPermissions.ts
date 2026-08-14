import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import {
  getAccountConfiguredUniversityId,
  getAccountUniversityIdentityKey,
} from "@/data/universities";
import { isActiveContent } from "@/lib/content/expiration";
import type { Mint } from "@/types/mint";
import type { CampusMintUser, SocialDiscoveryScope } from "@/types/profile";
import type { FriendshipStatus } from "@/types/social";

export type SocialConnectionContext = {
  viewer: CampusMintUser | null;
  author: CampusMintUser;
  friendshipStatus: FriendshipStatus;
  viewerFollowsAuthor: boolean;
  authorFollowsViewer: boolean;
  blocked: boolean;
};

export type MintPermissionContext = SocialConnectionContext & {
  mint: Mint;
  currentTime?: number;
};

export function hasEligibleSocialConnection(context: SocialConnectionContext) {
  return context.friendshipStatus === "friends" ||
    context.viewerFollowsAuthor ||
    context.authorFollowsViewer;
}

export function canViewPrivateAccountContent(context: SocialConnectionContext) {
  if (!context.viewer || context.blocked || context.friendshipStatus === "blocked") return false;
  if (context.viewer.account.id === context.author.account.id) return true;
  if (context.author.socialSettings.accountType === "public") return true;
  return hasEligibleSocialConnection(context);
}

export function isEligibleForDiscoveryScope(
  viewer: CampusMintUser,
  author: CampusMintUser,
  scope: SocialDiscoveryScope,
) {
  if (
    viewer.account.id === author.account.id
  ) {
    return true;
  }

  if (viewer.account.role !== "student") {
    return false;
  }

  if (scope === "community") {
    return true;
  }

  const sameUniversity =
    getAccountUniversityIdentityKey(
      viewer.account,
    ) ===
    getAccountUniversityIdentityKey(
      author.account,
    );

  if (scope === "university") {
    return sameUniversity;
  }

  // A provisional university has no geographic Campus
  // Network yet. Students at that same provisional school
  // still count as being in the same local community.
  if (sameUniversity) {
    return true;
  }

  const viewerUniversityId =
    getAccountConfiguredUniversityId(
      viewer.account,
    );

  const authorUniversityId =
    getAccountConfiguredUniversityId(
      author.account,
    );

  if (
    !viewerUniversityId ||
    !authorUniversityId
  ) {
    return false;
  }

  const viewerNetworkId =
    getCampusNetworkForUniversity(
      viewerUniversityId,
    )?.id;

  const authorNetworkId =
    getCampusNetworkForUniversity(
      authorUniversityId,
    )?.id;

  return Boolean(
    viewerNetworkId &&
      authorNetworkId &&
      viewerNetworkId === authorNetworkId,
  );
}

export function canViewMint(context: MintPermissionContext) {
  const { mint, viewer, author, currentTime = Date.now() } = context;
  if (!isActiveContent(mint.status, mint.expiresAt, currentTime) || mint.archivedAt) return false;
  if (!viewer || context.blocked || context.friendshipStatus === "blocked") return false;
  if (viewer.account.id === author.account.id) return true;
  if (!canViewPrivateAccountContent(context)) return false;
  if (mint.privacy === "private") return false;
  if (mint.privacy === "connections") return hasEligibleSocialConnection(context);
  return isEligibleForDiscoveryScope(viewer, author, author.socialSettings.discoveryScope);
}

export function canLikeMint(context: MintPermissionContext) {
  return canViewMint(context);
}

export function canCommentOnMint(context: MintPermissionContext) {
  return context.mint.commentsEnabled && canViewMint(context);
}

export function canViewMintLikeCount(context: MintPermissionContext) {
  return context.mint.likesVisible && canViewMint(context);
}
