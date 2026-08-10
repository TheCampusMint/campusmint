import assert from "node:assert/strict";
import test from "node:test";

import {
  handleOrganizationMembershipAccepted,
  membershipStatusFor,
  openOrganizationContactConversation,
  rejectOrganizationMembership,
  removeOrganizationMembership,
  requestOrganizationMembership,
} from "../lib/organizationMembership.ts";

const organization = {
  id: "club-1",
  organizationConversationId: "club-group-1",
  leaderUserId: "leader-1",
  membershipContactUserIds: ["contact-1"],
};

function emptyState() {
  return {
    memberships: [],
    conversations: [{ id: "club-group-1", organizationId: "club-1", kind: "organization_group", createdAt: "2026-08-10T12:00:00.000Z" }],
    conversationParticipants: [],
  };
}

test("join creates a request and does not grant group-chat access", () => {
  const next = requestOrganizationMembership(emptyState(), organization.id, "student-1", "membership-1", "2026-08-10T12:01:00.000Z");
  assert.equal(membershipStatusFor(next.memberships, "student-1", organization.id), "requested");
  assert.equal(next.conversationParticipants.length, 0);
});

test("acceptance changes membership and group-chat participation in one state transition", () => {
  const requested = requestOrganizationMembership(emptyState(), organization.id, "student-1", "membership-1", "2026-08-10T12:01:00.000Z");
  const accepted = handleOrganizationMembershipAccepted(requested, organization, "student-1", "leader-1", "2026-08-10T12:02:00.000Z");
  assert.equal(membershipStatusFor(accepted.memberships, "student-1", organization.id), "member");
  assert.deepEqual(accepted.conversationParticipants.map(({ conversationId, userId }) => ({ conversationId, userId })), [
    { conversationId: "club-group-1", userId: "student-1" },
  ]);
});

test("rejection retains an auditable rejected state without chat access", () => {
  const requested = requestOrganizationMembership(emptyState(), organization.id, "student-1", "membership-1", "2026-08-10T12:01:00.000Z");
  const rejected = rejectOrganizationMembership(requested, organization.id, "student-1", "leader-1", "2026-08-10T12:02:00.000Z");
  assert.equal(membershipStatusFor(rejected.memberships, "student-1", organization.id), "rejected");
  assert.equal(rejected.conversationParticipants.length, 0);
});

test("leaving removes both membership and official group-chat participation", () => {
  const requested = requestOrganizationMembership(emptyState(), organization.id, "student-1", "membership-1", "2026-08-10T12:01:00.000Z");
  const accepted = handleOrganizationMembershipAccepted(requested, organization, "student-1", "leader-1", "2026-08-10T12:02:00.000Z");
  const left = removeOrganizationMembership(accepted, organization, "student-1");
  assert.equal(membershipStatusFor(left.memberships, "student-1", organization.id), "none");
  assert.equal(left.conversationParticipants.length, 0);
});

test("Message Club creates a limited direct conversation, never the member group", () => {
  const result = openOrganizationContactConversation(emptyState(), organization, "student-1", "contact-conversation-1", "2026-08-10T12:03:00.000Z");
  assert.equal(result.conversation?.kind, "organization_contact");
  assert.equal(result.contactUserId, "contact-1");
  assert.deepEqual(result.state.conversationParticipants.map(({ conversationId, userId }) => ({ conversationId, userId })), [
    { conversationId: "contact-conversation-1", userId: "student-1" },
    { conversationId: "contact-conversation-1", userId: "contact-1" },
  ]);
});
