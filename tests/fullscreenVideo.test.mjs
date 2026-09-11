import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createMintVideoViewerState,
  getMintVideoViewerReturnScrollY,
  resolveVideoViewerGesture,
} from "../lib/social/videoViewerState.ts";

const source = readFileSync(
  new URL("../components/mintz/FullscreenVideoViewer.tsx", import.meta.url),
  "utf8",
);

test("fullscreen viewer has no visible X, old action rail, or campus-color top strip", () => {
  assert.doesNotMatch(source, />\s*[×✕]\s*</);
  assert.match(source, /aria-label="Close video viewer" className="sr-only/);
  assert.doesNotMatch(source, /toggleLike\(|Like video Mint|Unlike video Mint|LikeHeartFlight/);
  assert.doesNotMatch(source, /CampusMintMediaHeader|campus-color top|borderTopColor/);
});

test("fullscreen viewer uses shared Comment, Share, and public-endorsement controls", () => {
  assert.match(source, /CommentAction/);
  assert.match(source, /ShareAction/);
  assert.match(source, /PublicEndorsementAction/);
  assert.match(source, /MintCommentsSheet/);
  assert.doesNotMatch(source, /absolute[^\n]+right[^\n]+flex flex-col[^\n]+Like/i);
});

test("horizontal and vertical gestures coexist behind a direction lock", () => {
  assert.equal(resolveVideoViewerGesture({ deltaX: 86, deltaY: 6, committed: true }), "exit");
  assert.equal(resolveVideoViewerGesture({ deltaX: -86, deltaY: 6, committed: true }), "creator");
  assert.equal(resolveVideoViewerGesture({ deltaX: 4, deltaY: -70, committed: true }), "next");
  assert.equal(resolveVideoViewerGesture({ deltaX: 4, deltaY: 70, committed: true }), "previous");
  assert.equal(resolveVideoViewerGesture({ deltaX: 26, deltaY: 24, committed: false }), "pending");
  assert.equal(resolveVideoViewerGesture({ deltaX: 26, deltaY: 24, committed: true }), "cancel");
});

test("viewer return state preserves exact Mint, media, order, and feed scroll", () => {
  const state = createMintVideoViewerState({
    mintId: "mint-active",
    mediaId: "media-active",
    feedScrollY: 932.25,
    orderedMintIds: ["mint-active", "mint-next"],
  });

  assert.equal(state.mintId, "mint-active");
  assert.equal(state.mediaId, "media-active");
  assert.deepEqual(state.orderedMintIds, ["mint-active", "mint-next"]);
  assert.equal(getMintVideoViewerReturnScrollY(state), 932.25);
  assert.match(source, /if \(entries\.length === 0 \|\| suspended\) return null/);
});
