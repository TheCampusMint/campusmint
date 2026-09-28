import assert from "node:assert/strict";
import test from "node:test";

import { mintPublishIntent, nextMintPublishAttempt, restoreMintPublishAttempt } from "../lib/content/mintPublishIntent.ts";
import { accountScopedValue, activateAccountRequestScope, beginAccountRequest, createAccountRequestScope } from "../lib/content/accountRequestScope.ts";

const fields = {
  caption: "Meet at the library", postType: "personal", composerKind: "post", commentsEnabled: true, privacy: "account", durationHours: "permanent",
  locationChoice: "none", customLocation: "", existingEventId: "", eventTitle: "", eventDate: "", eventStartTime: "", eventEndTime: "", eventLocation: "", eventLocationDetails: "", eventDescription: "", selectedOrganizationId: "", taggedOrganizationId: "", organizationAudience: "public", mediaFileNames: [], mediaCount: 0,
};
const media = [{ file: new File(["first"], "photo.webp", { type: "image/webp", lastModified: 123 }), media: { id: "selection-1", url: "data:original-preview" } }];

test("unchanged publish retries preserve the request across reopened drafts and regenerated preview URLs", () => {
  const intent = mintPublishIntent(fields, media);
  const first = nextMintPublishAttempt("original", null, intent, () => "unexpected-new-id");
  const restored = restoreMintPublishAttempt({ publishRequestId: first.requestId, publishIntent: first.intent }, () => "unexpected-new-id");
  const retryIntent = mintPublishIntent({ ...fields, expiresAt: "a newly calculated timestamp" }, [{ ...media[0], media: { ...media[0].media, url: "blob:reopened-preview" } }]);
  assert.equal(retryIntent, intent);
  assert.equal(nextMintPublishAttempt(restored.requestId, restored.intent, retryIntent, () => "unexpected-new-id").requestId, "original");
});

test("editing saved content after an ambiguous publish changes its request instead of discarding the edits as a retry", () => {
  const oldIntent = mintPublishIntent(fields, media);
  for (const patch of [{ caption: "Meet somewhere else" }, { privacy: "private" }, { commentsEnabled: false }, { durationHours: "24" }, { taggedOrganizationId: "club-2" }, { existingEventId: "event-2" }, { locationChoice: "custom", customLocation: "Another place" }, { postType: "club", selectedOrganizationId: "club-1" }]) {
    const editedIntent = mintPublishIntent({ ...fields, ...patch }, media);
    assert.equal(nextMintPublishAttempt("old", oldIntent, editedIntent, () => "edited").requestId, "edited");
  }
  const poll = { ...fields, composerKind: "poll", pollQuestion: "Where?", pollOptions: ["Library", "Cafe"] };
  const changedPoll = mintPublishIntent({ ...poll, pollOptions: ["Library", "Park"] }, []);
  assert.equal(nextMintPublishAttempt("old", mintPublishIntent(poll, []), changedPoll, () => "edited").requestId, "edited");
  const replaced = [{ ...media[0], media: { ...media[0].media, id: "selection-2" } }];
  assert.equal(nextMintPublishAttempt("old", oldIntent, mintPublishIntent(fields, replaced), () => "edited").requestId, "edited", "reselecting a file with the same metadata is still a distinct media selection");
});

test("an edited draft saved and reopened still compares against its last attempted content", () => {
  const originalIntent = mintPublishIntent(fields, []);
  const savedEditedDraft = { ...fields, caption: "Edited after network interruption", publishRequestId: "original", publishIntent: originalIntent };
  const restored = restoreMintPublishAttempt(savedEditedDraft);
  const next = nextMintPublishAttempt(restored.requestId, restored.intent, mintPublishIntent(savedEditedDraft, []), () => "edited");
  assert.equal(next.requestId, "edited");
  assert.notEqual(next.intent, originalIntent);
});

test("legacy drafts with an unknown prior attempt keep their content but cannot silently reuse that request", () => {
  const restored = restoreMintPublishAttempt({ publishRequestId: "legacy" }, () => "fresh");
  assert.equal(restored.requestId, "fresh");
  assert.equal(restored.uncertainLegacyAttempt, true);
  assert.equal(restoreMintPublishAttempt({}, () => "fresh").uncertainLegacyAttempt, false);
});

test("account switches immediately hide private choices and invalidate late feed responses even if abort is ignored", async () => {
  const scope = createAccountRequestScope("A");
  let stored = { owner: "A", feed: [{ id: "poll", selectedOptionId: "private-A-choice" }] };
  const a = beginAccountRequest(scope, "A");
  assert.deepEqual(accountScopedValue(stored.owner, "B", stored.feed, []), []);
  activateAccountRequestScope(scope, "B");
  assert.equal(a.signal.aborted, true);
  const b = beginAccountRequest(scope, "B");
  assert.equal(beginAccountRequest(scope, "A"), null, "stale account callbacks cannot start replacement requests");
  const lateA = async () => { await Promise.resolve(); if (a.isCurrent()) stored = { owner: "A", feed: [{ id: "poll", selectedOptionId: "private-A-choice" }] }; };
  if (b.isCurrent()) stored = { owner: "B", feed: [{ id: "poll", selectedOptionId: "B-choice" }] };
  await lateA();
  assert.equal(stored.owner, "B");
  assert.equal(accountScopedValue(stored.owner, "B", stored.feed, [])[0].selectedOptionId, "B-choice");
  activateAccountRequestScope(scope, "");
  assert.equal(b.isCurrent(), false);
});

test("a newer refresh or successful publish invalidates an older same-account feed snapshot", () => {
  const scope = createAccountRequestScope("A");
  const old = beginAccountRequest(scope, "A");
  const newer = beginAccountRequest(scope, "A");
  assert.equal(old.isCurrent(), false);
  assert.equal(newer.isCurrent(), true);
  activateAccountRequestScope(scope, "A");
  assert.equal(newer.isCurrent(), false);
});
