"use client";

import { useState } from "react";

import {
  developmentOrganizationMemberships,
  developmentOrganizationRoles,
  developmentOrganizations,
} from "@/data/organizations";
import { normalizeSubmissionDisplay } from "@/lib/campus-data/normalization";
import {
  findOrganizationHandleConflict,
  findOrganizationNameConflict,
  isValidOrganizationHandle,
  normalizeOrganizationHandle,
  normalizeOrganizationName,
  type OrganizationIdentityRecord,
  type OrganizationSubmissionResult,
} from "@/lib/organizationIdentity";
import {
  handleOrganizationMembershipAccepted,
  inviteOrganizationMember,
  membershipStatusFor,
  openOrganizationContactConversation,
  rejectOrganizationMembership,
  removeOrganizationMembership,
  requestOrganizationMembership,
  type OrganizationMembershipState,
} from "@/lib/organizationMembership";
import type {
  NewOrganizationSubmission,
  Organization,
  OrganizationSubmission,
} from "@/types/organization";

function initialMembershipState(): OrganizationMembershipState {
  const conversations = developmentOrganizations.flatMap((organization) =>
    organization.organizationConversationId
      ? [{ id: organization.organizationConversationId, organizationId: organization.id, kind: "organization_group" as const, createdAt: organization.createdAt }]
      : [],
  );
  const conversationParticipants = developmentOrganizationMemberships.flatMap((membership) => {
    if (!["member", "officer", "leader"].includes(membership.status)) return [];
    const conversationId = developmentOrganizations.find((organization) => organization.id === membership.organizationId)?.organizationConversationId;
    return conversationId ? [{ conversationId, userId: membership.userId, addedAt: membership.updatedAt }] : [];
  });
  return { memberships: developmentOrganizationMemberships, conversations, conversationParticipants };
}

