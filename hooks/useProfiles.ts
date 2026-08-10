"use client";

import { useMemo, useState } from "react";

import {
  CURRENT_DEVELOPMENT_USER_ID,
  developmentUsers,
} from "@/data/development/users";
import {
  getFriendshipStatus as findFriendshipStatus,
  getNextFriendshipStatus,
} from "@/lib/social/relationships";
import type {
  CampusMintProfile,
  CampusMintUser,
  ProfilePrivacySettings,
} from "@/types/profile";
import type {
  Follow,
  Friendship,
  UserBlock,
  UserReport,
  UserReportReason,
} from "@/types/social";

type EditableProfilePatch = Partial<Omit<CampusMintProfile, "id" | "accountId" | "createdAt">>;

function localId(prefix: string) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

export function useProfiles() {
  const [users, setUsers] = useState<CampusMintUser[]>(developmentUsers);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [blocks, setBlocks] = useState<UserBlock[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);

  const currentUser = useMemo(
    () => users.find((user) => user.account.id === CURRENT_DEVELOPMENT_USER_ID) ?? users[0],
    [users],
  );

  function getUserById(userId: string) {
    return users.find((user) => user.account.id === userId) ?? null;
  }

  function updateCurrentProfile(patch: EditableProfilePatch) {
    setUsers((currentUsers) => currentUsers.map((user) =>
      user.account.id === CURRENT_DEVELOPMENT_USER_ID
        ? {
            ...user,
            profile: {
              ...user.profile,
              ...patch,
              updatedAt: new Date().toISOString(),
            },
          }
        : user));
  }

  function updateCurrentPrivacy(patch: Partial<ProfilePrivacySettings>) {
    setUsers((currentUsers) => currentUsers.map((user) =>
      user.account.id === CURRENT_DEVELOPMENT_USER_ID
        ? { ...user, privacy: { ...user.privacy, ...patch } }
        : user));
  }

  function getFriendshipStatus(targetUserId: string) {
    if (isBlocked(targetUserId)) return "blocked" as const;
    return findFriendshipStatus(friendships, CURRENT_DEVELOPMENT_USER_ID, targetUserId);
  }

  function cycleFriendship(targetUserId: string) {
    if (isBlocked(targetUserId)) return;
    setFriendships((currentFriendships) => {
      const currentStatus = findFriendshipStatus(
        currentFriendships,
        CURRENT_DEVELOPMENT_USER_ID,
        targetUserId,
      );
      const nextStatus = getNextFriendshipStatus(currentStatus);
      const withoutRelationship = currentFriendships.filter((friendship) => !(
        (friendship.requesterId === CURRENT_DEVELOPMENT_USER_ID && friendship.addresseeId === targetUserId) ||
        (friendship.requesterId === targetUserId && friendship.addresseeId === CURRENT_DEVELOPMENT_USER_ID)
      ));

      if (nextStatus === "none") return withoutRelationship;
      const now = new Date().toISOString();
      return [...withoutRelationship, {
        id: localId("friendship"),
        requesterId: CURRENT_DEVELOPMENT_USER_ID,
        addresseeId: targetUserId,
        status: nextStatus,
        createdAt: now,
        updatedAt: now,
      }];
    });
  }

  function isFollowing(targetUserId: string) {
    return follows.some((follow) =>
      follow.followerId === CURRENT_DEVELOPMENT_USER_ID && follow.followingId === targetUserId);
  }

  function toggleFollow(targetUserId: string) {
    if (isBlocked(targetUserId)) return;
    setFollows((currentFollows) => {
      const exists = currentFollows.some((follow) =>
        follow.followerId === CURRENT_DEVELOPMENT_USER_ID && follow.followingId === targetUserId);
      if (exists) {
        return currentFollows.filter((follow) => !(
          follow.followerId === CURRENT_DEVELOPMENT_USER_ID && follow.followingId === targetUserId));
      }
      return [...currentFollows, {
        id: localId("follow"),
        followerId: CURRENT_DEVELOPMENT_USER_ID,
        followingId: targetUserId,
        createdAt: new Date().toISOString(),
      }];
    });
  }

  function isBlocked(targetUserId: string) {
    return blocks.some((block) =>
      block.blockerId === CURRENT_DEVELOPMENT_USER_ID && block.blockedId === targetUserId);
  }

  function blockUser(targetUserId: string) {
    if (isBlocked(targetUserId)) return;
    setBlocks((currentBlocks) => [...currentBlocks, {
      id: localId("block"),
      blockerId: CURRENT_DEVELOPMENT_USER_ID,
      blockedId: targetUserId,
      createdAt: new Date().toISOString(),
    }]);
    setFriendships((currentFriendships) => currentFriendships.filter((friendship) =>
      friendship.requesterId !== targetUserId && friendship.addresseeId !== targetUserId));
    setFollows((currentFollows) => currentFollows.filter((follow) =>
      follow.followerId !== targetUserId && follow.followingId !== targetUserId));
  }

  function unblockUser(targetUserId: string) {
    setBlocks((currentBlocks) => currentBlocks.filter((block) => !(
      block.blockerId === CURRENT_DEVELOPMENT_USER_ID && block.blockedId === targetUserId)));
  }

  function reportUser(targetUserId: string, reason: UserReportReason, details: string | null) {
    setReports((currentReports) => [...currentReports, {
      id: localId("report"),
      reporterId: CURRENT_DEVELOPMENT_USER_ID,
      reportedId: targetUserId,
      reason,
      details,
      status: "local_pending",
      createdAt: new Date().toISOString(),
    }]);
  }

  return {
    users,
    currentUser,
    friendships,
    follows,
    blocks,
    reports,
    getUserById,
    updateCurrentProfile,
    updateCurrentPrivacy,
    getFriendshipStatus,
    cycleFriendship,
    isFollowing,
    toggleFollow,
    isBlocked,
    blockUser,
    unblockUser,
    reportUser,
  };
}

export type ProfilesState = ReturnType<typeof useProfiles>;
