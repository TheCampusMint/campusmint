import type { UniversityId } from "@/data/universities";
import type { UserRole } from "@/data/userRoles";
import type {
  CampusMintUser,
  ProfilePrivacySettings,
} from "@/types/profile";

export const CURRENT_DEVELOPMENT_USER_ID = "current-demo-student";

const timestamp = "2026-08-10T12:00:00.000Z";

const publicPrivacy: ProfilePrivacySettings = {
  bio: "everyone",
  major: "everyone",
  graduationYear: "students_only",
  classes: "friends_only",
  clubs: "students_only",
  interests: "everyone",
  hometown: "private",
  instagram: "friends_only",
  linkedin: "everyone",
  portfolioUrl: "everyone",
  personalWebsite: "everyone",
};

type DevelopmentUserInput = {
  id: string;
  universityId: UniversityId;
  role?: UserRole;
  firstName: string;
  lastName: string;
  displayName: string;
  initials: string;
  bio: string;
  major: string | null;
  graduationYear: number | null;
  classIds?: string[];
  clubIds?: string[];
  interests?: string[];
  hometown?: string | null;
  linkedin?: string | null;
  privacy?: Partial<ProfilePrivacySettings>;
};

function developmentUser(input: DevelopmentUserInput): CampusMintUser {
  return {
    account: {
      id: input.id,
      universityId: input.universityId,
      role: input.role ?? "student",
      verifiedStudent: false,
      verifiedAlumni: false,
      isDevelopment: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    profile: {
      id: `profile-${input.id}`,
      accountId: input.id,
      firstName: input.firstName,
      lastName: input.lastName,
      displayName: input.displayName,
      photo: { kind: "development_placeholder", placeholderId: input.initials, storagePath: null },
      bio: input.bio,
      major: input.major,
      graduationYear: input.graduationYear,
      classIds: input.classIds ?? [],
      clubIds: input.clubIds ?? [],
      interests: input.interests ?? [],
      hometown: input.hometown ?? null,
      instagram: null,
      linkedin: input.linkedin ?? null,
      portfolioUrl: null,
      personalWebsite: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    privacy: { ...publicPrivacy, ...input.privacy },
  };
}

/** Fictional development records only. They are never presented as real students. */
export const developmentUsers: CampusMintUser[] = [
  developmentUser({
    id: CURRENT_DEVELOPMENT_USER_ID,
    universityId: "blinn",
    firstName: "Campus",
    lastName: "Student",
    displayName: "Campus Student (Demo)",
    initials: "CS",
    bio: "Development profile used to test Campus Mint without authentication.",
    major: "Computer Science",
    graduationYear: 2029,
    classIds: ["51000000-0000-4000-8000-000000000001"],
    clubIds: ["dev-blinn-coding-circle"],
    interests: ["Coding", "Campus events", "Coffee"],
    privacy: { hometown: "private", classes: "students_only" },
  }),
  developmentUser({
    id: "demo-seller-tamu",
    universityId: "tamu",
    firstName: "Maya",
    lastName: "Rodriguez",
    displayName: "Maya Rodriguez (Demo)",
    initials: "MR",
    bio: "Fictional student profile for testing Stories and Marketplace connections.",
    major: "Marketing",
    graduationYear: 2027,
    classIds: ["40000000-0000-4000-8000-000000000002"],
    clubIds: ["dev-tamu-product-builders"],
    interests: ["Game day", "Brand strategy", "Photography"],
    hometown: "San Antonio, Texas",
    linkedin: "https://example.com/maya-demo",
  }),
  developmentUser({
    id: "demo-tamu-jordan",
    universityId: "tamu",
    firstName: "Jordan",
    lastName: "Lee",
    displayName: "Jordan Lee (Demo)",
    initials: "JL",
    bio: "Fictional engineering student profile for local People search testing.",
    major: "Computer Engineering",
    graduationYear: 2028,
    classIds: ["40000000-0000-4000-8000-000000000001"],
    clubIds: ["dev-tamu-robotics"],
    interests: ["Robotics", "Tacos", "Product design"],
    privacy: { major: "friends_only", interests: "students_only" },
  }),
  developmentUser({
    id: "demo-seller-blinn",
    universityId: "blinn",
    firstName: "Avery",
    lastName: "Collins",
    displayName: "Avery Collins (Demo)",
    initials: "AC",
    bio: "Fictional Blinn student profile for campus-network discovery testing.",
    major: "Engineering",
    graduationYear: 2028,
    classIds: ["51000000-0000-4000-8000-000000000002"],
    clubIds: ["dev-blinn-service-crew"],
    interests: ["Study groups", "Volunteering"],
    privacy: { major: "students_only", hometown: "private" },
  }),
  developmentUser({
    id: "demo-tamu-noah",
    universityId: "tamu",
    role: "alumni",
    firstName: "Noah",
    lastName: "Williams",
    displayName: "Noah Williams (Demo)",
    initials: "NW",
    bio: "Fictional alumni mentor profile used for relationship controls.",
    major: "Mechanical Engineering",
    graduationYear: 2024,
    clubIds: ["dev-tamu-robotics"],
    interests: ["Mentoring", "Robotics"],
  }),
  developmentUser({
    id: "demo-tamu-townhall",
    universityId: "tamu",
    role: "university-admin",
    firstName: "MSC",
    lastName: "Town Hall",
    displayName: "MSC Town Hall (Demo)",
    initials: "TH",
    bio: "Development-only university-admin profile used to test institutional Story authors.",
    major: null,
    graduationYear: null,
    interests: ["Campus programming", "Student events"],
  }),
  developmentUser({
    id: "demo-blinn-taylor",
    universityId: "blinn",
    firstName: "Taylor",
    lastName: "Brooks",
    displayName: "Taylor Brooks (Demo)",
    initials: "TB",
    bio: "Fictional student profile for Stories author navigation.",
    major: "Biology",
    graduationYear: 2027,
    clubIds: ["dev-blinn-creative-arts"],
    interests: ["Chemistry", "Creative arts"],
  }),
  developmentUser({
    id: "demo-tamu-officer",
    universityId: "tamu",
    firstName: "Demo",
    lastName: "Officer",
    displayName: "Demo Officer (Texas A&M)",
    initials: "DO",
    bio: "Development-only club officer profile.",
    major: "Computer Science",
    graduationYear: 2027,
    clubIds: ["dev-tamu-robotics"],
    interests: ["Clubs", "Robotics"],
  }),
  developmentUser({
    id: "demo-blinn-officer",
    universityId: "blinn",
    firstName: "Demo",
    lastName: "Officer",
    displayName: "Demo Officer (Blinn)",
    initials: "DO",
    bio: "Development-only club officer profile.",
    major: "Computer Science",
    graduationYear: 2028,
    clubIds: ["dev-blinn-coding-circle"],
    interests: ["Clubs", "Coding"],
  }),
];

export function getDevelopmentUserById(userId: string) {
  return developmentUsers.find((user) => user.account.id === userId) ?? null;
}
