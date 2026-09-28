import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  COMMENT_VIDEO_MAX_SECONDS,
  isEmojiOnlyComment,
  validateCommentAttachment,
} from "../lib/content/commentMedia.ts";
import {
  canRepostComment,
  filterAndRankComments,
  rankComments,
  shouldCommitCommentDoubleTap,
} from "../lib/social/commentRanking.ts";

const commentsSource = readFileSync(
  new URL("../components/mintz/MintCommentsSheet.tsx", import.meta.url),
  "utf8",
);
const cardSource = readFileSync(
  new URL("../components/mintz/MintCard.tsx", import.meta.url),
  "utf8",
);
const fullscreenSource = readFileSync(
  new URL("../components/mintz/FullscreenVideoViewer.tsx", import.meta.url),
  "utf8",
);

function comment(overrides = {}) {
  return {
    id: "comment-1",
    targetType: "mint",
    targetId: "mint-1",
    authorId: "author-1",
    body: "Text-only comments remain valid.",
    mentions: [],
    parentCommentId: null,
    status: "active",
    createdAt: "2026-08-29T12:00:00.000Z",
    updatedAt: "2026-08-29T12:00:00.000Z",
    ...overrides,
  };
}

test("comment media accepts ten-second video and rejects longer video", () => {
  assert.equal(
    validateCommentAttachment({
      type: "video",
      url: "https://example.com/clip.mp4",
      thumbnailUrl: null,
      durationSeconds: COMMENT_VIDEO_MAX_SECONDS,
    }).valid,
    true,
  );
  assert.equal(
    validateCommentAttachment({
      type: "video",
      url: "https://example.com/clip.mp4",
      thumbnailUrl: null,
      durationSeconds: COMMENT_VIDEO_MAX_SECONDS + 1,
    }).valid,
    false,
  );
});

test("comment image and GIF data attachments remain valid", () => {
  assert.equal(
    validateCommentAttachment({
      type: "image",
      url: "data:image/png;base64,AA==",
      alt: "Local image",
    }).valid,
    true,
  );
  assert.equal(
    validateCommentAttachment({
      type: "gif",
      url: "data:image/gif;base64,AA==",
      alt: "Local GIF",
    }).valid,
    true,
  );
});

test("comment double-tap Like is idempotent and emoji-only text is detectable", () => {
  assert.equal(shouldCommitCommentDoubleTap(false), true);
  assert.equal(shouldCommitCommentDoubleTap(true), false);
  assert.equal(isEmojiOnlyComment("🌿 🎉"), true);
  assert.equal(isEmojiOnlyComment("great 🌿"), false);
});

test("comment reposts meaningfully outrank somewhat more Likes", () => {
  const ranked = rankComments(
    [
      comment({ id: "likes", likeCount: 5, repostCount: 0 }),
      comment({ id: "repost", likeCount: 0, repostCount: 1 }),
    ],
    new Date("2026-08-29T13:00:00.000Z").getTime(),
  );
  assert.equal(ranked[0].id, "repost");
});

test("text-only comment migration and own-comment repost safety remain valid", () => {
  const legacy = comment();
  assert.equal(legacy.attachment, undefined);
  assert.equal(rankComments([legacy], Date.now()).length, 1);
  assert.equal(canRepostComment(legacy, "author-1"), false);
  assert.equal(canRepostComment(legacy, "viewer-2"), true);
  assert.equal(comment({ fontStyle: "serif" }).fontStyle, "serif");
});

test("blocked and locally hidden comments are removed before ranking", () => {
  const visible = comment({ id: "visible", authorId: "author-visible" });
  const blocked = comment({ id: "blocked", authorId: "author-blocked", repostCount: 99 });
  const hidden = comment({ id: "hidden", authorId: "author-hidden", repostCount: 99 });

  assert.deepEqual(
    filterAndRankComments(
      [blocked, hidden, visible],
      Date.now(),
      ["author-blocked"],
      ["hidden"],
    ).map((item) => item.id),
    ["visible"],
  );
});

test("ordinary and fullscreen Mint surfaces share one comments sheet and action model", () => {
  for (const source of [cardSource, fullscreenSource]) {
    assert.match(source, /MintCommentsSheet/);
    assert.match(source, /CommentAction/);
    assert.match(source, /ShareAction/);
  }
  assert.match(fullscreenSource, /onClose=\{\(\) => setCommentsEntry\(null\)\}/);
});

test("comment sheet keeps the exact empty state, fixed composer, and no Share action", () => {
  assert.match(commentsSource, />\s*No comments yet\s*</);
  assert.match(commentsSource, /shrink-0.*safe-area-inset-bottom/);
  assert.doesNotMatch(commentsSource, /ShareAction|aria-label="Share|>\s*Share\s*</);
  assert.doesNotMatch(commentsSource, /emoji suggestion|suggested emoji|keyword suggestion/i);
});

test("comment sheet retains long press, like, repost, media, sticker, and font controls", () => {
  assert.match(commentsSource, /beginLongPress/);
  assert.match(commentsSource, /onToggleCommentLike/);
  assert.match(commentsSource, /onToggleCommentRepost/);
  assert.match(commentsSource, /prepareLocalCommentAttachment/);
  assert.match(commentsSource, /stickerOptions/);
  assert.match(commentsSource, /fontStyle/);
});

test("comment sheet supports replies, local persistence honesty, and direct manipulation", () => {
  assert.match(commentsSource, /replyToCommentId/);
  assert.match(commentsSource, />\s*Reply\s*</);
  assert.match(commentsSource, /parentCommentId: replyToCommentId/);
  assert.match(commentsSource, /Preview only · this device/);
  assert.match(commentsSource, /useDirectManipulation/);
  assert.match(commentsSource, /data-direct-drag-handle/);
});
