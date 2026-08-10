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
  commentCount: number;
  saveCount: number;
  shareCount: number;
  archivedAt: string | null;
  isDevelopment: boolean;
};

export type MintMedia = Mint["media"][number];

export type MintLike = {
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

export type MintShare = {
  id: string;
  mintId: string;
  userId: string;
  channel: "copy_link" | "direct_message" | "external";
  createdAt: string;
};

export type SocialComment = {
  id: string;
  targetType: "mint" | "story";
  targetId: string;
  authorId: string;
  body: string;
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
export type MintReport = ContentReport & { targetType: "mint" };

export type CreateMintInput = Omit<
  Mint,
  "id" | "createdAt" | "updatedAt" | "likeCount" | "commentCount" | "saveCount" | "shareCount" | "status" | "archivedAt"
>;
