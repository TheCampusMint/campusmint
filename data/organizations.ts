import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import type { UniversityId } from "@/data/universities";
import { normalizeOrganizationName, suggestOrganizationHandle } from "@/lib/organizationIdentity";
import type {
  Organization,
  OrganizationAnnouncement,
  OrganizationMembership,
  OrganizationOfficer,
  OrganizationRecruitment,
  OrganizationRoleAssignment,
} from "@/types/organization";

type DevelopmentOrganizationInput = Omit<
  Organization,
  "campusNetworkId" | "normalizedName" | "handle" | "recordStatus" | "logo" | "photo" | "memberCount" | "organizationConversationId" |
  "leaderUserId" | "membershipContactUserIds" | "sourceType" | "confidenceLevel" |
  "isDevelopment" | "createdAt" | "updatedAt"
> & Partial<Pick<Organization, "leaderUserId" | "membershipContactUserIds">>;

function developmentOrganization(
  input: DevelopmentOrganizationInput,
): Organization {
  const campusNetwork = getCampusNetworkForUniversity(input.universityId);
  return {
    ...input,
    campusNetworkId: campusNetwork?.id ?? null,
    normalizedName: normalizeOrganizationName(input.name),
    handle: suggestOrganizationHandle(input.universityId, input.name),
    recordStatus: "active",
    logo: { url: null, alt: `Development logo placeholder for ${input.name}`, isDevelopmentPlaceholder: true },
    photo: { url: null, alt: `Development photo placeholder for ${input.name}`, isDevelopmentPlaceholder: true },
    memberCount: 0,
    organizationConversationId: `organization-conversation-${input.id}`,
    leaderUserId: input.leaderUserId ?? null,
    membershipContactUserIds: input.membershipContactUserIds ?? [],
    sourceType: "development_seed",
    confidenceLevel: "pending",
    isDevelopment: true,
    createdAt: "2026-08-08T12:00:00.000Z",
    updatedAt: "2026-08-08T12:00:00.000Z",
  };
}