export function useOrganizations(currentUserId: string) {
  const [membershipState, setMembershipState] = useState<OrganizationMembershipState>(initialMembershipState);
  const [submissions, setSubmissions] = useState<OrganizationSubmission[]>([]);
  const [followedOrganizationIds, setFollowedOrganizationIds] = useState<string[]>([]);

  function getMembershipStatus(organizationId: string, userId = currentUserId) {
    return membershipStatusFor(membershipState.memberships, userId, organizationId);
  }

  function joinOrRequest(organization: Organization) {
    if (organization.membershipType === "invitation" || organization.membershipType === "restricted") return null;
    const now = new Date().toISOString();
    const next = requestOrganizationMembership(membershipState, organization.id, currentUserId, crypto.randomUUID(), now);
    setMembershipState(next);
    return next.memberships.find((membership) =>
      membership.organizationId === organization.id && membership.userId === currentUserId,
    ) ?? null;
  }

  function leaveOrganization(organization: Organization, userId = currentUserId) {
    setMembershipState((current) => removeOrganizationMembership(current, organization, userId));
  }



  function inviteToOrganization(
    organization: Organization,
    userId: string,
    invitedByUserId = currentUserId,
  ) {
    setMembershipState((current) =>
      inviteOrganizationMember(
        current,
        organization.id,
        userId,
        invitedByUserId,
        crypto.randomUUID(),
        new Date().toISOString(),
      ),
    );
  }


  function acceptInvitation(
    organization: Organization,
    userId = currentUserId,
  ) {
    setMembershipState((current) =>
      handleOrganizationMembershipAccepted(
        current,
        organization,
        userId,
        userId,
        new Date().toISOString(),
      ),
    );
  }


  function declineInvitation(
    organizationId: string,
    userId = currentUserId,
  ) {
    setMembershipState((current) =>
      rejectOrganizationMembership(
        current,
        organizationId,
        userId,
        userId,
        new Date().toISOString(),
      ),
    );
  }


  function acceptMembership(organization: Organization, userId: string, decidedByUserId = currentUserId) {
    setMembershipState((current) =>
      handleOrganizationMembershipAccepted(current, organization, userId, decidedByUserId, new Date().toISOString()),
    );
  }

  function rejectMembership(organizationId: string, userId: string, decidedByUserId = currentUserId) {
    setMembershipState((current) =>
      rejectOrganizationMembership(current, organizationId, userId, decidedByUserId, new Date().toISOString()),
    );
  }

  function getPendingRequests(organizationId: string) {
    return membershipState.memberships.filter((membership) =>
      membership.organizationId === organizationId && membership.status === "requested",
    );
  }

  function getMemberCount(organizationId: string) {
    return membershipState.memberships.filter((membership) =>
      membership.organizationId === organizationId && ["member", "officer", "leader"].includes(membership.status),
    ).length;
  }

  function isConversationParticipant(conversationId: string, userId = currentUserId) {
    return membershipState.conversationParticipants.some((participant) =>
      participant.conversationId === conversationId && participant.userId === userId,
    );
  }

  function messageOrganization(organization: Organization) {
    const result = openOrganizationContactConversation(
      membershipState,
      organization,
      currentUserId,
      `organization-contact-${crypto.randomUUID()}`,
      new Date().toISOString(),
    );
    setMembershipState(result.state);
    return result;
  }

  function toggleFollowOrganization(organizationId: string) {
    setFollowedOrganizationIds((current) => current.includes(organizationId)
      ? current.filter((id) => id !== organizationId)
      : [...current, organizationId]);
  }

  function submitOrganization(input: NewOrganizationSubmission): OrganizationSubmissionResult {
    const name = normalizeSubmissionDisplay(input.name);
    const normalizedName = normalizeOrganizationName(name);
    if (!name || !normalizedName) return { ok: false, reason: "invalid_name" };
    const handle = normalizeOrganizationHandle(input.handle);
    if (!isValidOrganizationHandle(handle)) return { ok: false, reason: "invalid_handle" };
    const identityRecords: OrganizationIdentityRecord[] = [
      ...developmentOrganizations.map((organization) => ({
        id: organization.id,
        universityId: organization.universityId,
        name: organization.name,
        normalizedName: organization.normalizedName,
        handle: organization.handle,
        recordStatus: organization.recordStatus,
      })),
      ...submissions.map((submission) => ({
        id: submission.id,
        universityId: submission.universityId,
        name: submission.name,
        normalizedName: submission.normalizedName,
        handle: submission.handle,
        recordStatus: "pending" as const,
      })),
    ];
    const nameConflict = findOrganizationNameConflict(input.universityId, name, identityRecords);
    if (nameConflict) return { ok: false, reason: "name_conflict", conflict: nameConflict };
    const handleConflict = findOrganizationHandleConflict(handle, identityRecords);
    if (handleConflict) return { ok: false, reason: "handle_conflict", record: handleConflict };
    const submission: OrganizationSubmission = {
      ...input,
      name,
      normalizedName,
      handle,
      description: normalizeSubmissionDisplay(input.description),
      contact: normalizeSubmissionDisplay(input.contact),
      id: crypto.randomUUID(),
      status: "pending",
      confidenceLevel: "pending",
      createdAt: new Date().toISOString(),
    };
    setSubmissions((current) => [...current, submission]);
    return { ok: true, submission };
  }

  return {
    memberships: membershipState.memberships,
    roles: developmentOrganizationRoles,
    conversations: membershipState.conversations,
    conversationParticipants: membershipState.conversationParticipants,
    followedOrganizationIds,
    submissions,
    getMembershipStatus,
    joinOrRequest,
    leaveOrganization,
    inviteToOrganization,
    acceptInvitation,
    declineInvitation,
    acceptMembership,
    rejectMembership,
    getPendingRequests,
    getMemberCount,
    isConversationParticipant,
    messageOrganization,
    toggleFollowOrganization,
    submitOrganization,
  };
}

export type OrganizationsState = ReturnType<typeof useOrganizations>;
