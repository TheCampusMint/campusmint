import type { UniversityId } from "@/data/universities";
import type { UserRole } from "@/data/userRoles";
import type { FriendshipStatus } from "@/types/social";

export const profileVisibilityOptions = [
  { id: "everyone", label: "Everyone" },
  { id: "students_only", label: "Students only" },
  { id: "friends_only", label: "Friends only" },
  { id: "private", label: "Private" },
] as const;

export type ProfileVisibility = (typeof profileVisibilityOptions)[number]["id"];

export const profilePrivacyFields = [
  "bio",
  "major",
  "graduationYear",
  "classes",
  "clubs",
  "interests",
  "hometown",
  "instagram",
  "linkedin",
  "portfolioUrl",
  "personalWebsite",
] as const;

export type ProfilePrivacyField = (typeof profilePrivacyFields)[number];
export type ProfilePrivacySettings = Record<ProfilePrivacyField, ProfileVisibility>;

export type ProfilePhoto = {
  kind: "initials" | "development_placeholder";
  placeholderId: string | null;
  storagePath: string | null;
};

/** Account identity is intentionally separate from user-editable public profile data. */
export type CampusMintAccount = {
  id: string;
  universityId: UniversityId;
  role: UserRole;
  verifiedStudent: boolean;
  verifiedAlumni: boolean;
  isDevelopment: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CampusMintProfile = {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  photo: ProfilePhoto;
  bio: string | null;
  major: string | null;
  graduationYear: number | null;
  classIds: string[];
  clubIds: string[];
  interests: string[];
  hometown: string | null;
  instagram: string | null;
  linkedin: string | null;
  portfolioUrl: string | null;
  personalWebsite: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampusMintUser = {
  account: CampusMintAccount;
  profile: CampusMintProfile;
  privacy: ProfilePrivacySettings;
};

export type ProfileViewerContext = {
  viewer: CampusMintUser;
  owner: CampusMintUser;
  friendshipStatus: FriendshipStatus;
};

export const reputationSourceTypes = [
  "marketplace",
  "tutoring",
  "reviews",
  "mentoring",
  "community",
] as const;

export type ReputationSourceType = (typeof reputationSourceTypes)[number];

export type ProfileReputation = {
  available: false;
  score: null;
  sources: Partial<Record<ReputationSourceType, null>>;
};
