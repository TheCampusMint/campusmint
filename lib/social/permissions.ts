import type {
  CampusMintUser,
  ProfilePrivacyField,
  ProfileViewerContext,
} from "@/types/profile";
import type { FriendshipStatus } from "@/types/social";

export function canViewProfileField({
  viewer,
  owner,
  friendshipStatus,
}: ProfileViewerContext, field: ProfilePrivacyField) {
  if (viewer.account.id === owner.account.id) return true;
  if (friendshipStatus === "blocked") return false;

  const visibility = owner.privacy[field];
  if (visibility === "everyone") return true;
  if (visibility === "students_only") return viewer.account.role === "student";
  if (visibility === "friends_only") return friendshipStatus === "friends";
  return false;
}

export function createProfileViewerContext(
  viewer: CampusMintUser,
  owner: CampusMintUser,
  friendshipStatus: FriendshipStatus,
): ProfileViewerContext {
  return { viewer, owner, friendshipStatus };
}

export const canViewBio = (context: ProfileViewerContext) => canViewProfileField(context, "bio");
export const canViewMajor = (context: ProfileViewerContext) => canViewProfileField(context, "major");
export const canViewGraduationYear = (context: ProfileViewerContext) => canViewProfileField(context, "graduationYear");
export const canViewClasses = (context: ProfileViewerContext) => canViewProfileField(context, "classes");
export const canViewClubs = (context: ProfileViewerContext) => canViewProfileField(context, "clubs");
export const canViewInterests = (context: ProfileViewerContext) => canViewProfileField(context, "interests");
export const canViewRoommate = (context: ProfileViewerContext) => canViewProfileField(context, "roommate");
export const canViewTutoring = (context: ProfileViewerContext) => canViewProfileField(context, "tutoring");
export const canViewHometown = (context: ProfileViewerContext) => canViewProfileField(context, "hometown");
export const canViewInstagram = (context: ProfileViewerContext) => canViewProfileField(context, "instagram");
export const canViewLinkedIn = (context: ProfileViewerContext) => canViewProfileField(context, "linkedin");
export const canViewPortfolio = (context: ProfileViewerContext) => canViewProfileField(context, "portfolioUrl");
export const canViewPersonalWebsite = (context: ProfileViewerContext) => canViewProfileField(context, "personalWebsite");
