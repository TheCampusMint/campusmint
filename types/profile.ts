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
  "roommate",
  "tutoring",
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

  /** Legacy configured-campus ID used while existing campus features migrate. */
  universityId: UniversityId;

  /** Universal identity for a registry-confirmed higher-ed .edu domain. */
  universityIdentityId?: string | null;
  universityDomain?: string | null;
  universityName?: string | null;
  universityShortName?: string | null;
  knownUniversityId?: UniversityId | null;

  role: UserRole;

  /**
   * Legacy feature gate. True after eligible-institution email mailbox
   * verification; it does not prove enrollment, identity, DOB, or age.
   */
  verifiedStudent: boolean;
  verifiedAlumni: boolean;

  studentEmail?: string | null;
  personalEmail?: string | null;
  primaryEmail?: string | null;
  phoneNumber?: string | null;

  studentEmailDomain?: string | null;
  studentEmailVerifiedAt?: string | null;
  studentEmailVerificationMethod?:
    | "edu_email"
    | "email_otp"
    | null;
  studentEmailVerificationChallengeId?: string | null;
  onboardingCompletedAt?: string | null;

  isDevelopment: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CampusMintProfile = {
  id: string;
  accountId: string;
  username: string;
  usernameNormalized: string;
  firstName: string;
  lastName: string;
  displayName: string;
  photo: ProfilePhoto;
  bio: string | null;
  major: string | null;
  academicArea?: string | null;
  graduationYear: number | null;
  classIds: string[];
  clubIds: string[];
  interests: string[];
  hobbies?: string[];
  lookingForRoommate?: boolean;
  roommatePreferences?: string[];
  offersTutoring?: boolean;
  tutoringSubjects?: string[];
  hometown: string | null;
  instagram: string | null;
  linkedin: string | null;
  portfolioUrl: string | null;
  personalWebsite: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SocialAccountType = "public" | "private";
export type SocialDiscoveryScope = "university" | "campus_network" | "community";

export type ProfileSocialSettings = {
  accountType: SocialAccountType;
  discoveryScope: SocialDiscoveryScope;
};

export type CampusMintUser = {
  account: CampusMintAccount;
  profile: CampusMintProfile;
  privacy: ProfilePrivacySettings;
  socialSettings: ProfileSocialSettings;
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
