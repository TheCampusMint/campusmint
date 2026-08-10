import { isUniversityInCampusNetwork } from "@/data/campusNetworks";
import type { Organization } from "@/types/organization";
import type { TemporaryUser } from "@/types/user";

export function canViewOrganization(user: TemporaryUser, organization: Organization) {
  if (user.role === "student" || user.role === "university-admin") return true;
  return organization.membershipType !== "restricted";
}

export function canJoinOrganization(user: TemporaryUser, organization: Organization) {
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
