import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { accumulateMeaningfulDwell, advanceFeedGeneration, applyCurrentPinsToGeneration, createFeedGeneration, flattenFeedGeneration, isFeedRefreshArmed, migrateSavedMintzToPins, normalizedDwellScore, rankOldMintz } from "../lib/social/feedGeneration.ts";

const cardSource = readFileSync(new URL("../components/mintz/MintCard.tsx", import.meta.url), "utf8");
const fullscreenSource = readFileSync(new URL("../components/mintz/FullscreenVideoViewer.tsx", import.meta.url), "utf8");
const mint = (id, createdAt) => ({ id, createdAt, likeCount: 0 });

test("feed generation is finite and orders pinned, new, then old without duplicates", () => {
  const eligibleMintz = [mint("new", "2026-09-10T12:00:00Z"), mint("old-b", "2026-09-09T12:00:00Z"), mint("old-a", "2026-09-08T12:00:00Z")];
  const generation = createFeedGeneration({ eligibleMintz, previousEligibleMintIds: ["old-a", "old-b"], pins: [{ id: "p", mintId: "old-a", userId: "viewer", pinnedAt: "2026-09-10T13:00:00Z" }], viewerId: "viewer", dwell: [], privateAppreciations: [], publicEndorsements: [], generationId: 2, now: "2026-09-10T14:00:00Z" });
  assert.deepEqual(generation.pinnedMintIds, ["old-a"]);
  assert.deepEqual(generation.newMintIds, ["new"]);
  assert.deepEqual(generation.oldMintIds, ["old-b"]);
  assert.deepEqual(flattenFeedGeneration(generation), ["old-a", "new", "old-b"]);
  assert.equal(new Set(flattenFeedGeneration(generation)).size, 3);
});
test("first generation is normal content and unpin restores prior classification", () => {
  const first = createFeedGeneration({ eligibleMintz: [mint("a", "2026-09-10T00:00:00Z")], previousEligibleMintIds: null, pins: [], viewerId: "viewer", dwell: [], privateAppreciations: [], publicEndorsements: [], generationId: 0, now: "2026-09-10T00:00:00Z" });
  assert.equal(first.refreshed, false);
  assert.deepEqual(first.oldMintIds, []);
  const pinned = { ...first, pinnedMintIds: ["a"], newMintIds: [] };
  assert.deepEqual(applyCurrentPinsToGeneration(pinned, [], "viewer").newMintIds, ["a"]);
});
test("old ranking uses meaningful dwell and positive signals deterministically with a cap", () => {
  const mints = [mint("low", "2026-09-10T00:00:00Z"), mint("high", "2026-09-10T00:00:00Z"), mint("liked", "2026-09-10T00:00:00Z")];
  const ranked = rankOldMintz({ mints, viewerId: "viewer", dwell: [{ mintId: "low", userId: "viewer", totalMeaningfulDwellMs: 5000, lastViewedAt: "x", viewSessions: 1 }, { mintId: "high", userId: "viewer", totalMeaningfulDwellMs: 50000, lastViewedAt: "x", viewSessions: 1 }], privateAppreciations: [{ id: "l", mintId: "liked", userId: "viewer", createdAt: "x", source: "double_tap" }], publicEndorsements: [] });
  assert.ok(ranked.findIndex((item) => item.id === "high") < ranked.findIndex((item) => item.id === "low"));
  assert.ok(ranked.findIndex((item) => item.id === "liked") < ranked.findIndex((item) => item.id === "low"));
  assert.equal(normalizedDwellScore(9e9), normalizedDwellScore(120000));
});
test("dwell ignores hidden/offscreen/inactive time and caps sessions", () => {
  const base = { mintId: "a", userId: "viewer", elapsedMs: 50000, meaningfulVisible: true, documentVisible: true, activeSurface: true, now: "x" };
  assert.equal(accumulateMeaningfulDwell(null, { ...base, meaningfulVisible: false }), null);
  assert.equal(accumulateMeaningfulDwell(null, { ...base, documentVisible: false }), null);
  assert.equal(accumulateMeaningfulDwell(null, { ...base, activeSurface: false }), null);
  assert.equal(accumulateMeaningfulDwell(null, { ...base, elapsedMs: 9e9 }).totalMeaningfulDwellMs, 120000);
});
test("refresh threshold is deliberate and legacy Save migrates privately to Pin", () => {
  assert.equal(isFeedRefreshArmed(63), false);
  assert.equal(isFeedRefreshArmed(64), true);
  assert.equal(migrateSavedMintzToPins({ saves: [{ id: "s", mintId: "a", userId: "viewer", createdAt: "x" }], userId: "viewer", fallbackPinnedAt: "fallback" })[0].mintId, "a");
});
test("consumer Save and Repost controls are absent while Pin is shared across feed and fullscreen", () => {
  assert.match(cardSource, /Pin Mint/);
  assert.match(fullscreenSource, /Pin Mint/);
  assert.doesNotMatch(cardSource, /Repost Mint|Save Mint|Unsave Mint/);
  assert.doesNotMatch(fullscreenSource, /Repost Mint|Save Mint|Unsave Mint/);
});

test("initial server arrival, publication and one completed refresh reveal their new posts without resetting finite sessions on every render", () => {
  const input = { eligibleMintz: [], pins: [], viewerId: "viewer", dwell: [], privateAppreciations: [], publicEndorsements: [], now: "2026-09-27T12:00:00Z" };
  const cursor = { feedScope: "viewer:tamu", refreshGeneration: 0, feedRevision: 0 };
  const initial = { cursor, generation: createFeedGeneration({ ...input, previousEligibleMintIds: null, generationId: 0 }) };
  const existing = mint("existing", "2026-09-27T11:00:00Z");
  const loaded = advanceFeedGeneration(initial, { ...cursor, feedRevision: 1 }, { ...input, eligibleMintz: [existing] });
  assert.deepEqual(flattenFeedGeneration(loaded.generation), ["existing"]);
  const own = mint("just-published", "2026-09-27T12:00:00Z");
  const published = advanceFeedGeneration(loaded, { ...cursor, feedRevision: 2 }, { ...input, eligibleMintz: [existing, own] });
  assert.deepEqual(flattenFeedGeneration(published.generation), ["just-published", "existing"]);
  const future = mint("server-arrival", "2026-09-27T12:05:00Z");
  const unchanged = advanceFeedGeneration(published, published.cursor, { ...input, now: "2026-09-27T12:05:00Z", eligibleMintz: [existing, own, future] });
  assert.equal(unchanged, published, "incidental rerenders preserve the finite session and scroll order");
  const refreshed = advanceFeedGeneration(published, { ...cursor, feedRevision: 3 }, { ...input, eligibleMintz: [existing, own, future] });
  assert.equal(flattenFeedGeneration(refreshed.generation)[0], "server-arrival");
  assert.equal(flattenFeedGeneration(refreshed.generation).length, 3);
  const switched = advanceFeedGeneration(refreshed, { ...cursor, feedScope: "different:tamu", feedRevision: 3 }, input);
  assert.deepEqual(flattenFeedGeneration(switched.generation), []);
  assert.deepEqual(switched.generation.previousEligibleMintIds, []);
});
