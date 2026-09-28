import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { developmentUsers } from "../data/development/users.ts";
import { rankRelevantEventAttendees } from "../lib/events/attendingContext.ts";

const viewer = developmentUsers.find((user) => user.account.id === "current-demo-student");
const candidates = developmentUsers.filter((user) => ["demo-tamu-noah", "demo-seller-tamu", "demo-tamu-jordan", "demo-tamu-officer"].includes(user.account.id));
const follows = candidates.flatMap((user, index) => [{ id: `f-${index}`, followerId: viewer.account.id, followingId: user.account.id, createdAt: "x" }, ...(index === 1 ? [{ id: "back", followerId: user.account.id, followingId: viewer.account.id, createdAt: "x" }] : [])]);
test("attending context is deterministic, privacy-filtered, relevance-ranked, and capped at three", () => {
  const input = { viewer, candidates, attendingUserIds: candidates.map((user) => user.account.id), friendships: [], follows, blocks: [], messageAffinityByUserId: { "demo-tamu-noah": 8 }, maximum: 3 };
  const first = rankRelevantEventAttendees(input);
  const second = rankRelevantEventAttendees(input);
  assert.equal(first.length, 3);
  assert.deepEqual(first.map((item) => item.user.account.id), second.map((item) => item.user.account.id));
  assert.equal(first[0].user.account.id, "demo-tamu-jordan");
  const blocked = rankRelevantEventAttendees({ ...input, blocks: [{ id: "b", blockerId: viewer.account.id, blockedId: first[0].user.account.id, createdAt: "x" }] });
  assert.ok(!blocked.some((item) => item.user.account.id === first[0].user.account.id));
});
test("event UI exposes only Attending, never Interested", () => {
  const sources = ["../components/mintz/MintCard.tsx", "../components/events/EventCard.tsx", "../components/events/EventMomentEventDetail.tsx"].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
  assert.match(sources, /Attending/);
  assert.doesNotMatch(sources, /[>"\']Interested[<"\']/);
});
