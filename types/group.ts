import type { UniversityId } from "@/data/universities";

export const campusGroupCategories = [
  "Classes",
  "Clubs",
  "Study",
  "Tutoring",
  "Events",
  "Social",
] as const;

export type CampusGroupCategory =
  (typeof campusGroupCategories)[number];

export type CampusGroupAccess = "open" | "request" | "restricted";

export type CampusGroup = {
  id: string;
  name: string;
  description: string;
  universityId: UniversityId;
  accessibleUniversityIds: UniversityId[];
  category: CampusGroupCategory;
  courseCode: string | null;
  memberCount: number | null;
  access: CampusGroupAccess;
  organizationId: string | null;
  eventId: string | null;
  isDevelopment: true;
};

export type CampusGroupMembership = {
  groupId: string;
  userId: string;
  status: "member" | "requested";
  updatedAt: string;
};

export type CampusGroupStore = {
  version: 1;
  memberships: CampusGroupMembership[];
};
