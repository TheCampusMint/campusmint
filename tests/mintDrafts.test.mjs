import assert from "node:assert/strict";
import test from "node:test";
import { readMintDrafts, upsertMintDraft, removeMintDraft, writeMintDrafts } from "../lib/content/mintDrafts.ts";

const fields = { caption: "Next post", postType: "personal", commentsEnabled: true, privacy: "private", durationHours: "permanent", locationChoice: "none", customLocation: "", existingEventId: "", eventTitle: "", eventDate: "", eventStartTime: "", eventEndTime: "", eventLocation: "", eventLocationDetails: "", eventDescription: "", selectedOrganizationId: "", taggedOrganizationId: "", organizationAudience: "public", mediaFileNames: ["photo.png"], mediaCount: 1 };

test("saving and editing a draft retains its stable id and creation time", () => {
  const first = upsertMintDraft([], "account-a", { ...fields, id: "draft-selected" }, "2026-09-26T10:00:00Z");
  assert.equal(first[0].id, "draft-selected");
  const edited = upsertMintDraft(first, "account-a", { ...fields, id: first[0].id, caption: "Edited" }, "2026-09-27T10:00:00Z");
  assert.equal(edited.length, 1);
  assert.equal(edited[0].caption, "Edited");
  assert.equal(edited[0].createdAt, first[0].createdAt);
  assert.deepEqual(removeMintDraft(edited, first[0].id), []);
});

test("legacy draft migration is account scoped and preserves media names and settings", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const drafts = upsertMintDraft([], "account-a", fields);
  writeMintDrafts(storage, "account-a", drafts);
  assert.deepEqual(readMintDrafts(storage, "account-b"), []);
  assert.deepEqual(readMintDrafts(storage, "account-a"), drafts);
  values.set("campusmint:mint-drafts:account-a:v1", "broken");
  assert.deepEqual(readMintDrafts(storage, "account-a"), []);
});

test("draft persistence preserves the publish request id across reopening and editing", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const publishRequestId = "1218db39-aea3-43b7-b7b0-2391b734ab46";
  const saved = upsertMintDraft([], "account-a", { ...fields, publishRequestId });
  writeMintDrafts(storage, "account-a", saved);
  const reopened = readMintDrafts(storage, "account-a");
  assert.equal(reopened[0].publishRequestId, publishRequestId);
  const updated = upsertMintDraft(reopened, "account-a", { ...reopened[0], caption: "Retry after lost response" });
  assert.equal(updated[0].publishRequestId, publishRequestId);
});
