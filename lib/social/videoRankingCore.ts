import { getAccountUniversityIdentityKey } from "../../data/universities.ts";
import type { Mint } from "../../types/mint.ts";
import type { CampusMintUser } from "../../types/profile.ts";
import type { Follow } from "../../types/social.ts";

export type MintVideoRankingState = {
  viewer: CampusMintUser;
  users: CampusMintUser[];
  follows: Follow[];
  currentTime: number;
};

function normalizedTerms(values: Array<string | null | undefined>) {
  return new Set(
    values
      .flatMap((value) => value?.toLocaleLowerCase().split(/[^a-z0-9]+/) ?? [])
      .filter((value) => value.length >= 3),
  );
}

function sharedInterestCount(
  viewer: CampusMintUser,
  author: CampusMintUser,
  mint: Mint,
) {
  const viewerTerms = normalizedTerms([
    ...viewer.profile.interests,
    ...(viewer.profile.hobbies ?? []),
    viewer.profile.academicArea,
  ]);

  const contentTerms = normalizedTerms([
    ...author.profile.interests,
    ...(author.profile.hobbies ?? []),
    author.profile.academicArea,
    mint.caption,
    ...mint.hashtags,
  ]);

  return [...viewerTerms].filter((term) => contentTerms.has(term)).length;
}

function recommendationScore(
  mint: Mint,
  author: CampusMintUser,
  state: MintVideoRankingState,
) {
  const viewerId = state.viewer.account.id;
  const followsAuthor = state.follows.some(
    (follow) =>
      follow.followerId === viewerId &&
      follow.followingId === author.account.id,
  );

  const ageHours = Math.max(
    0,
    (state.currentTime - new Date(mint.createdAt).getTime()) / 3_600_000,
  );
  const recencyScore = Math.max(0, 240 - ageHours * 4);
  const engagementScore =
    mint.likeCount * 3 +
    mint.commentCount * 5 +
    mint.saveCount * 4 +
    mint.shareCount * 2;

  return (
    (mint.authorId === viewerId ? 2_000 : 0) +
    (followsAuthor ? 1_000 : 0) +
    sharedInterestCount(state.viewer, author, mint) * 80 +
    engagementScore +
    recencyScore
  );
}

export function rankVisibleVideoMintz(
  visibleMintz: readonly Mint[],
  state: MintVideoRankingState,
) {
  const usersById = new Map(
    state.users.map((user) => [user.account.id, user]),
  );
  const viewerUniversityKey = getAccountUniversityIdentityKey(
    state.viewer.account,
  );
  const uniqueVideoMintz = new Map<string, Mint>();

  for (const mint of visibleMintz) {
    if (mint.media.some((media) => media.type === "video")) {
      uniqueVideoMintz.set(mint.id, mint);
    }
  }

  return [...uniqueVideoMintz.values()].sort((first, second) => {
    const firstAuthor = usersById.get(first.authorId);
    const secondAuthor = usersById.get(second.authorId);

    if (!firstAuthor || !secondAuthor) {
      return firstAuthor
        ? -1
        : secondAuthor
          ? 1
          : first.id.localeCompare(second.id);
    }

    const firstIsOwnUniversity =
      getAccountUniversityIdentityKey(firstAuthor.account) ===
      viewerUniversityKey;
    const secondIsOwnUniversity =
      getAccountUniversityIdentityKey(secondAuthor.account) ===
      viewerUniversityKey;

    if (firstIsOwnUniversity !== secondIsOwnUniversity) {
      return firstIsOwnUniversity ? -1 : 1;
    }

    const scoreDifference =
      recommendationScore(second, secondAuthor, state) -
      recommendationScore(first, firstAuthor, state);

    if (scoreDifference !== 0) return scoreDifference;

    const recencyDifference =
      new Date(second.createdAt).getTime() -
      new Date(first.createdAt).getTime();

    return recencyDifference || first.id.localeCompare(second.id);
  });
}
