import type {
  ConversationParticipant,
  Organization,
  OrganizationConversation,
  OrganizationMembership,
  OrganizationMembershipStatus,
} from "../types/organization.ts";

export type OrganizationMembershipState = {
  memberships: OrganizationMembership[];
  conversations: OrganizationConversation[];
  conversationParticipants: ConversationParticipant[];
};

export function membershipStatusFor(
  memberships: OrganizationMembership[],
  userId: string,
  organizationId: string,
): OrganizationMembershipStatus {
  return memberships.find((membership) =>
    membership.userId === userId && membership.organizationId === organizationId,
  )?.status ?? "none";
}

export function requestOrganizationMembership(
  state: OrganizationMembershipState,
  organizationId: string,
  userId: string,
  membershipId: string,
  now: string,
): OrganizationMembershipState {
  const existing = state.memberships.find((membership) =>
    membership.organizationId === organizationId && membership.userId === userId,
  );
  if (
    existing?.status === "blocked" ||
    existing?.status === "requested" ||
    existing?.status === "invited" ||
    existing?.status === "member" ||
    existing?.status === "officer" ||
    existing?.status === "leader"
  ) return state;

  const requested: OrganizationMembership = existing
    ? { ...existing, status: "requested", requestedAt: now, decidedAt: null, decidedByUserId: null, updatedAt: now }
    : {
        id: membershipId,
        organizationId,
        userId,
        status: "requested",
        requestedAt: now,
        decidedAt: null,
        decidedByUserId: null,
        createdAt: now,
        updatedAt: now,
      };
  return {
    ...state,
    memberships: existing
      ? state.memberships.map((membership) => membership.id === existing.id ? requested : membership)
      : [...state.memberships, requested],
  };
}

export function inviteOrganizationMember(
  state: OrganizationMembershipState,
  organizationId: string,
  userId: string,
  invitedByUserId: string,
  membershipId: string,
  now: string,
): OrganizationMembershipState {
  const existing = state.memberships.find((candidate) =>
    candidate.organizationId === organizationId &&
    candidate.userId === userId,
  );

  if (
    existing?.status === "blocked" ||
    existing?.status === "requested" ||
    existing?.status === "invited" ||
    existing?.status === "member" ||
    existing?.status === "officer" ||
    existing?.status === "leader"
  ) {
    return state;
  }

  const invited: OrganizationMembership = existing
    ? {
        ...existing,
        status: "invited",
        requestedAt: null,
        invitedAt: now,
        invitedByUserId,
        decidedAt: null,
        decidedByUserId: null,
        updatedAt: now,
      }
    : {
        id: membershipId,
        organizationId,
        userId,
        status: "invited",
        requestedAt: null,
        invitedAt: now,
        invitedByUserId,
        decidedAt: null,
        decidedByUserId: null,
        createdAt: now,
        updatedAt: now,
      };

  return {
    ...state,
    memberships: existing
      ? state.memberships.map((candidate) =>
          candidate.id === existing.id
            ? invited
            : candidate,
        )
      : [...state.memberships, invited],
  };
}


export function handleOrganizationMembershipAccepted(
  state: OrganizationMembershipState,
  organization: Organization,
  userId: string,
  decidedByUserId: string,
  now: string,
): OrganizationMembershipState {
  const membership = state.memberships.find((candidate) =>
    candidate.organizationId === organization.id &&
    candidate.userId === userId &&
    (candidate.status === "requested" || candidate.status === "invited"),
  );
  if (!membership || !organization.organizationConversationId) return state;

  const participantExists = state.conversationParticipants.some((participant) =>
    participant.conversationId === organization.organizationConversationId && participant.userId === userId,
  );
  return {
    ...state,
    memberships: state.memberships.map((candidate) => candidate.id === membership.id
      ? {
          ...candidate,
          status: "member",
          invitedAt: null,
          invitedByUserId: null,
          decidedAt: now,
          decidedByUserId,
          updatedAt: now,
        }
      : candidate),
    conversationParticipants: participantExists
      ? state.conversationParticipants
      : [...state.conversationParticipants, { conversationId: organization.organizationConversationId, userId, addedAt: now }],
  };
}

export function rejectOrganizationMembership(
  state: OrganizationMembershipState,
  organizationId: string,
  userId: string,
  decidedByUserId: string,
  now: string,
): OrganizationMembershipState {
  return {
    ...state,
    memberships: state.memberships.map((membership) =>
      membership.organizationId === organizationId &&
      membership.userId === userId &&
      (membership.status === "requested" || membership.status === "invited")
        ? {
            ...membership,
            status: "rejected",
            invitedAt: null,
            invitedByUserId: null,
            decidedAt: now,
            decidedByUserId,
            updatedAt: now,
          }
        : membership),
  };
}

export function removeOrganizationMembership(
  state: OrganizationMembershipState,
  organization: Organization,
  userId: string,
): OrganizationMembershipState {
  return {
    ...state,
    memberships: state.memberships.filter((membership) =>
      !(membership.organizationId === organization.id && membership.userId === userId)),
    conversationParticipants: organization.organizationConversationId
      ? state.conversationParticipants.filter((participant) =>
          !(participant.conversationId === organization.organizationConversationId && participant.userId === userId))
      : state.conversationParticipants,
  };
}

export function openOrganizationContactConversation(
  state: OrganizationMembershipState,
  organization: Organization,
  userId: string,
  conversationId: string,
  now: string,
): { state: OrganizationMembershipState; conversation: OrganizationConversation | null; contactUserId: string | null } {
  const contactUserId = organization.membershipContactUserIds[0] ?? organization.leaderUserId;
  if (!contactUserId || contactUserId === userId) return { state, conversation: null, contactUserId: null };

  const existing = state.conversations.find((conversation) => {
    if (conversation.kind !== "organization_contact" || conversation.organizationId !== organization.id) return false;
    const participants = state.conversationParticipants.filter((participant) => participant.conversationId === conversation.id);
    return participants.some((participant) => participant.userId === userId)
      && participants.some((participant) => participant.userId === contactUserId);
  });
  if (existing) return { state, conversation: existing, contactUserId };

  const conversation: OrganizationConversation = {
    id: conversationId,
    organizationId: organization.id,
    kind: "organization_contact",
    createdAt: now,
  };
  return {
    contactUserId,
    conversation,
    state: {
      ...state,
      conversations: [...state.conversations, conversation],
      conversationParticipants: [
        ...state.conversationParticipants,
        { conversationId, userId, addedAt: now },
        { conversationId, userId: contactUserId, addedAt: now },
      ],
    },
  };
}
