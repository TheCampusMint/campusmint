import assert from "node:assert/strict";
import test from "node:test";

import {
  closeUnifiedSearchDetail,
  filterUnifiedSearchCandidates,
  getAnchoredSearchScrollY,
  migrateUnifiedSearchCategory,
  openUnifiedSearchDetail,
  requestUnifiedSearchDismiss,
  setUnifiedSearchCategory,
  unifiedSearchCategories,
} from "../lib/search/unifiedSearch.ts";

const candidates = [
  {
    id: "event-tamu",
    title: "TAMU Event",
    subtitle: "College Station",
    category: "events",
    typeLabel: "Event",
    searchText: "tamu kickoff event",
    scope: { kind: "campus", campusId: "tamu" },
    detail: { kind: "event", id: "event-tamu" },
  },
  {
    id: "event-lsu",
    title: "LSU Event",
    subtitle: "Baton Rouge",
    category: "events",
    typeLabel: "Event",
    searchText: "lsu service event",
    scope: { kind: "campus", campusId: "lsu" },
    detail: { kind: "event", id: "event-lsu" },
  },
  {
    id: "market-bcs",
    title: "Desk Lamp",
    subtitle: "BCS network",
    category: "marketplace",
    typeLabel: "Market",
    searchText: "desk lamp marketplace",
    scope: { kind: "campus_network", campusNetworkId: "bcs" },
    detail: { kind: "marketplace", id: "market-bcs" },
  },
];

const tamuAccess = {
  configuredUniversityId: "tamu",
  accessibleCampusIds: ["tamu"],
  campusNetworkId: "bcs",
  blockedUserIds: ["person-blocked"],
  marketplaceAllowed: true,
};

test("retired People discovery category returns no Search results", () => {
  const people = filterUnifiedSearchCandidates(
    candidates,
    { category: "people", query: "" },
    tamuAccess,
  );
  assert.deepEqual(people, []);
});

test("campus and network results stay inside their allowed category scopes", () => {
  const ids = ["events", "marketplace"].flatMap((category) =>
    filterUnifiedSearchCandidates(
      candidates,
      { category, query: "" },
      tamuAccess,
    ).map((candidate) => candidate.id),
  );

  assert.equal(ids.includes("event-tamu"), true);
  assert.equal(ids.includes("event-lsu"), false);
  assert.equal(ids.includes("market-bcs"), true);
});

test("provisional universities do not inherit configured campus discovery", () => {
  const access = {
    configuredUniversityId: null,
    accessibleCampusIds: [],
    campusNetworkId: null,
    blockedUserIds: ["person-blocked"],
    marketplaceAllowed: true,
  };
  const visibleIds = new Set(
    unifiedSearchCategories.flatMap((category) =>
      filterUnifiedSearchCandidates(
        candidates,
        { category, query: "" },
        access,
      ).map((candidate) => candidate.id),
    ),
  );

  assert.deepEqual([...visibleIds], []);
});

test("Search exposes only Food, Events, and Sell while retired state migrates safely", () => {
  assert.deepEqual(unifiedSearchCategories, [
    "food",
    "events",
    "marketplace",
  ]);
  assert.equal(unifiedSearchCategories.includes("all"), false);
  assert.equal(unifiedSearchCategories.includes("housing"), false);
  assert.equal(migrateUnifiedSearchCategory("all"), "food");
  assert.equal(migrateUnifiedSearchCategory("housing"), "food");
  assert.equal(migrateUnifiedSearchCategory("people"), "food");
  assert.equal(migrateUnifiedSearchCategory("tutoring"), "food");
  assert.equal(migrateUnifiedSearchCategory("clubs"), "food");
  assert.equal(migrateUnifiedSearchCategory("events"), "events");
  assert.equal(migrateUnifiedSearchCategory("unknown"), "food");
});

test("selected category and query both constrain Search results", () => {
  const events = filterUnifiedSearchCandidates(
    candidates,
    { category: "events", query: "kickoff" },
    tamuAccess,
  );
  const wrongCategory = filterUnifiedSearchCandidates(
    candidates,
    { category: "marketplace", query: "kickoff" },
    tamuAccess,
  );

  assert.deepEqual(events.map((candidate) => candidate.id), ["event-tamu"]);
  assert.equal(wrongCategory.length, 0);
});

test("category switching stays inside Search state and preserves its viewport anchor", () => {
  const state = {
    category: "food",
    query: "maya",
    categoryFilters: { none: null },
    history: [],
  };

  const next = setUnifiedSearchCategory(state, "events");
  const anchoredScrollY = getAnchoredSearchScrollY({
    currentScrollY: 430,
    previousAnchorY: 120,
    nextAnchorY: 170,
  });

  assert.equal(next.category, "events");
  assert.equal(next.query, "maya");
  assert.equal(anchoredScrollY, 480);
  assert.deepEqual(next.categoryFilters, state.categoryFilters);
});

test("internal Search detail state preserves query and category outside primary navigation", () => {
  const state = {
    category: "events",
    query: "kickoff",
    categoryFilters: { none: null },
    history: [],
  };

  const opened = openUnifiedSearchDetail(state, {
    kind: "event",
    id: "event-kickoff",
  });
  const closed = closeUnifiedSearchDetail(opened);

  assert.equal(opened.category, "events");
  assert.equal(opened.query, "kickoff");
  assert.deepEqual(opened.history, [
    { kind: "event", id: "event-kickoff" },
  ]);
  assert.deepEqual(closed, state);
});

test("internal Search history pushes and pops one scene at a time", () => {
  const state = {
    category: "marketplace",
    query: "desk",
    categoryFilters: { none: null },
    history: [],
  };
  const listing = openUnifiedSearchDetail(state, {
    kind: "marketplace",
    id: "market-bcs",
  });
  const seller = openUnifiedSearchDetail(listing, {
    kind: "profile",
    id: "seller-1",
  });

  assert.deepEqual(closeUnifiedSearchDetail(seller).history, listing.history);
  assert.deepEqual(closeUnifiedSearchDetail(listing), state);
  assert.equal(seller.query, "desk");
});

test("Search overlay dismissal pops one detail layer before closing", () => {
  const base = {
    category: "events",
    query: "kickoff",
    categoryFilters: { none: null },
    history: [],
  };
  const event = openUnifiedSearchDetail(base, {
    kind: "event",
    id: "event-kickoff",
  });
  const moment = openUnifiedSearchDetail(event, {
    kind: "event_moment",
    id: "moment-1",
    eventId: "event-kickoff",
  });

  const firstDismiss = requestUnifiedSearchDismiss(moment);
  assert.equal(firstDismiss.closeOverlay, false);
  assert.deepEqual(firstDismiss.state.history, event.history);

  const secondDismiss = requestUnifiedSearchDismiss(firstDismiss.state);
  assert.equal(secondDismiss.closeOverlay, false);
  assert.deepEqual(secondDismiss.state, base);

  const finalDismiss = requestUnifiedSearchDismiss(secondDismiss.state);
  assert.equal(finalDismiss.closeOverlay, true);
  assert.deepEqual(finalDismiss.state, base);
});
