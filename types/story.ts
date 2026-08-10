import type { UserRole } from "@/data/userRoles";
import type {
  ContentLocation,
  ContentMention,
  EventContentData,
  MusicMetadata,
  SocialContentStatus,
  SocialContentType,
  SocialMedia,
  SocialPostType,
  OrganizationContentAudience,
} from "@/types/content";

export const storyCategories = [
  "Social",
  "Tailgate",
  "Free Food",
  "Study",
  "Club",
  "Sports",
  "Announcement",
  "Music",
  "Campus Life",
] as const;

export type StoryCategory = (typeof storyCategories)[number];

export const storyAudienceOptions = [
  { id: "students-only", label: "Students Only" },
  { id: "students-alumni", label: "Students + Alumni" },
  { id: "everyone", label: "Everyone" },
] as const;

export type StoryAudience = (typeof storyAudienceOptions)[number]["id"];

export const storyFilterOptions = [
  "For You",
  "My Campus",
  "Social",
  "Clubs",
  "Sports",
  "Study",
  "Free Food",
] as const;

export type StoryFilter = (typeof storyFilterOptions)[number];
export type StoryContentType = SocialContentType;

export type StoryComment = {
  id: string;
  authorId: string | null;
  authorName: string;
  body: string;
  mentions: ContentMention[];
  parentCommentId: string | null;
  status: "active" | "deleted" | "removed";
  createdAt: string;
  updatedAt: string;
};

export type StoryView = {
  storyId: string;
  viewerId: string;
  viewedAt: string;
};

export type StoryReaction = {
  storyId: string;
  userId: string;
  reaction: "like" | "love" | "laugh" | "wow" | "support";
  createdAt: string;
  updatedAt: string;
};

export type Story = {
  id: string;
  publishFormat?: "story";
  authorUserId?: string;
  authorName: string;
  authorUniversity: string;
  authorRole: UserRole;
  avatarPlaceholder: string;
  contentType: StoryContentType;
  text: string;
  postType?: SocialPostType;
  media?: SocialMedia[];
  caption?: string;
  music?: MusicMetadata | null;
  mentions?: ContentMention[];
  taggedUserIds?: string[];
  location?: ContentLocation | null;
  eventData?: EventContentData | null;
  commentsEnabled?: boolean;
  likesVisible?: boolean;
  status?: SocialContentStatus;
  imagePlaceholder?: string;
  category: StoryCategory;
  campus: string;
  audience: StoryAudience;
  createdAt: string;
  expiresAt: string;
  likeCount: number;
  commentCount: number;
  likedByCurrentUser: boolean;
  comments: StoryComment[];
  organizationId?: string;
  taggedOrganizationIds?: string[];
  organizationAudience?: OrganizationContentAudience;
};
