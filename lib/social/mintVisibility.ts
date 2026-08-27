import { getAccountConfiguredUniversityId } from "../../data/universities.ts";
import { canViewOrganizationContent } from "../organizationPermissions.ts";
import { canViewMint, type MintPermissionContext } from "./mintPermissions.ts";
import { getFriendshipStatus } from "./relationships.ts";
import type { Mint } from "../../types/mint.ts";
import type { OrganizationMembership } from "../../types/organization.ts";
import type { CampusMintUser } from "../../types/profile.ts";
import type { Follow, Friendship, UserBlock } from "../../types/social.ts";

export type MintVisibilityState = {
  viewer: CampusMintUser;
  users: CampusMintUser[];
  friendships: Friendship[];
  follows: Follow[];
  blocks: UserBlock[];
  currentTime: number;
  organizationMemberships?: OrganizationMembership[];
};

export function createMintPermissionContext(
  mint: Mint,
  author: CampusMintUser,
  state: MintVisibilityState,
): MintPermissionContext {
  const viewerId = state.viewer.account.id;
  const authorId = author.account.id;

  return {
    mint,
    viewer: state.viewer,
    author,
    friendshipStatus: getFriendshipStatus(
      state.friendships,
      viewerId,
      authorId,
    ),
    viewerFollowsAuthor: state.follows.some(
      (follow) =>
        follow.followerId === viewerId &&
        follow.followingId === authorId,
    ),
    authorFollowsViewer: state.follows.some(
      (follow) =>
        follow.followerId === authorId &&
        follow.followingId === viewerId,
    ),
    blocked: state.blocks.some(
      (block) =>
        (block.blockerId === viewerId &&
          block.blockedId === authorId) ||
        (block.blockerId === authorId &&
          block.blockedId === viewerId),
    ),
    currentTime: state.currentTime,
  };
}

/**
 * The shared permission boundary for Mint feeds and ranking. Organization
 * audience checks remain part of visibility, so scoring never receives a Mint
 * that the viewer cannot access.
 */
export function getVisibleMintz(
  mints: readonly Mint[],
  state: MintVisibilityState,
) {
  const usersById = new Map(
    state.users.map((user) => [user.account.id, user]),
  );
  const viewerConfiguredUniversityId =
    getAccountConfiguredUniversityId(state.viewer.account);
  const uniqueMintz = new Map<string, Mint>();

  for (const mint of mints) {
    if (uniqueMintz.has(mint.id)) continue;

    const author = usersById.get(mint.authorId);
    if (!author) continue;

    const permissionContext = createMintPermissionContext(
      mint,
      author,
      state,
    );

    if (!canViewMint(permissionContext)) continue;

    if (mint.organizationId) {
      // Provisional universities never borrow a configured campus actor merely
      // to gain access to configured organization inventory.
      if (!viewerConfiguredUniversityId) continue;

      if (
        !canViewOrganizationContent(
          {
            id: state.viewer.account.id,
            universityId: viewerConfiguredUniversityId,
          },
          mint.organizationId,
          mint.organizationAudience,
          state.organizationMemberships ?? [],
        )
      ) {
        continue;
      }
    }

    uniqueMintz.set(mint.id, mint);
  }

  return [...uniqueMintz.values()];
}