export const developmentOrganizations: Organization[] = [
  developmentOrganization({
    id: "dev-tamu-robotics", universityId: "tamu", name: "Robotics Collective — Development Example",
    shortDescription: "A development-only organization record for collaborative robotics projects and open build sessions.",
    fullDescription: "This synthetic organization demonstrates how an academic club can share meetings, events, announcements, officers, and stories in Campus Mint. It is not an official university record.",
    category: "Academic", officialStatus: "community_verified", membershipType: "open",
    website: null, instagram: null, contactEmail: "robotics-demo@campusmint.example",
    meetingLocation: "Engineering building area (development placeholder)", meetingSchedule: "Weekly schedule to be confirmed",
    crossCampus: false, keywords: ["robotics", "engineering", "coding", "build"],
    leaderUserId: "demo-tamu-officer", membershipContactUserIds: ["demo-tamu-officer"],
  }),
  developmentOrganization({
    id: "dev-tamu-product-builders", universityId: "tamu", name: "Product Builders — Development Example",
    shortDescription: "A development-only professional group for students practicing product design and entrepreneurship.",
    fullDescription: "This sample organization is used to test application-based membership, recruitment, announcements, and organization discovery. It does not represent a real campus organization.",
    category: "Entrepreneurship", officialStatus: "pending", membershipType: "application",
    website: null, instagram: null, contactEmail: "builders-demo@campusmint.example",
    meetingLocation: "Campus innovation space (development placeholder)", meetingSchedule: "Two meetings per month; dates not configured",
    crossCampus: false, keywords: ["product", "startup", "design", "entrepreneurship"],
  }),
  developmentOrganization({
    id: "dev-tamu-outdoor-recreation", universityId: "tamu", name: "Outdoor Recreation Circle — Development Example",
    shortDescription: "A cross-campus development example for students interested in low-key outdoor activities.",
    fullDescription: "This synthetic record demonstrates an organization that may intentionally welcome students from another nearby university without merging the universities' club directories.",
    category: "Recreation", officialStatus: "pending", membershipType: "open",
    website: null, instagram: null, contactEmail: "outdoors-demo@campusmint.example",
    meetingLocation: "Public campus meeting point (development placeholder)", meetingSchedule: "Event-based schedule",
    crossCampus: true, keywords: ["outdoors", "recreation", "walking", "cross-campus"],
  }),
  developmentOrganization({
    id: "dev-blinn-coding-circle", universityId: "blinn", name: "Coding Circle — Development Example",
    shortDescription: "A development-only peer group for coding practice, project feedback, and beginner support.",
    fullDescription: "This synthetic Blinn organization demonstrates open membership and connections to shared Event and Story records. It is not an official college organization.",
    category: "Academic", officialStatus: "pending", membershipType: "open",
    website: null, instagram: null, contactEmail: "coding-demo@campusmint.example",
    meetingLocation: "Learning center area (development placeholder)", meetingSchedule: "Weekly schedule to be confirmed",
    crossCampus: false, keywords: ["coding", "software", "computer science", "beginner"],
    leaderUserId: "current-demo-student", membershipContactUserIds: ["current-demo-student", "demo-blinn-officer"],
  }),
  developmentOrganization({
    id: "dev-blinn-service-crew", universityId: "blinn", name: "Community Service Crew — Development Example",
    shortDescription: "A development-only service organization example with application-based membership.",
    fullDescription: "This synthetic organization demonstrates service recruitment and an intentional cross-campus invitation. It is not a live or verified college organization.",
    category: "Service", officialStatus: "community_verified", membershipType: "application",
    website: null, instagram: null, contactEmail: "service-demo@campusmint.example",
    meetingLocation: "Student center area (development placeholder)", meetingSchedule: "Monthly planning meeting; date not configured",
    crossCampus: true, keywords: ["service", "volunteer", "community", "cross-campus"],
    leaderUserId: "demo-blinn-officer", membershipContactUserIds: ["demo-blinn-officer"],
  }),
  developmentOrganization({
    id: "dev-blinn-creative-arts", universityId: "blinn", name: "Creative Arts Society — Development Example",
    shortDescription: "A development-only organization example for student art, music, and creative workshops.",
    fullDescription: "This synthetic record demonstrates a student arts organization with open membership and media placeholders. It is not an official college organization.",
    category: "Arts / Music", officialStatus: "pending", membershipType: "open",
    website: null, instagram: null, contactEmail: "arts-demo@campusmint.example",
    meetingLocation: "Arts classroom area (development placeholder)", meetingSchedule: "Workshop dates not configured",
    crossCampus: false, keywords: ["art", "music", "creative", "workshop"],
  }),
  developmentOrganization({
    id: "dev-texas-founders", universityId: "texas", name: "Founders Circle — Development Example",
    shortDescription: "A development-only entrepreneurship organization record.",
    fullDescription: "This synthetic organization exists only to test university-specific directory isolation.",
    category: "Entrepreneurship", officialStatus: "pending", membershipType: "open",
    website: null, instagram: null, contactEmail: "founders-demo@campusmint.example",
    meetingLocation: "Campus meeting area (development placeholder)", meetingSchedule: "Schedule not configured",
    crossCampus: false, keywords: ["startup", "founders", "entrepreneurship"],
  }),
  developmentOrganization({
    id: "dev-lsu-service", universityId: "lsu", name: "Service Network — Development Example",
    shortDescription: "A development-only service organization record.",
    fullDescription: "This synthetic organization exists only to test university-specific directory isolation.",
    category: "Service", officialStatus: "pending", membershipType: "open",
    website: null, instagram: null, contactEmail: "service-lsu-demo@campusmint.example",
    meetingLocation: "Campus meeting area (development placeholder)", meetingSchedule: "Schedule not configured",
    crossCampus: false, keywords: ["service", "volunteer"],
  }),
  developmentOrganization({
    id: "dev-alabama-gaming", universityId: "alabama", name: "Gaming Guild — Development Example",
    shortDescription: "A development-only gaming organization record.",
    fullDescription: "This synthetic organization exists only to test university-specific directory isolation.",
    category: "Gaming", officialStatus: "pending", membershipType: "open",
    website: null, instagram: null, contactEmail: "gaming-demo@campusmint.example",
    meetingLocation: "Campus meeting area (development placeholder)", meetingSchedule: "Schedule not configured",
    crossCampus: false, keywords: ["gaming", "tabletop", "esports"],
  }),
];

export const developmentOrganizationOfficers: OrganizationOfficer[] = [
  { id: "dev-officer-tamu-robotics-president", organizationId: "dev-tamu-robotics", userId: "demo-tamu-officer", displayName: "Demo Officer", role: "President", customRole: null, isDevelopmentPlaceholder: true },
  { id: "dev-officer-tamu-robotics-treasurer", organizationId: "dev-tamu-robotics", userId: null, displayName: "Demo Officer", role: "Treasurer", customRole: null, isDevelopmentPlaceholder: true },
  { id: "dev-officer-blinn-coding-president", organizationId: "dev-blinn-coding-circle", userId: "current-demo-student", displayName: "Campus Student (Demo)", role: "President", customRole: null, isDevelopmentPlaceholder: true },
  { id: "dev-officer-blinn-service-recruitment", organizationId: "dev-blinn-service-crew", userId: "demo-blinn-officer", displayName: "Demo Officer", role: "Recruitment", customRole: null, isDevelopmentPlaceholder: true },
];

