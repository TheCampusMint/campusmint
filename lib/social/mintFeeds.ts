import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import {
  getAccountConfiguredUniversityId,
  getAccountUniversityIdentityKey,
} from "@/data/universities";
import {
  hasEligibleSocialConnection,
} from "@/lib/social/mintPermissions";
import {
  createMintPermissionContext,
  getVisibleMintz,
} from "@/lib/social/mintVisibility";
import type { NormalMintRankingState } from "@/lib/social/mintFeedRanking";
import type { Mint } from "@/types/mint";
import { rankEventContentInMixedFeed } from "@/lib/content/eventRanking";
import { getMintEventWindow } from "@/lib/social/mintEventRanking";

export type MintFeed = "following" | "campus" | "discover";

export type MintFeedState = NormalMintRankingState;
export { createMintPermissionContext };

export function getMintFeed(mints: Mint[], feed: MintFeed, state: MintFeedState) {
  const viewerConfiguredUniversityId =
    getAccountConfiguredUniversityId(
      state.viewer.account,
    );

  const viewerNetworkId =
    viewerConfiguredUniversityId
      ? getCampusNetworkForUniversity(
          viewerConfiguredUniversityId,
        )?.id
      : null;

  const viewerUniversityIdentityKey =
    getAccountUniversityIdentityKey(
      state.viewer.account,
    );
  const chronologicalFeed = getVisibleMintz(mints, state).filter((mint) => {
    const author = state.users.find((user) => user.account.id === mint.authorId);
    if (!author) return false;
    const context = createMintPermissionContext(mint, author, state);
    if (feed === "following") {
      return mint.authorId === state.viewer.account.id
        || hasEligibleSocialConnection(context)
        || Boolean(mint.organizationId && state.followedOrganizationIds?.includes(mint.organizationId));
    }
    if (feed === "campus") {
      const authorUniversityIdentityKey =
        getAccountUniversityIdentityKey(
          author.account,
        );

      if (
        authorUniversityIdentityKey ===
        viewerUniversityIdentityKey
      ) {
        return true;
      }

      return Boolean(
        viewerNetworkId &&
          mint.campusNetworkId !== "universal" &&
          mint.campusNetworkId ===
            viewerNetworkId,
      );
    }
    return true;
  }).sort((first, second) =>
    new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  return rankEventContentInMixedFeed(chronologicalFeed, getMintEventWindow, state.currentTime);
}

export function getVisibleProfileMintz(mints: Mint[], profileUserId: string, state: MintFeedState) {
  return getMintFeed(mints, "discover", state).filter((mint) => mint.authorId === profileUserId);
}

export function getVisibleTaggedMintz(mints: Mint[], profileUserId: string, state: MintFeedState) {
  return getMintFeed(mints, "discover", state).filter((mint) => mint.taggedUserIds.includes(profileUserId));
}
