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
export type OrganizationMembershipType = "open" | "application" | "invitation" | "restricted";
export type OrganizationMembershipStatus = "none" | "requested" | "member" | "officer";

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
  status: Exclude<OrganizationMembershipStatus, "none">;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationOfficer = {
  id: string;
  organizationId: string;
  displayName: string;
  role: OrganizationOfficerRole;
  customRole: string | null;
  isDevelopmentPlaceholder: boolean;
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
  category: OrganizationCategory;
  description: string;
  contact: string;
  status: "pending";
  confidenceLevel: "pending";
  createdAt: string;
};

export type NewOrganizationSubmission = Omit<OrganizationSubmission, "id" | "status" | "confidenceLevel" | "createdAt">;