const developmentTimestamp = "2026-08-10T12:00:00.000Z";

export const developmentOrganizationMemberships: OrganizationMembership[] = [
  { id: "dev-membership-current-coding", organizationId: "dev-blinn-coding-circle", userId: "current-demo-student", status: "leader", requestedAt: developmentTimestamp, decidedAt: developmentTimestamp, decidedByUserId: "current-demo-student", createdAt: developmentTimestamp, updatedAt: developmentTimestamp },
  { id: "dev-membership-tamu-officer", organizationId: "dev-tamu-robotics", userId: "demo-tamu-officer", status: "leader", requestedAt: developmentTimestamp, decidedAt: developmentTimestamp, decidedByUserId: "demo-tamu-officer", createdAt: developmentTimestamp, updatedAt: developmentTimestamp },
  { id: "dev-membership-blinn-officer", organizationId: "dev-blinn-service-crew", userId: "demo-blinn-officer", status: "officer", requestedAt: developmentTimestamp, decidedAt: developmentTimestamp, decidedByUserId: "demo-blinn-officer", createdAt: developmentTimestamp, updatedAt: developmentTimestamp },
];

export const developmentOrganizationRoles: OrganizationRoleAssignment[] = [
  { id: "dev-role-current-coding-leader", organizationId: "dev-blinn-coding-circle", userId: "current-demo-student", role: "leader", canPublish: true, createdAt: developmentTimestamp },
  { id: "dev-role-tamu-robotics-leader", organizationId: "dev-tamu-robotics", userId: "demo-tamu-officer", role: "leader", canPublish: true, createdAt: developmentTimestamp },
  { id: "dev-role-blinn-service-officer", organizationId: "dev-blinn-service-crew", userId: "demo-blinn-officer", role: "officer", canPublish: true, createdAt: developmentTimestamp },
];

export const developmentOrganizationAnnouncements: OrganizationAnnouncement[] = [
  { id: "dev-announcement-tamu-robotics-1", organizationId: "dev-tamu-robotics", title: "Open build session", body: "Development announcement: the next sample build session is open to students who want to learn about the group.", createdAt: "2026-08-08T15:00:00.000Z", authorRole: "President", isDevelopment: true },
  { id: "dev-announcement-tamu-product-1", organizationId: "dev-tamu-product-builders", title: "Applications example", body: "Development announcement: this record demonstrates an application-based membership period.", createdAt: "2026-08-08T14:00:00.000Z", authorRole: "Recruitment", isDevelopment: true },
  { id: "dev-announcement-blinn-coding-1", organizationId: "dev-blinn-coding-circle", title: "Beginner project night", body: "Development announcement: bring a small practice project or join a starter exercise.", createdAt: "2026-08-08T13:00:00.000Z", authorRole: "President", isDevelopment: true },
  { id: "dev-announcement-blinn-service-1", organizationId: "dev-blinn-service-crew", title: "Volunteer planning example", body: "Development announcement: this placeholder demonstrates planning updates without engagement metrics.", createdAt: "2026-08-08T12:30:00.000Z", authorRole: "Recruitment", isDevelopment: true },
];

export const developmentOrganizationRecruitment: OrganizationRecruitment[] = [
  { id: "dev-recruit-tamu-robotics", organizationId: "dev-tamu-robotics", type: "Open Membership", title: "Open membership example", description: "Join locally in this development session to test open membership.", isDevelopment: true },
  { id: "dev-recruit-tamu-product", organizationId: "dev-tamu-product-builders", type: "Applications Open", title: "Application period example", description: "Request membership to test the pending application state.", isDevelopment: true },
  { id: "dev-recruit-blinn-service", organizationId: "dev-blinn-service-crew", type: "Information Session", title: "Cross-campus information session example", description: "A development-only example of an intentional nearby-school invitation.", isDevelopment: true },
];

export function getOrganizationById(organizationId: string | null | undefined) {
  if (!organizationId) return null;
  return developmentOrganizations.find((organization) => organization.id === organizationId) ?? null;
}

export function getOrganizationByHandle(handle: string | null | undefined) {
  if (!handle) return null;
  return developmentOrganizations.find((organization) => organization.handle === handle) ?? null;
}

export function getClubHref(organization: Pick<Organization, "handle">) {
  return `/clubs/${organization.handle}`;
}

export function getOrganizationsForUniversity(universityId: UniversityId) {
  return developmentOrganizations.filter((organization) => organization.universityId === universityId);
}
