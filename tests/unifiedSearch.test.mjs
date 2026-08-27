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
    id: "person-global",
    title: "Global Person",
    subtitle: "Another university",
    category: "people",
    typeLabel: "Person",
    searchText: "global person biology",
    scope: { kind: "global_person", userId: "person-global" },
    profileId: "person-global",
    tutoring: false,
  },
  {
    id: "person-blocked",
    title: "Blocked Person",
    subtitle: "Another university",
    category: "people",
    typeLabel: "Person",
    searchText: "blocked person physics tutor",
    scope: { kind: "global_person", userId: "person-blocked" },
    profileId: "person-blocked",
    tutoring: true,
  },
  {
    id: "tutor-visible",
    title: "Visible Tutor",
    subtitle: "Math and Engineering",
    category: "people",
    typeLabel: "Person",
    searchText: "visible tutor calculus engineering",
    scope: { kind: "global_person", userId: "tutor-visible" },
    profileId: "tutor-visible",
    tutoring: true,
  },
  {
    id: "club-tamu",
    title: "TAMU Club",
    subtitle: "College Station",
    category: "clubs",
    typeLabel: "Club",
    searchText: "tamu robotics club",
    scope: { kind: "campus", campusId: "tamu" },
    detail: { kind: "club", id: "club-tamu" },
  },
  {
    id: "club-lsu",
    title: "LSU Club",
    subtitle: "Baton Rouge",
    category: "clubs",
    typeLabel: "Club",
    searchText: "lsu service club",
    scope: { kind: "campus", campusId: "lsu" },
    detail: { kind: "club", id: "club-lsu" },
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

test("People discovery is global while blocked users are excluded", () => {
  const people = filterUnifiedSearchCandidates(
    candidates,
    { category: "people", query: "" },
    tamuAccess,
  );

  assert.deepEqual(
    people.map((candidate) => candidate.id),
    ["person-global", "tutor-visible"],
  );
});

test("campus and network results stay inside their allowed category scopes", () => {
  const ids = ["clubs", "marketplace"].flatMap((category) =>
    filterUnifiedSearchCandidates(
      candidates,
      { category, query: "" },
      tamuAccess,
    ).map((candidate) => candidate.id),
  );

  assert.equal(ids.includes("club-tamu"), true);
  assert.equal(ids.includes("club-lsu"), false);
  assert.equal(ids.includes("market-bcs"), true);
});

test("provisional universities receive only global People results", () => {
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

  assert.deepEqual(
    [...visibleIds],
    ["person-global", "tutor-visible"],
  );
});

test("Search exposes six categories and retired state migrates to People", () => {
  assert.deepEqual(unifiedSearchCategories, [
    "people",
    "food",
    "tutoring",
    "clubs",
    "events",
    "marketplace",
  ]);
  assert.equal(unifiedSearchCategories.includes("all"), false);
  assert.equal(unifiedSearchCategories.includes("housing"), false);
  assert.equal(migrateUnifiedSearchCategory("all"), "people");
  assert.equal(migrateUnifiedSearchCategory("housing"), "people");
  assert.equal(migrateUnifiedSearchCategory("events"), "events");
  assert.equal(migrateUnifiedSearchCategory("unknown"), "people");
});

test("Tutoring includes only visible profiles marked as eligible tutors", () => {
  const tutors = filterUnifiedSearchCandidates(
    candidates,
    { category: "tutoring", query: "engineering" },
    tamuAccess,
  );

  assert.deepEqual(tutors.map((candidate) => candidate.id), ["tutor-visible"]);
});

test("selected category and query both constrain Search results", () => {
  const clubs = filterUnifiedSearchCandidates(
    candidates,
    { category: "clubs", query: "robotics" },
    tamuAccess,
  );
  const wrongCategory = filterUnifiedSearchCandidates(
    candidates,
    { category: "marketplace", query: "robotics" },
    tamuAccess,
  );

  assert.deepEqual(clubs.map((candidate) => candidate.id), ["club-tamu"]);
  assert.equal(wrongCategory.length, 0);
});

test("category switching stays inside Search state and preserves its viewport anchor", () => {
  const state = {
    category: "people",
    query: "maya",
    categoryFilters: { tutoringSubject: null },
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
    categoryFilters: { tutoringSubject: null },
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
    categoryFilters: { tutoringSubject: null },
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
    categoryFilters: { tutoringSubject: null },
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
