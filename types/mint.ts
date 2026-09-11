import type {
  ContentReport,
  SharedSocialContent,
  SocialContentPrivacy,
} from "@/types/content";

export type Mint = SharedSocialContent & {
  id: string;
  publishFormat?: "mint";
  privacy: SocialContentPrivacy;
  likeCount: number;
  /** Public, non-identity-bearing view total for the Mint. */
  viewCount: number;
  commentCount: number;
  saveCount: number;
  shareCount: number;
  repostCount?: number;
  archivedAt: string | null;
  isDevelopment: boolean;
  /** Development fixture release boundary used to exercise finite refresh. */
  developmentFeedGeneration?: number;
};

export type MintMedia = Mint["media"][number];

export type MintPrivateAppreciation = {
  id: string;
  mintId: string;
  userId: string;
  createdAt: string;
  source: "double_tap" | "accessible_action" | "legacy_like";
};

/**
 * Legacy name retained as a migration-only type alias. New UI must use the
 * explicit private-appreciation/public-endorsement concepts below.
 */
export type MintLike = MintPrivateAppreciation;

export type MintPublicEndorsement = {
  id: string;
  mintId: string;
  userId: string;
  createdAt: string;
};

export type MintSave = {
  id: string;
  mintId: string;
  userId: string;
  createdAt: string;
};

export type MintPin = {
  id: string;
  mintId: string;
  userId: string;
  pinnedAt: string;
};

export type MintDwellRecord = {
  mintId: string;
  userId: string;
  totalMeaningfulDwellMs: number;
  lastViewedAt: string;
  viewSessions: number;
};

export type MintRepost = {
  id: string;
  mintId: string;
  userId: string;
  createdAt: string;
};

export type MintShare = {
  id: string;
  mintId: string;
  userId: string;
  channel: "copy_link" | "direct_message" | "external";
  createdAt: string;
};

export type CommentAttachment =
  | { type: "image" | "gif"; url: string; alt: string | null }
  | {
      type: "video";
      url: string;
      thumbnailUrl: string | null;
      durationSeconds: number;
    }
  | { type: "sticker"; stickerId: string; label: string };

export type CommentFontStyle = "normal" | "serif" | "mono" | "bold";

export type SocialComment = {
  id: string;
  targetType: "mint" | "story";
  targetId: string;
  authorId: string;
  body: string;
  attachment?: CommentAttachment | null;
  fontStyle?: CommentFontStyle;
  likeCount?: number;
  repostCount?: number;
  mentions: Array<{ userId: string; username: string }>;
  parentCommentId: string | null;
  status: "active" | "deleted" | "removed";
  createdAt: string;
  updatedAt: string;
};

export type MintComment = SocialComment & { targetType: "mint" };
export type SocialCommentLike = {
  commentId: string;
  userId: string;
  createdAt: string;
};
export type SocialCommentRepost = {
  commentId: string;
  userId: string;
  createdAt: string;
};
export type CreateMintCommentInput = {
  body: string;
  attachment: CommentAttachment | null;
  fontStyle: CommentFontStyle;
  mentions?: MintComment["mentions"];
};
export type MintReport = ContentReport & { targetType: "mint" };

export type CreateMintInput = Omit<
  Mint,
  "id" | "createdAt" | "updatedAt" | "likeCount" | "viewCount" | "commentCount" | "saveCount" | "shareCount" | "status" | "archivedAt"
>;
