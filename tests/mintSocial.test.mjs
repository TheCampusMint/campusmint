import assert from "node:assert/strict";
import test from "node:test";

import { applyEditableMintPatch } from "../lib/social/mintUpdates.ts";
import {
  getMintContentType,
  getMintMediaType,
} from "../lib/content/localMintMedia.ts";
import { rankVisibleVideoMintz } from "../lib/social/videoRankingCore.ts";
import {
  createMintVideoViewerState,
  getMintVideoViewerReturnScrollY,
} from "../lib/social/videoViewerState.ts";
import {
  nextRepostCount,
  toggleRepostRecords,
} from "../lib/social/repostState.ts";

function user(id, universityId, interests = []) {
  return {
    account: {
      id,
      universityId,
      role: "student",
      verifiedStudent: false,
      verifiedAlumni: false,
      isDevelopment: true,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
    profile: {
      interests,
      hobbies: [],
      academicArea: null,
    },
  };
}

function mint(id, authorId, overrides = {}) {
  return {
    id,
    authorId,
    media: [{ id: `${id}-video`, type: "video", order: 0 }],
    caption: "Campus video",
    hashtags: [],
    createdAt: "2026-08-21T12:00:00.000Z",
    updatedAt: "2026-08-21T12:00:00.000Z",
    likeCount: 0,
    commentCount: 0,
    saveCount: 0,
    shareCount: 0,
    likesVisible: true,
    commentsEnabled: true,
    ...overrides,
  };
}

test("own-campus videos stay ahead of global expansion without admitting non-video posts", () => {
  const viewer = user("viewer", "tamu");
  const ownAuthor = user("own-author", "tamu");
  const globalAuthor = user("global-author", "lsu");
  const ranked = rankVisibleVideoMintz(
    [
      mint("global-popular", globalAuthor.account.id, { likeCount: 500 }),
      mint("own-campus", ownAuthor.account.id),
      mint("image-only", ownAuthor.account.id, {
        media: [{ id: "image", type: "image", order: 0 }],
      }),
    ],
    {
      viewer,
      users: [viewer, ownAuthor, globalAuthor],
      follows: [],
      currentTime: Date.parse("2026-08-22T12:00:00.000Z"),
    },
  );

  assert.deepEqual(
    ranked.map((candidate) => candidate.id),
    ["own-campus", "global-popular"],
  );
});

test("a provisional identity does not inherit its legacy configured campus ranking boost", () => {
  const viewer = user("viewer", "tamu");
  viewer.account.universityIdentityId = "edu:newcollege.edu";
  viewer.account.universityDomain = "newcollege.edu";
  viewer.account.knownUniversityId = null;
  const tamuAuthor = user("tamu-author", "tamu");
  const lsuAuthor = user("lsu-author", "lsu");
  const ranked = rankVisibleVideoMintz(
    [
      mint("tamu-low", tamuAuthor.account.id),
      mint("lsu-high", lsuAuthor.account.id, { likeCount: 20 }),
    ],
    {
      viewer,
      users: [viewer, tamuAuthor, lsuAuthor],
      follows: [],
      currentTime: Date.parse("2026-08-22T12:00:00.000Z"),
    },
  );

  assert.equal(ranked[0].id, "lsu-high");
});

test("video viewer state preserves the exact feed return point and tapped Mint", () => {
  const state = createMintVideoViewerState({
    mintId: "tapped",
    mediaId: "video-2",
    feedScrollY: 847.5,
    orderedMintIds: ["ranked-1", "ranked-1", "ranked-2"],
  });

  assert.deepEqual(state.orderedMintIds, ["tapped", "ranked-1", "ranked-2"]);
  assert.equal(getMintVideoViewerReturnScrollY(state, 0), 847.5);
  assert.equal(getMintVideoViewerReturnScrollY(null, -20), 0);
});

test("own-Mint settings can update each editable field independently", () => {
  const original = mint("editable", "viewer");
  const visibility = applyEditableMintPatch(
    original,
    { likesVisible: false },
    "2026-08-22T13:00:00.000Z",
  );
  const comments = applyEditableMintPatch(
    original,
    { commentsEnabled: false },
    "2026-08-22T13:01:00.000Z",
  );
  const caption = applyEditableMintPatch(
    original,
    { caption: "Updated caption" },
    "2026-08-22T13:02:00.000Z",
  );

  assert.equal(visibility.likesVisible, false);
  assert.equal(visibility.caption, original.caption);
  assert.equal(comments.commentsEnabled, false);
  assert.equal(caption.caption, "Updated caption");
  assert.equal(applyEditableMintPatch(original, {}, original.updatedAt), null);
});

test("repost toggle still adds, cancels, and updates its count", () => {
  const input = {
    mintId: "mint-1",
    userId: "viewer",
    repostId: "repost-1",
    createdAt: "2026-08-23T12:00:00.000Z",
  };
  const added = toggleRepostRecords([], input);

  assert.equal(added.reposted, true);
  assert.equal(added.reposts.length, 1);
  assert.equal(nextRepostCount(4, added.reposted), 5);

  const cancelled = toggleRepostRecords(added.reposts, input);

  assert.equal(cancelled.reposted, false);
  assert.equal(cancelled.reposts.length, 0);
  assert.equal(nextRepostCount(5, cancelled.reposted), 4);
  assert.equal(nextRepostCount(0, false), 0);
});

test("local Mint media derives supported MIME and carousel types without a choice screen", () => {
  assert.equal(getMintMediaType("image/jpeg"), "image");
  assert.equal(getMintMediaType("video/mp4"), "video");
  assert.equal(getMintMediaType("application/pdf"), null);
  assert.equal(getMintContentType([]), "text");
  assert.equal(getMintContentType([{ type: "image" }]), "image");
  assert.equal(getMintContentType([{ type: "video" }]), "video");
  assert.equal(
    getMintContentType([{ type: "image" }, { type: "video" }]),
    "carousel",
  );
});
