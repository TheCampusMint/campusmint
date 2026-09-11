import type { MintComment } from "../../types/mint.ts";

export function commentRankingScore(comment: MintComment, currentTime: number) {
  const ageHours = Math.max(
    0,
    (currentTime - new Date(comment.createdAt).getTime()) / 3_600_000,
  );
  const recency = Math.max(0, 18 - Math.log2(ageHours + 1) * 4);
  return (comment.repostCount ?? 0) * 12 + (comment.likeCount ?? 0) * 2 + recency;
}

export function rankComments(
  comments: readonly MintComment[],
  currentTime: number,
) {
  return comments
    .filter((comment) => comment.status === "active")
    .slice()
    .sort(
      (a, b) =>
        commentRankingScore(b, currentTime) - commentRankingScore(a, currentTime) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
        a.id.localeCompare(b.id),
    );
}

export function filterAndRankComments(
  comments: readonly MintComment[],
  currentTime: number,
  blockedAuthorIds: readonly string[],
  hiddenCommentIds: readonly string[],
) {
  const blockedAuthors = new Set(blockedAuthorIds);
  const hiddenComments = new Set(hiddenCommentIds);

  return rankComments(
    comments.filter(
      (comment) =>
        !blockedAuthors.has(comment.authorId) &&
        !hiddenComments.has(comment.id),
    ),
    currentTime,
  );
}

export function canRepostComment(
  comment: Pick<MintComment, "authorId" | "status">,
  viewerUserId: string,
) {
  return comment.status === "active" && comment.authorId !== viewerUserId;
}

export function shouldCommitCommentDoubleTap(alreadyLiked: boolean) {
  return !alreadyLiked;
}
