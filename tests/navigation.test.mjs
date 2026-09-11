import assert from "node:assert/strict";
import test from "node:test";

import {
  bottomNavigationSlots,
  createMintAction,
  dailyNavigation,
  getBottomNavigationSlotIndex,
  getPrimaryNavigationIndex,
  migrateStoredPrimarySection,
  secondaryNavigation,
} from "../components/shell/navigation.ts";
import { SectionMemory } from "../lib/navigation/sectionMemory.ts";
import { readFileSync } from "node:fs";

const headerSource = readFileSync(
  new URL("../components/shell/TopUtilityBar.tsx", import.meta.url),
  "utf8",
);

const primaryIds = [...dailyNavigation, ...secondaryNavigation].map(
  (item) => item.id,
);

test("retired Search and discovery section IDs migrate safely to Mint", () => {
  for (const legacy of [
    "search",
    "people",
    "housing",
    "food",
    "tutoring",
    "clubs",
    "events",
    "marketplace",
  ]) {
    assert.equal(migrateStoredPrimarySection(legacy), "mint");
  }
});

test("current and unknown stored section IDs have safe outcomes", () => {
  assert.equal(migrateStoredPrimarySection("groups"), "groups");
  assert.equal(migrateStoredPrimarySection("sports"), "sports");
  assert.equal(migrateStoredPrimarySection("mint"), "mint");
  assert.equal(migrateStoredPrimarySection("future-unknown"), "mint");
  assert.equal(migrateStoredPrimarySection(null), "mint");
});

test("Search, discovery categories, and Create Mint are not primary sections", () => {
  for (const removed of [
    "search",
    "people",
    "housing",
    "food",
    "tutoring",
    "clubs",
    "events",
    "marketplace",
    createMintAction.id,
  ]) {
    assert.equal(primaryIds.includes(removed), false);
  }
  assert.deepEqual(primaryIds, [
    "messages",
    "mint",
    "sports",
    "groups",
  ]);
});

test("header groups Search with profile and notifications with settings", () => {
  assert.match(headerSource, /data-header-group="profile-search"/);
  assert.match(headerSource, /data-header-group="settings-notifications"/);
});

test("Sports participates in the primary navigation sequence", () => {
  assert.equal(primaryIds.includes("sports"), true);
  assert.equal(getPrimaryNavigationIndex("sports"), 2);
  assert.equal(getBottomNavigationSlotIndex("sports") >= 0, true);
});

test("the primary navigation order has finite Messages and Groups boundaries", () => {
  assert.equal(primaryIds.at(0), "messages");
  assert.equal(primaryIds.at(-1), "groups");
  assert.equal(primaryIds[getPrimaryNavigationIndex("messages") - 1], undefined);
  assert.equal(primaryIds[getPrimaryNavigationIndex("groups") + 1], undefined);
});

test("the compact primary sequence still uses two-section memory", () => {
  const memory = new SectionMemory(primaryIds[1], 2);
  memory.capture("mint", 240);
  memory.commit("sports");
  memory.capture("sports", 520);
  memory.commit("groups");

  assert.deepEqual(memory.getRetainedSections(), ["groups", "sports"]);
  assert.equal(memory.commit("mint").refreshed, true);
});

test("Create Mint appears once without becoming a primary section", () => {
  const createSlots = bottomNavigationSlots.filter(
    (slot) => slot.kind === "action" && slot.action.id === createMintAction.id,
  );

  assert.equal(createSlots.length, 1);
  assert.equal(primaryIds.includes(createMintAction.id), false);
});

test("notch indices match every current primary section", () => {
  primaryIds.forEach((section, index) => {
    assert.equal(getPrimaryNavigationIndex(section), index);
    assert.equal(getBottomNavigationSlotIndex(section) >= 0, true);
  });
});
