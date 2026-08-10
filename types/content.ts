import type { UniversityId } from "@/data/universities";
import type { CampusNetworkId } from "@/data/campusNetworks";

export const socialContentTypes = ["image", "video", "carousel", "text"] as const;
export type SocialContentType = (typeof socialContentTypes)[number];

/** Mint/Story is the publish format; Personal/Event/Club is the content kind. */
export const publishFormats = ["mint", "story"] as const;
export type PublishFormat = (typeof publishFormats)[number];

export const socialContentKinds = ["personal", "event", "club"] as const;
export type SocialContentKind = (typeof socialContentKinds)[number];

/** Kept as an alias while existing components migrate to the clearer content-kind name. */
export type SocialPostType = SocialContentKind;

export type ContentDestination = PublishFormat;
export type SocialContentStatus = "active" | "expired" | "deleted" | "removed";
export type SocialContentPrivacy = "account" | "public" | "connections" | "private";
export type OrganizationContentAudience = "public" | "members";

export type SocialMedia = {
  id: string;
  type: "image" | "video";
  url: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  order: number;
  isDevelopmentPlaceholder: boolean;
};

export type ContentMention = {
  userId: string;
  username: string;
};

export type ContentLocation = {
  source: "campus_entity" | "event" | "custom";
  entityId: string | null;
  label: string;
  details: string | null;
};

export type MusicMetadata = {
  provider: "development" | "licensed_provider";
  trackId: string;
  trackTitle: string;
  artist: string;
  artworkUrl: string | null;
  previewUrl: string | null;
};

/** When eventId exists, canonical Event fields remain the source of truth. */
export type EventContentData = {
  eventId: string | null;
  title: string | null;
  eventStartAt: string | null;
  eventEndAt: string | null;
  timeZone: string | null;
  location: ContentLocation | null;
  locationDetails: string | null;
  description: string | null;
};

export type SharedSocialContent = {
  authorId: string;
  universityId: UniversityId;
  campusNetworkId: CampusNetworkId;
  contentType: SocialContentType;
  postType: SocialPostType;
  media: SocialMedia[];
  caption: string;
  hashtags: string[];
  mentions: ContentMention[];
  taggedUserIds: string[];
  location: ContentLocation | null;
  music: MusicMetadata | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  commentsEnabled: boolean;
  likesVisible: boolean;
  eventData: EventContentData | null;
  organizationId?: string | null;
  taggedOrganizationIds?: string[];
  organizationAudience?: OrganizationContentAudience;
  status: SocialContentStatus;
};

export type ContentReportTarget = "mint" | "story" | "comment";

export type ContentReport = {
  id: string;
  reporterId: string;
  targetType: ContentReportTarget;
  targetId: string;
  reason: "spam" | "harassment" | "misleading" | "inappropriate_content" | "other";
  details: string | null;
  createdAt: string;
};

export type PendingContentNotification = {
  id: string;
  recipientId: string;
  actorId: string;
  contentType: "mint" | "story";
  contentId: string;
  reason: "mention" | "tag";
  createdAt: string;
  deliveredAt: null;
};
