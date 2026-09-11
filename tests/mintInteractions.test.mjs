import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  formatCompactCount,
  getCreatorAppreciationMetrics,
  getPublicEndorsementContext,
  migrateMintInteractionState,
  PUBLIC_ENDORSEMENT_ACTIVE_COLOR,
  registerPrivateAppreciation,
  resolvePublicMintMetrics,
  resolveViewerMintPresentation,
  togglePublicEndorsement,
} from "../lib/social/mintInteractions.ts";

const createdAt = "2026-08-29T12:00:00.000Z";

test("private appreciation registers once and stays separate from public endorsement", () => {
  const first = registerPrivateAppreciation([], {
    mintId: "mint-1",
    userId: "viewer",
    createdAt,
    source: "double_tap",
  });
  const duplicate = registerPrivateAppreciation(first.records, {
    mintId: "mint-1",
    userId: "viewer",
    createdAt,
    source: "double_tap",
  });

  assert.equal(first.added, true);
  assert.equal(duplicate.added, false);
  assert.equal(duplicate.records.length, 1);
  assert.equal(togglePublicEndorsement([], {
    mintId: "mint-1",
    userId: "viewer",
    createdAt,
  }).records.length, 1);
  assert.equal(first.records.some((record) => "publiclyEndorsed" in record), false);
});

test("public endorsement toggles independently and always uses the red active color", () => {
  const first = togglePublicEndorsement([], { mintId: "mint-1", userId: "viewer", createdAt });
  const second = togglePublicEndorsement(first.records, { mintId: "mint-1", userId: "viewer", createdAt });

  assert.equal(first.endorsed, true);
  assert.equal(second.endorsed, false);
  assert.equal(second.records.length, 0);
  assert.equal(PUBLIC_ENDORSEMENT_ACTIVE_COLOR, "#ef4444");
});

test("friend endorsement context is deterministic and excludes blocked or ineligible people", () => {
  const endorsements = [
    { id: "e-z", mintId: "mint-1", userId: "friend-z", createdAt },
    { id: "e-a", mintId: "mint-1", userId: "friend-a", createdAt },
    { id: "e-blocked", mintId: "mint-1", userId: "blocked", createdAt },
    { id: "e-private", mintId: "mint-1", userId: "ineligible", createdAt },
  ];
  const follows = [
    { id: "f-z", followerId: "viewer", followingId: "friend-z", createdAt },
    { id: "f-a", followerId: "viewer", followingId: "friend-a", createdAt },
    { id: "f-b", followerId: "viewer", followingId: "blocked", createdAt },
    { id: "f-p", followerId: "viewer", followingId: "ineligible", createdAt },
  ];
  const context = getPublicEndorsementContext({
    mintId: "mint-1",
    viewerId: "viewer",
    endorsements,
    friendships: [],
    follows,
    blocks: [{ id: "block", blockerId: "viewer", blockedId: "blocked", createdAt }],
    eligibleUserIds: ["friend-z", "friend-a", "blocked"],
  });

  assert.deepEqual(context.userIds, ["friend-a", "friend-z"]);
  assert.equal(context.additionalCount, 0);
});

test("legacy ambiguous Likes migrate only to private appreciation", () => {
  const migrated = migrateMintInteractionState({
    likes: [{ id: "old-like", mintId: "mint-1", userId: "viewer", createdAt }],
  });

  assert.equal(migrated.privateAppreciations.length, 1);
  assert.equal(migrated.privateAppreciations[0].source, "legacy_like");
  assert.equal(migrated.publicEndorsements.length, 0);
});

test("creator resolves aggregate appreciation while ordinary viewers receive no Like total", () => {
  const privateAppreciations = [{ id: "p1", mintId: "mint-1", userId: "viewer", createdAt, source: "double_tap" }];
  const creator = getCreatorAppreciationMetrics({
    mintId: "mint-1",
    authorId: "author",
    viewerId: "author",
    privateAppreciations,
    publicEndorsements: [],
    legacyAggregate: 7,
    viewCount: 12400,
    commentCount: 18,
  });
  const ordinary = resolveViewerMintPresentation({
    viewCount: 12400,
    commentCount: 18,
    attendingCount: 83,
    memberCount: 240,
    publiclyEndorsed: false,
    friendEndorserIds: [],
  });

  assert.equal(creator.appreciationCount, 7);
  assert.equal(getCreatorAppreciationMetrics({
    mintId: "mint-1",
    authorId: "author",
    viewerId: "viewer",
    privateAppreciations,
    publicEndorsements: [],
    viewCount: 1,
    commentCount: 1,
  }), null);
  assert.equal(Object.hasOwn(ordinary, "likeCount"), false);
  assert.deepEqual(ordinary.metrics.map((metric) => metric.kind), ["views", "comments", "attending", "members"]);
});

test("public metrics and compact formatting are deterministic without a Like metric", () => {
  assert.equal(formatCompactCount(999), "999");
  assert.equal(formatCompactCount(12400), "12K");
  assert.equal(formatCompactCount(2400000), "2.4M");
  const metrics = resolvePublicMintMetrics({ viewCount: 12400, commentCount: 12, attendingCount: 85, memberCount: 420 });
  assert.deepEqual(metrics.map((metric) => metric.label), ["12K views", "12 comments", "85 attending", "420 members"]);
  assert.equal(metrics.some((metric) => metric.kind === "likes"), false);
});

test("the obsolete flying-heart implementation is absent", () => {
  assert.equal(existsSync(new URL("../components/mintz/LikeHeartFlight.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../lib/social/likeFeedback.ts", import.meta.url)), false);
  const cardSource = readFileSync(new URL("../components/mintz/MintCard.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(cardSource, /LikeHeartFlight|cm-like-flight|getLikeFlightVector/);
});
