import type { MintRepost } from "../../types/mint.ts";

type ToggleRepostInput = {
  mintId: string;
  userId: string;
  repostId: string;
  createdAt: string;
};

export function toggleRepostRecords(
  reposts: readonly MintRepost[],
  input: ToggleRepostInput,
) {
  const wasReposted = reposts.some(
    (repost) =>
      repost.mintId === input.mintId &&
      repost.userId === input.userId,
  );

  return {
    reposted: !wasReposted,
    reposts: wasReposted
      ? reposts.filter(
          (repost) =>
            !(
              repost.mintId === input.mintId &&
              repost.userId === input.userId
            ),
        )
      : [
          ...reposts,
          {
            id: input.repostId,
            mintId: input.mintId,
            userId: input.userId,
            createdAt: input.createdAt,
          },
        ],
  };
}

export function nextRepostCount(
  currentCount: number,
  reposted: boolean,
) {
  return Math.max(0, currentCount + (reposted ? 1 : -1));
}
