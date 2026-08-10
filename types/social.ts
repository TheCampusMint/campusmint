export const friendshipStatuses = ["none", "requested", "friends", "blocked"] as const;
export type FriendshipStatus = (typeof friendshipStatuses)[number];

export type Friendship = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: Exclude<FriendshipStatus, "none">;
  createdAt: string;
  updatedAt: string;
};

export type Follow = {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
};

export type UserBlock = {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
};

export const userReportReasons = [
  "spam",
  "harassment",
  "impersonation",
  "inappropriate_content",
  "other",
] as const;

export type UserReportReason = (typeof userReportReasons)[number];

export type UserReport = {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: UserReportReason;
  details: string | null;
  status: "local_pending";
  createdAt: string;
};
