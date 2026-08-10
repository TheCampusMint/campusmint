import type { CampusNetworkId } from "@/data/campusNetworks";
import type { UniversityId } from "@/data/universities";
import type { DataConfidenceLevel, RecordSourceType } from "@/types/campus-data";

export const organizationCategories = [
  "Academic",
  "Professional",
  "Sports",
  "Recreation",
  "Cultural",
  "Social",
  "Service",
  "Greek Life",
  "Religious",
  "Student Government",
  "Arts / Music",
  "Gaming",
  "Entrepreneurship",
  "Other",
] as const;

export type OrganizationCategory = (typeof organizationCategories)[number];
export type OrganizationOfficialStatus = "university_verified" | "community_verified" | "pending";
export type OrganizationRecordStatus = "active" | "pending" | "archived" | "inactive";
export type OrganizationMembershipType = "open" | "application" | "invitation" | "restricted";
export const organizationMembershipStatuses = [
  "none",
  "requested",
  "member",
  "officer",
  "leader",
  "rejected",
  "blocked",
] as const;
export type OrganizationMembershipStatus = (typeof organizationMembershipStatuses)[number];

export const organizationRoleKinds = ["member", "officer", "leader", "social_media_manager"] as const;
export type OrganizationRoleKind = (typeof organizationRoleKinds)[number];

export const organizationOfficerRoles = [
  "President",
  "Vice President",
  "Treasurer",
  "Secretary",
  "Social Chair",
  "Recruitment",
  "Other",
] as const;

export type OrganizationOfficerRole = (typeof organizationOfficerRoles)[number];

export type OrganizationMedia = {
  url: string | null;
  alt: string;
  isDevelopmentPlaceholder: boolean;
};

export type Organization = {
  id: string;
  universityId: UniversityId;
  campusNetworkId: CampusNetworkId | null;
  name: string;
  normalizedName: string;
  handle: string;
  recordStatus: OrganizationRecordStatus;
  shortDescription: string;
  fullDescription: string;
  category: OrganizationCategory;
  logo: OrganizationMedia | null;
  photo: OrganizationMedia | null;
  officialStatus: OrganizationOfficialStatus;
  membershipType: OrganizationMembershipType;
  website: string | null;
  instagram?: string | null;
  contactEmail: string;
  meetingLocation: string;
  meetingSchedule: string;
  memberCount: number;
  crossCampus: boolean;
  organizationConversationId: string | null;
  leaderUserId: string | null;
  membershipContactUserIds: string[];
  keywords: string[];
  sourceType: RecordSourceType;
  confidenceLevel: DataConfidenceLevel;
  isDevelopment: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationMembership = {
  id: string;
  organizationId: string;
  userId: string;
  status: Exclude<OrganizationMembershipStatus, "none">;
  requestedAt: string | null;
  decidedAt: string | null;
  decidedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationRoleAssignment = {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRoleKind;
  canPublish: boolean;
  createdAt: string;
};

export type OrganizationOfficer = {
  id: string;
  organizationId: string;
  userId: string | null;
  displayName: string;
  role: OrganizationOfficerRole;
  customRole: string | null;
  isDevelopmentPlaceholder: boolean;
};

export type OrganizationConversation = {
  id: string;
  organizationId: string;
  kind: "organization_group" | "organization_contact";
  createdAt: string;
};

export type ConversationParticipant = {
  conversationId: string;
  userId: string;
  addedAt: string;
};

export type OrganizationAnnouncement = {
  id: string;
  organizationId: string;
  title: string;
  body: string;
  createdAt: string;
  authorRole: OrganizationOfficerRole;
  isDevelopment: boolean;
};

export const organizationRecruitmentTypes = [
  "Open Membership",
  "Applications Open",
  "Tryouts",
  "Information Session",
  "Recruitment Event",
] as const;

export type OrganizationRecruitmentType = (typeof organizationRecruitmentTypes)[number];

export type OrganizationRecruitment = {
  id: string;
  organizationId: string;
  type: OrganizationRecruitmentType;
  title: string;
  description: string;
  isDevelopment: boolean;
};

export type OrganizationSubmission = {
  id: string;
  universityId: UniversityId;
  name: string;
  normalizedName: string;
  handle: string;
  category: OrganizationCategory;
  description: string;
  contact: string;
  status: "pending";
  confidenceLevel: "pending";
  createdAt: string;
};

export type NewOrganizationSubmission = Omit<OrganizationSubmission, "id" | "normalizedName" | "status" | "confidenceLevel" | "createdAt">;
