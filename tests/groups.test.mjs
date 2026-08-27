import assert from "node:assert/strict";
import test from "node:test";

import {
  canDiscoverOrganizationCommunity,
  canShowOrganizationCommunityInMyGroups,
  filterCampusGroupDiscovery,
  getMyCampusGroups,
  updateCampusGroupMembership,
} from "../lib/groups/campusGroups.ts";

const groups = [
  {
    id: "tamu-open",
    name: "MATH 152 Study",
    description: "Calculus class study group",
    universityId: "tamu",
    accessibleUniversityIds: ["tamu"],
    category: "Classes",
    courseCode: "MATH 152",
    memberCount: 12,
    access: "open",
    organizationId: null,
    eventId: null,
    isDevelopment: true,
  },
  {
    id: "tamu-request",
    name: "Biology Peer Help",
    description: "Request-based tutoring",
    universityId: "tamu",
    accessibleUniversityIds: ["tamu"],
    category: "Tutoring",
    courseCode: null,
    memberCount: 8,
    access: "request",
    organizationId: null,
    eventId: null,
    isDevelopment: true,
  },
  {
    id: "lsu-open",
    name: "LSU Biology",
    description: "LSU-only study group",
    universityId: "lsu",
    accessibleUniversityIds: ["lsu"],
    category: "Study",
    courseCode: null,
    memberCount: 7,
    access: "open",
    organizationId: null,
    eventId: null,
    isDevelopment: true,
  },
];

const tamuAccess = { configuredUniversityId: "tamu", userId: "user-1" };

test("an open campus group can be joined and immediately appears in My Groups", () => {
  const memberships = updateCampusGroupMembership(
    [],
    groups[0],
    "user-1",
    "join",
    "2026-08-22T12:00:00.000Z",
  );

  assert.equal(memberships[0].status, "member");
  assert.deepEqual(
    getMyCampusGroups(groups, memberships, tamuAccess).map((group) => group.id),
    ["tamu-open"],
  );
});

test("leaving local membership removes the group from My Groups", () => {
  const joined = updateCampusGroupMembership(
    [],
    groups[0],
    "user-1",
    "join",
    "2026-08-22T12:00:00.000Z",
  );
  const left = updateCampusGroupMembership(
    joined,
    groups[0],
    "user-1",
    "leave",
    "2026-08-22T12:01:00.000Z",
  );

  assert.deepEqual(getMyCampusGroups(groups, left, tamuAccess), []);
});

test("group discovery is campus scoped and searchable", () => {
  assert.deepEqual(
    filterCampusGroupDiscovery(groups, tamuAccess, { query: "math" }).map(
      (group) => group.id,
    ),
    ["tamu-open"],
  );
  assert.equal(
    filterCampusGroupDiscovery(groups, tamuAccess).some(
      (group) => group.id === "lsu-open",
    ),
    false,
  );
});

test("a provisional university never inherits another campus's groups", () => {
  assert.deepEqual(
    filterCampusGroupDiscovery(groups, {
      configuredUniversityId: null,
      userId: "user-1",
    }),
    [],
  );
});

test("restricted organization chats are not discoverable without authorization", () => {
  assert.equal(
    canDiscoverOrganizationCommunity({
      membershipType: "restricted",
      membershipStatus: "none",
      membershipAllowed: false,
    }),
    false,
  );
  assert.equal(
    canShowOrganizationCommunityInMyGroups({
      hasChatAccess: false,
      isConversationParticipant: false,
    }),
    false,
  );
});

test("accepted club membership can expose its linked community", () => {
  assert.equal(
    canShowOrganizationCommunityInMyGroups({
      hasChatAccess: true,
      isConversationParticipant: true,
    }),
    true,
  );
});
