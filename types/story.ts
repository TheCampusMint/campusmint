import type { UserRole } from "@/data/userRoles";

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
export type StoryContentType = "text" | "image-placeholder";

export type StoryComment = {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
};

export type Story = {
  id: string;
  authorUserId?: string;
  authorName: string;
  authorUniversity: string;
  authorRole: UserRole;
  avatarPlaceholder: string;
  contentType: StoryContentType;
  text: string;
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
};
