import assert from "node:assert/strict";
import test from "node:test";
import { developmentUsers } from "../data/development/users.ts";
import { resolveFaceTimeHandoff, supportsFaceTimeHandoff } from "../lib/social/facetime.ts";

const viewer = developmentUsers.find((user) => user.account.id === "current-demo-student");
const noah = developmentUsers.find((user) => user.account.id === "demo-tamu-noah");
const jordan = developmentUsers.find((user) => user.account.id === "demo-tamu-jordan");
const follows = [{ id: "f", followerId: viewer.account.id, followingId: noah.account.id, createdAt: "2026-01-01T00:00:00.000Z" }];
test("eligible callable profile resolves an external FaceTime handoff", () => {
  const result = resolveFaceTimeHandoff({ viewer, target: noah, friendships: [], follows, supported: true });
  assert.equal(result.available, true);
  assert.match(result.href, /^facetime:/);
});
test("missing, private, and unsupported contacts fail without leaking a value", () => {
  assert.deepEqual(resolveFaceTimeHandoff({ viewer, target: jordan, friendships: [], follows: [], supported: true }), { available: false, reason: "missing_contact" });
  assert.deepEqual(resolveFaceTimeHandoff({ viewer, target: noah, friendships: [], follows: [], supported: true }), { available: false, reason: "privacy" });
  assert.deepEqual(resolveFaceTimeHandoff({ viewer, target: noah, friendships: [], follows, supported: false }), { available: false, reason: "unsupported_device" });
  assert.equal(supportsFaceTimeHandoff("Mozilla/5.0 (iPhone)"), true);
  assert.equal(supportsFaceTimeHandoff("Mozilla/5.0 (Android)"), false);
});
