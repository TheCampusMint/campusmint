import assert from "node:assert/strict";
import test from "node:test";

import {
  findOrganizationHandleConflict,
  findOrganizationNameConflict,
  normalizeOrganizationName,
  suggestOrganizationHandle,
} from "../lib/organizationIdentity.ts";

const tamuPhotography = {
  id: "club-tamu-photography",
  universityId: "tamu",
  name: "Photography Club",
  normalizedName: normalizeOrganizationName("Photography Club"),
  handle: "tamu-photography",
  recordStatus: "active",
};

test("club normalization blocks capitalization, whitespace, and punctuation bypasses", () => {
  const variants = [
    "Photography Club",
    "photography club",
    "PHOTOGRAPHY CLUB",
    "Photography   Club",
    "Photography-Club",
    "Photography.Club",
  ];
  assert.equal(new Set(variants.map(normalizeOrganizationName)).size, 1);
});

test("an exact normalized name conflicts only inside the same university", () => {
  const records = [tamuPhotography];
  assert.equal(findOrganizationNameConflict("tamu", "PHOTOGRAPHY   CLUB", records)?.resolution, "open_existing");
  assert.equal(findOrganizationNameConflict("lsu", "Photography Club", records), null);
});

test("conservative near-duplicate matching finds equivalent club labels", () => {
  const conflict = findOrganizationNameConflict("tamu", "Photography Society", [tamuPhotography]);
  assert.equal(conflict?.match, "near");
  assert.equal(conflict?.record.id, tamuPhotography.id);
});

test("archived matches use the reactivation path instead of creating a duplicate", () => {
  const archived = { ...tamuPhotography, recordStatus: "archived" };
  assert.equal(findOrganizationNameConflict("tamu", "Photography Club", [archived])?.resolution, "request_reactivation");
});

test("an active record wins over an older archived match", () => {
  const archived = { ...tamuPhotography, id: "archived-photography", recordStatus: "archived" };
  const conflict = findOrganizationNameConflict("tamu", "Photography Club", [archived, tamuPhotography]);
  assert.equal(conflict?.record.id, tamuPhotography.id);
  assert.equal(conflict?.resolution, "open_existing");
});

test("handle suggestions are machine-friendly and independent from display names", () => {
  assert.equal(suggestOrganizationHandle("tamu", "Texas A&M Photography Club"), "tamu-photography");
});

test("club handles are globally unique across universities", () => {
  const conflict = findOrganizationHandleConflict("TAMU Photography", [tamuPhotography]);
  assert.equal(conflict?.id, tamuPhotography.id);
});
