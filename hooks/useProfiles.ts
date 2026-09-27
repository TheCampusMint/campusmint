"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CURRENT_DEVELOPMENT_USER_ID,
  developmentUsers,
} from "@/data/development/users";
import { areDevelopmentFixturesEnabled } from "@/lib/runtime/fixturePolicy";
import { normalizeProfileUpdate, persistProfile, profileValuesFromRow } from "@/lib/auth/profilePersistence";
import {
  getFriendshipStatus as findFriendshipStatus,
  getNextFriendshipStatus,
} from "@/lib/social/relationships";
import { isUsernameAvailable } from "@/lib/social/usernames";
import type {
  CampusMintAccount,
  CampusMintProfile,
  CampusMintUser,
  ProfilePrivacySettings,
  ProfileSocialSettings,
} from "@/types/profile";
import type {
  Follow,
  Friendship,
  UserBlock,
  UserReport,
  UserReportReason,
} from "@/types/social";

type EditableProfilePatch = Partial<Omit<CampusMintProfile, "id" | "accountId" | "createdAt" | "usernameNormalized">>;

const DEVELOPMENT_PROFILE_STORAGE_KEY =
  "campusmint:development-current-user:v1";

const FIXTURES_ENABLED = areDevelopmentFixturesEnabled();
const EMPTY_SESSION_USER: CampusMintUser = {
  account: {
    id: "anonymous-session",
    universityId: "tamu",
    role: "student",
    verifiedStudent: false,
    verifiedAlumni: false,
    onboardingCompletedAt: null,
    isDevelopment: false,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
  },
  profile: {
    id: "anonymous-session",
    accountId: "anonymous-session",
    username: "new.student",
    usernameNormalized: "new.student",
    firstName: "",
    lastName: "",
    displayName: "New student",
    photo: { kind: "initials", placeholderId: null, storagePath: null },
    bio: null,
    major: null,
    graduationYear: null,
    classIds: [], clubIds: [], interests: [], hometown: null,
    instagram: null, linkedin: null, portfolioUrl: null, personalWebsite: null,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
  },
  privacy: {
    bio: "everyone", major: "students_only", graduationYear: "students_only",
    classes: "friends_only", clubs: "students_only", interests: "everyone",
    roommate: "private", tutoring: "students_only", hometown: "private",
    instagram: "friends_only", linkedin: "everyone", portfolioUrl: "everyone",
    personalWebsite: "everyone",
  },
  socialSettings: { accountType: "private", discoveryScope: "university" },
};

function localId(prefix: string) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

