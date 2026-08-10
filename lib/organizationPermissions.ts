import { isUniversityInCampusNetwork } from "@/data/campusNetworks";
import type { UniversityId } from "@/data/universities";
import type { OrganizationContentAudience } from "@/types/content";
import type { Organization } from "@/types/organization";
import type { OrganizationMembership, OrganizationRoleAssignment } from "@/types/organization";
import type { TemporaryUser } from "@/types/user";

export type OrganizationActor = {
  id: string;
  universityId: UniversityId;
};

export function getOrganizationMembership(
  userId: string,
  organizationId: string,
  memberships: OrganizationMembership[],
) {
  return memberships.find((membership) =>
    membership.userId === userId && membership.organizationId === organizationId,
  ) ?? null;
}

export function canPostAsOrganization(
  user: OrganizationActor,
  organization: Organization,
  memberships: OrganizationMembership[],
  roles: OrganizationRoleAssignment[],
) {
  const membership = getOrganizationMembership(user.id, organization.id, memberships);
  if (!membership || (membership.status !== "officer" && membership.status !== "leader")) return false;
  return roles.some((assignment) =>
    assignment.organizationId === organization.id
    && assignment.userId === user.id
    && assignment.canPublish
    && ["officer", "leader", "social_media_manager"].includes(assignment.role),
  );
}

export function canModerateOrganizationMemberships(
  user: OrganizationActor,
  organization: Organization,
  memberships: OrganizationMembership[],
  roles: OrganizationRoleAssignment[],
) {
  const membership = getOrganizationMembership(user.id, organization.id, memberships);
  if (!membership || (membership.status !== "officer" && membership.status !== "leader")) return false;
  return roles.some((assignment) =>
    assignment.organizationId === organization.id
    && assignment.userId === user.id
    && (assignment.role === "officer" || assignment.role === "leader"),
  );
}

export function canAccessOrganizationChat(
  user: OrganizationActor,
  organization: Organization,
  memberships: OrganizationMembership[],
) {
  const membership = getOrganizationMembership(user.id, organization.id, memberships);
  return Boolean(membership && ["member", "officer", "leader"].includes(membership.status));
}

export function canViewOrganizationContent(
  user: OrganizationActor,
  organizationId: string,
  audience: OrganizationContentAudience | undefined,
  memberships: OrganizationMembership[],
) {
  if (!audience || audience === "public") return true;
  const membership = getOrganizationMembership(user.id, organizationId, memberships);
  return Boolean(membership && ["member", "officer", "leader"].includes(membership.status));
}

export function canViewOrganization(user: TemporaryUser, organization: Organization) {
  if (user.role === "student" || user.role === "university-admin") return true;
  return organization.membershipType !== "restricted";
}

export function canJoinOrganization(user: Pick<TemporaryUser, "role" | "universityId">, organization: Organization) {
  if (user.role !== "student") return false;
  if (organization.universityId === user.universityId) return true;
  return Boolean(
    organization.crossCampus
    && organization.campusNetworkId
    && isUniversityInCampusNetwork(user.universityId, organization.campusNetworkId),
  );
}

export function canSubmitOrganization(user: TemporaryUser) {
  return user.role === "student";
}
