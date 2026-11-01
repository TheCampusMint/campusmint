import type { CampusMintUser, ProfilePrivacyField } from "../../types/profile.ts";

export const databasePrivacyField = (key: ProfilePrivacyField): string => key === "graduationYear" ? "graduation_year" : key === "portfolioUrl" ? "portfolio_url" : key === "personalWebsite" ? "personal_website" : key;

/** Author records are a server projection, not a client-side privacy filter. */
export function projectFeedAuthor(author: CampusMintUser, viewer: { id: string; verifiedStudent: boolean; connected: boolean; preview: boolean }): CampusMintUser {
  if (author.account.id === viewer.id && !viewer.preview) return author;
  const allowed = (field: ProfilePrivacyField) => {
    const visibility = author.privacy[field];
    if (viewer.preview) return author.socialSettings.accountType === "public" && visibility === "everyone";
    if (author.socialSettings.accountType !== "public" && !viewer.connected) return false;
    return visibility === "everyone" || visibility === "students_only" && viewer.verifiedStudent || visibility === "friends_only" && viewer.connected;
  };
  const profile = { ...author.profile, photo: { ...author.profile.photo, storagePath: null } };
  for (const field of ["bio","major","graduationYear","hometown","instagram","linkedin","portfolioUrl","personalWebsite"] as const) if (!allowed(field)) profile[field] = null;
  if (!allowed("major")) profile.academicArea = null;
  if (!allowed("interests")) { profile.interests = []; profile.hobbies = []; profile.sportsInterests = []; }
  if (!allowed("classes")) profile.classIds = [];
  if (!allowed("clubs")) profile.clubIds = [];
  if (!allowed("roommate")) { profile.lookingForRoommate = false; profile.roommatePreferences = []; }
  if (!allowed("tutoring")) { profile.offersTutoring = false; profile.tutoringSubjects = []; }
  return { ...author, account: { ...author.account, capabilities: author.account.capabilities?.filter(value => value === "creator") }, profile };
}