export function useProfiles() {
  const [users, setUsers] = useState<CampusMintUser[]>(
    FIXTURES_ENABLED ? developmentUsers : [EMPTY_SESSION_USER],
  );
  const [developmentProfileHydrated, setDevelopmentProfileHydrated] =
    useState(!FIXTURES_ENABLED);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [follows, setFollows] = useState<Follow[]>(FIXTURES_ENABLED ? [
    {
      id: "dev-follow-current-noah",
      followerId: CURRENT_DEVELOPMENT_USER_ID,
      followingId: "demo-tamu-noah",
      createdAt: "2026-08-10T17:00:00.000Z",
    },
    { id: "dev-follow-current-maya", followerId: CURRENT_DEVELOPMENT_USER_ID, followingId: "demo-seller-tamu", createdAt: "2026-08-11T17:00:00.000Z" },
    { id: "dev-follow-maya-current", followerId: "demo-seller-tamu", followingId: CURRENT_DEVELOPMENT_USER_ID, createdAt: "2026-08-11T17:01:00.000Z" },
    { id: "dev-follow-current-jordan", followerId: CURRENT_DEVELOPMENT_USER_ID, followingId: "demo-tamu-jordan", createdAt: "2026-08-12T17:00:00.000Z" },
    { id: "dev-follow-current-officer", followerId: CURRENT_DEVELOPMENT_USER_ID, followingId: "demo-tamu-officer", createdAt: "2026-08-13T17:00:00.000Z" },
  ] : []);
  const [blocks, setBlocks] = useState<UserBlock[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  const currentUser = useMemo(
    () => users.find((user) => user.account.id === sessionUserId) ?? users.find((user) => user.account.id === CURRENT_DEVELOPMENT_USER_ID) ?? users[0] ?? EMPTY_SESSION_USER,
    [sessionUserId, users],
  );

  const hydrateAuthenticatedUser = useCallback((authenticatedUser: CampusMintUser) => {
    setSessionUserId(authenticatedUser.account.id);
    setUsers((current) => {
      const withoutPlaceholder = current.filter((candidate) => candidate.account.id !== EMPTY_SESSION_USER.account.id && candidate.account.id !== authenticatedUser.account.id);
      return [authenticatedUser, ...withoutPlaceholder];
    });
  }, []);

  const clearAuthenticatedUser = useCallback(() => {
    setSessionUserId(null);
    if (!FIXTURES_ENABLED) setUsers([EMPTY_SESSION_USER]);
  }, []);

  useEffect(() => {
    if (!FIXTURES_ENABLED) return;
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(
          DEVELOPMENT_PROFILE_STORAGE_KEY,
        );

        if (stored) {
          const parsed = JSON.parse(stored) as CampusMintUser;

          if (
            parsed?.account?.id ===
            CURRENT_DEVELOPMENT_USER_ID
          ) {
            setUsers((currentUsers) =>
              currentUsers.map((user) =>
                user.account.id ===
                CURRENT_DEVELOPMENT_USER_ID
                  ? parsed
                  : user,
              ),
            );
          }
        }
      } catch {
        window.localStorage.removeItem(
          DEVELOPMENT_PROFILE_STORAGE_KEY,
        );
      } finally {
        setDevelopmentProfileHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!developmentProfileHydrated || !FIXTURES_ENABLED) return;

    const current = users.find(
      (user) =>
        user.account.id ===
        CURRENT_DEVELOPMENT_USER_ID,
    );

    if (!current) return;

    window.localStorage.setItem(
      DEVELOPMENT_PROFILE_STORAGE_KEY,
      JSON.stringify(current),
    );
  }, [developmentProfileHydrated, users]);

  function getUserById(userId: string) {
    return users.find((user) => user.account.id === userId) ?? null;
  }

  function updateCurrentAccount(
    patch: Partial<
      Omit<
        CampusMintAccount,
        "id" | "createdAt"
      >
    >,
  ) {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.account.id === currentUser.account.id
          ? {
              ...user,
              account: {
                ...user.account,
                ...patch,
                updatedAt:
                  new Date().toISOString(),
              },
            }
          : user,
      ),
    );
  }


  async function updateCurrentProfile(patch: EditableProfilePatch) {
    const currentProfile = users.find((candidate) => candidate.account.id === currentUser.account.id);
    if (!currentProfile || currentProfile.account.id === EMPTY_SESSION_USER.account.id) {
      return { ok: false, error: "Sign in to save your profile." } as const;
    }
    const username = patch.username ?? currentProfile?.profile.username ?? "";
    const usernameResult = isUsernameAvailable(username, users, currentUser.account.id);
    if (!usernameResult.valid) return { ok: false, error: usernameResult.error } as const;

    const merged = { ...currentProfile.profile, ...patch, username };
    const normalized = normalizeProfileUpdate(merged);
    if (!normalized.ok) return { ok: false, error: normalized.message } as const;
    let savedProfile = profileValuesFromRow(normalized.update);
    if (!currentProfile.account.isDevelopment) {
      const result = await persistProfile(savedProfile);
      if (!result.ok) return result;
      savedProfile = result.profile;
    }

    setUsers((currentUsers) => currentUsers.map((user) =>
      user.account.id === currentUser.account.id
        ? {
            ...user,
            profile: {
              ...user.profile,
              ...savedProfile,
              updatedAt: new Date().toISOString(),
            },
          }
          : user));

    return { ok: true, error: null } as const;
  }

  function updateCurrentPrivacy(patch: Partial<ProfilePrivacySettings>) {
    setUsers((currentUsers) => currentUsers.map((user) =>
      user.account.id === currentUser.account.id
        ? { ...user, privacy: { ...user.privacy, ...patch } }
        : user));
  }

  function updateCurrentSocialSettings(patch: Partial<ProfileSocialSettings>) {
    setUsers((currentUsers) => currentUsers.map((user) =>
      user.account.id === currentUser.account.id
        ? { ...user, socialSettings: { ...user.socialSettings, ...patch } }
        : user));
  }

  function getFriendshipStatus(targetUserId: string) {
    if (isBlocked(targetUserId)) return "blocked" as const;
    return findFriendshipStatus(friendships, currentUser.account.id, targetUserId);
  }

  function cycleFriendship(targetUserId: string) {
    if (isBlocked(targetUserId)) return;
    setFriendships((currentFriendships) => {
      const currentStatus = findFriendshipStatus(
        currentFriendships,
        currentUser.account.id,
        targetUserId,
      );
      const nextStatus = getNextFriendshipStatus(currentStatus);
      const withoutRelationship = currentFriendships.filter((friendship) => !(
        (friendship.requesterId === currentUser.account.id && friendship.addresseeId === targetUserId) ||
        (friendship.requesterId === targetUserId && friendship.addresseeId === currentUser.account.id)
      ));

      if (nextStatus === "none") return withoutRelationship;
      const now = new Date().toISOString();
      return [...withoutRelationship, {
        id: localId("friendship"),
        requesterId: currentUser.account.id,
        addresseeId: targetUserId,
        status: nextStatus,
        createdAt: now,
        updatedAt: now,
      }];
    });
  }

  function isFollowing(targetUserId: string) {
    return follows.some((follow) =>
      follow.followerId === currentUser.account.id && follow.followingId === targetUserId);
  }

  function isFollowedBy(targetUserId: string) {
    return follows.some((follow) =>
      follow.followerId === targetUserId && follow.followingId === currentUser.account.id);
  }

  function toggleFollow(targetUserId: string) {
    if (isBlocked(targetUserId)) return;
    setFollows((currentFollows) => {
      const exists = currentFollows.some((follow) =>
        follow.followerId === currentUser.account.id && follow.followingId === targetUserId);
      if (exists) {
        return currentFollows.filter((follow) => !(
          follow.followerId === currentUser.account.id && follow.followingId === targetUserId));
      }
      return [...currentFollows, {
        id: localId("follow"),
        followerId: currentUser.account.id,
        followingId: targetUserId,
        createdAt: new Date().toISOString(),
      }];
    });
  }

  function isBlocked(targetUserId: string) {
    return blocks.some((block) =>
      block.blockerId === currentUser.account.id && block.blockedId === targetUserId);
  }

  function blockUser(targetUserId: string) {
    if (isBlocked(targetUserId)) return;
    setBlocks((currentBlocks) => [...currentBlocks, {
      id: localId("block"),
      blockerId: currentUser.account.id,
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
      block.blockerId === currentUser.account.id && block.blockedId === targetUserId)));
  }

  function reportUser(targetUserId: string, reason: UserReportReason, details: string | null) {
    setReports((currentReports) => [...currentReports, {
      id: localId("report"),
      reporterId: currentUser.account.id,
      reportedId: targetUserId,
      reason,
      details,
      status: "local_pending",
      createdAt: new Date().toISOString(),
    }]);
  }

  function logoutDevelopmentUser() {
    window.localStorage.removeItem(
      DEVELOPMENT_PROFILE_STORAGE_KEY,
    );

    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.account.id === currentUser.account.id
          ? {
              ...user,
              account: {
                ...user.account,
                onboardingCompletedAt: null,
              },
            }
          : user,
      ),
    );
  }

  return {
    users,
    currentUser,
    developmentProfileHydrated,
    friendships,
    follows,
    blocks,
    reports,
    getUserById,
    updateCurrentAccount,
    updateCurrentProfile,
    updateCurrentPrivacy,
    updateCurrentSocialSettings,
    logoutDevelopmentUser,
    getFriendshipStatus,
    cycleFriendship,
    isFollowing,
    isFollowedBy,
    toggleFollow,
    isBlocked,
    blockUser,
    unblockUser,
    reportUser,
    hydrateAuthenticatedUser,
    clearAuthenticatedUser,
  };
}

export type ProfilesState = ReturnType<typeof useProfiles>;
