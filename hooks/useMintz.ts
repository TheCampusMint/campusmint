"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import {
  createDevelopmentMintComments,
  createDevelopmentMintz,
} from "@/data/development/mintz";
import { areDevelopmentFixturesEnabled } from "@/lib/runtime/fixturePolicy";
import { resolveContentStatus } from "@/lib/content/expiration";
import { validateCommentAttachment } from "@/lib/content/commentMedia";
import { canRepostComment } from "@/lib/social/commentRanking";
import {
  migrateMintInteractionState,
  registerPrivateAppreciation as registerPrivateAppreciationRecord,
  togglePublicEndorsement as togglePublicEndorsementRecord,
  type StoredMintInteractionState,
} from "@/lib/social/mintInteractions";
import {
  canCommentOnMint,
  canLikeMint,
  canViewMint,
  type MintPermissionContext,
} from "@/lib/social/mintPermissions";
import {
  applyEditableMintPatch,
  type EditableMintPatch,
} from "@/lib/social/mintUpdates";
import {
  accumulateMeaningfulDwell,
  migrateSavedMintzToPins,
} from "@/lib/social/feedGeneration";
import type {
  ContentReport,
  PendingContentNotification,
} from "@/types/content";
import type {
  CreateMintInput,
  CreateMintCommentInput,
  Mint,
  MintComment,
  MintPrivateAppreciation,
  MintDwellRecord,
  MintPin,
  MintPublicEndorsement,
  MintSave,
  MintShare,
  SocialCommentLike,
  SocialCommentRepost,
} from "@/types/mint";

function localId(prefix: string) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

const DEVELOPMENT_PUBLIC_ENDORSEMENTS: MintPublicEndorsement[] = [
  {
    id: "dev-public-endorsement-noah-maya",
    mintId: "dev-mint-maya-campus",
    userId: "demo-tamu-noah",
    createdAt: "2026-08-10T17:30:00.000Z",
  },
];
const FIXTURES_ENABLED = areDevelopmentFixturesEnabled();

function interactionStorageKey(userId: string) {
  return `campusmint:mint-interactions:${userId}:v2`;
}

function feedStorageKey(userId: string) {
  return `campusmint:mint-feed:${userId}:v1`;
}

export function useMintz(currentUserId: string) {
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const [storedMintz, setStoredMintz] = useState<Mint[]>(() =>
    FIXTURES_ENABLED ? createDevelopmentMintz(currentTime) : [],
  );
  const [privateAppreciations, setPrivateAppreciations] = useState<
    MintPrivateAppreciation[]
  >([]);
  const [publicEndorsements, setPublicEndorsements] = useState<
    MintPublicEndorsement[]
  >(FIXTURES_ENABLED ? DEVELOPMENT_PUBLIC_ENDORSEMENTS : []);
  const [interactionsHydrated, setInteractionsHydrated] = useState(false);
  const [comments, setComments] = useState<MintComment[]>(() =>
    FIXTURES_ENABLED ? createDevelopmentMintComments(currentTime) : [],
  );
  const [commentLikes, setCommentLikes] = useState<SocialCommentLike[]>([]);
  const [commentReposts, setCommentReposts] = useState<SocialCommentRepost[]>([]);
  const [hiddenCommentIds, setHiddenCommentIds] = useState<string[]>([]);
  const [pins, setPins] = useState<MintPin[]>([]);
  const [dwellRecords, setDwellRecords] = useState<MintDwellRecord[]>([]);
  const [feedStateHydrated, setFeedStateHydrated] = useState(false);
  const [shares, setShares] = useState<MintShare[]>([]);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState<PendingContentNotification[]>([]);

  useLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem(
        interactionStorageKey(currentUserId),
      );
      if (stored) {
        const migrated = migrateMintInteractionState(JSON.parse(stored));
        // Local storage is the client-only hydration boundary for this prototype.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrivateAppreciations(migrated.privateAppreciations);
        setPublicEndorsements((current) => [
          ...current.filter(
            (seed) =>
              !migrated.publicEndorsements.some(
                (storedEndorsement) =>
                  storedEndorsement.mintId === seed.mintId &&
                  storedEndorsement.userId === seed.userId,
              ),
          ),
          ...migrated.publicEndorsements,
        ]);
      }
    } catch {
      // Corrupt development interaction state is ignored without clearing keys.
    } finally {
      setInteractionsHydrated(true);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!interactionsHydrated) return;
    const state: StoredMintInteractionState = {
      version: 2,
      privateAppreciations,
      publicEndorsements,
    };
    window.localStorage.setItem(
      interactionStorageKey(currentUserId),
      JSON.stringify(state),
    );
  }, [
    currentUserId,
    interactionsHydrated,
    privateAppreciations,
    publicEndorsements,
  ]);

  useLayoutEffect(() => {
    try {
      const raw = window.localStorage.getItem(feedStorageKey(currentUserId));
      if (raw) {
        const parsed = JSON.parse(raw) as { pins?: MintPin[]; dwellRecords?: MintDwellRecord[]; saves?: MintSave[]; savedMintIds?: string[] };
        const migratedPins = Array.isArray(parsed.pins)
          ? parsed.pins
          : migrateSavedMintzToPins({ saves: parsed.saves, savedMintIds: parsed.savedMintIds, userId: currentUserId, fallbackPinnedAt: "2026-08-10T12:00:00.000Z" });
        // Local storage is the client-only hydration boundary for this prototype.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPins(migratedPins);
        setDwellRecords(Array.isArray(parsed.dwellRecords) ? parsed.dwellRecords : []);
      } else if (FIXTURES_ENABLED && currentUserId === "current-demo-student") {
        setPins([{ id: "development-pin-maya", mintId: "dev-mint-maya-campus", userId: currentUserId, pinnedAt: "2026-09-09T18:00:00.000Z" }]);
      }
    } catch {
      // Invalid local feed state is ignored without clearing unrelated storage.
    } finally {
      setFeedStateHydrated(true);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!feedStateHydrated) return;
    window.localStorage.setItem(feedStorageKey(currentUserId), JSON.stringify({ version: 1, pins, dwellRecords }));
  }, [currentUserId, dwellRecords, feedStateHydrated, pins]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function refreshMintz() {
    setCurrentTime(Date.now());
    setRefreshGeneration((current) => current + 1);
  }

  const mintz = useMemo(() => storedMintz
    .filter((mint) => (mint.developmentFeedGeneration ?? 0) <= refreshGeneration)
    .map((mint) => ({
      ...mint,
      status: resolveContentStatus(mint.status, mint.expiresAt, currentTime),
    })), [currentTime, refreshGeneration, storedMintz]);

  function createMint(input: CreateMintInput) {
    const now = new Date().toISOString();
    const mint: Mint = {
      ...input,
      id: localId("mint"),
      createdAt: now,
      updatedAt: now,
      likeCount: 0,
      viewCount: 0,
      commentCount: 0,
      saveCount: 0,
      shareCount: 0,
      repostCount: 0,
      archivedAt: null,
      status: "active",
    };
    setStoredMintz((current) => [mint, ...current]);
    const recipients = new Map<string, "mention" | "tag">();
    mint.mentions.forEach((mention) => recipients.set(mention.userId, "mention"));
    mint.taggedUserIds.forEach((userId) => recipients.set(userId, "tag"));
    setPendingNotifications((current) => [...current, ...Array.from(recipients, ([recipientId, reason]) => ({
      id: localId("notification"),
      recipientId,
      actorId: mint.authorId,
      contentType: "mint" as const,
      contentId: mint.id,
      reason,
      createdAt: now,
      deliveredAt: null,
    }))]);
    return mint;
  }

  function registerPrivateAppreciation(
    context: MintPermissionContext,
    source: MintPrivateAppreciation["source"] = "double_tap",
  ) {
    const viewerId = context.viewer?.account.id;
    if (!viewerId || !canLikeMint(context)) return false;
    let added = false;
    setPrivateAppreciations((current) => {
      const result = registerPrivateAppreciationRecord(current, {
        id: localId("private-appreciation"),
        mintId: context.mint.id,
        userId: viewerId,
        createdAt: new Date().toISOString(),
        source,
      });
      added = result.added;
      return result.records;
    });
    return added;
  }

  function togglePublicEndorsement(context: MintPermissionContext) {
    const viewerId = context.viewer?.account.id;
    if (!viewerId || !canLikeMint(context)) return false;
    let endorsed = false;
    setPublicEndorsements((current) => {
      const result = togglePublicEndorsementRecord(current, {
        id: localId("public-endorsement"),
        mintId: context.mint.id,
        userId: viewerId,
        createdAt: new Date().toISOString(),
      });
      endorsed = result.endorsed;
      return result.records;
    });
    return endorsed;
  }

  function addComment(
    context: MintPermissionContext,
    input: string | CreateMintCommentInput,
    legacyMentions: MintComment["mentions"] = [],
  ) {
    const viewerId = context.viewer?.account.id;
    const structured =
      typeof input === "string"
        ? {
            body: input,
            attachment: null,
            fontStyle: "normal" as const,
            mentions: legacyMentions,
          }
        : input;
    const trimmedBody = structured.body.trim();
    const attachmentResult = validateCommentAttachment(structured.attachment);
    if (
      !viewerId ||
      (!trimmedBody && !structured.attachment) ||
      !attachmentResult.valid ||
      !canCommentOnMint(context)
    ) {
      return false;
    }
    const now = new Date().toISOString();
    setComments((current) => [...current, {
      id: localId("mint-comment"),
      targetType: "mint",
      targetId: context.mint.id,
      authorId: viewerId,
      body: trimmedBody,
      attachment: structured.attachment,
      fontStyle: structured.fontStyle,
      likeCount: 0,
      repostCount: 0,
      mentions: structured.mentions ?? [],
      parentCommentId: null,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }]);
    setStoredMintz((current) => current.map((mint) => mint.id === context.mint.id
      ? { ...mint, commentCount: mint.commentCount + 1, updatedAt: now }
      : mint));
    return true;
  }

  function toggleCommentLike(
    context: MintPermissionContext,
    commentId: string,
  ) {
    const viewerId = context.viewer?.account.id;
    const comment = comments.find(
      (candidate) => candidate.id === commentId && candidate.status === "active",
    );
    if (!viewerId || !comment || !canViewMint(context)) return false;
    const exists = commentLikes.some(
      (like) => like.commentId === commentId && like.userId === viewerId,
    );
    setCommentLikes((current) =>
      exists
        ? current.filter(
            (like) => !(like.commentId === commentId && like.userId === viewerId),
          )
        : [
            ...current,
            { commentId, userId: viewerId, createdAt: new Date().toISOString() },
          ],
    );
    setComments((current) =>
      current.map((candidate) =>
        candidate.id === commentId
          ? {
              ...candidate,
              likeCount: Math.max(
                0,
                (candidate.likeCount ?? 0) + (exists ? -1 : 1),
              ),
            }
          : candidate,
      ),
    );
    return true;
  }

  function toggleCommentRepost(
    context: MintPermissionContext,
    commentId: string,
  ) {
    const viewerId = context.viewer?.account.id;
    const comment = comments.find(
      (candidate) => candidate.id === commentId && candidate.status === "active",
    );
    if (
      !viewerId ||
      !comment ||
      !canRepostComment(comment, viewerId) ||
      !canViewMint(context)
    ) {
      return false;
    }
    const exists = commentReposts.some(
      (repost) => repost.commentId === commentId && repost.userId === viewerId,
    );
    setCommentReposts((current) =>
      exists
        ? current.filter(
            (repost) =>
              !(repost.commentId === commentId && repost.userId === viewerId),
          )
        : [
            ...current,
            { commentId, userId: viewerId, createdAt: new Date().toISOString() },
          ],
    );
    setComments((current) =>
      current.map((candidate) =>
        candidate.id === commentId
          ? {
              ...candidate,
              repostCount: Math.max(
                0,
                (candidate.repostCount ?? 0) + (exists ? -1 : 1),
              ),
            }
          : candidate,
      ),
    );
    return true;
  }

  function hideComment(commentId: string) {
    setHiddenCommentIds((current) =>
      current.includes(commentId) ? current : [...current, commentId],
    );
  }

  function deleteOwnComment(commentId: string, userId: string) {
    const comment = comments.find((candidate) => candidate.id === commentId);
    if (!comment || comment.authorId !== userId || comment.status !== "active") return false;
    setComments((current) => current.map((candidate) => candidate.id === commentId
      ? { ...candidate, status: "deleted", body: "", updatedAt: new Date().toISOString() }
      : candidate));
    setStoredMintz((current) => current.map((mint) => mint.id === comment.targetId
      ? { ...mint, commentCount: Math.max(0, mint.commentCount - 1) }
      : mint));
    return true;
  }

  function togglePin(context: MintPermissionContext) {
    const viewerId = context.viewer?.account.id;
    if (!viewerId || !canViewMint(context)) return false;
    const exists = pins.some((pin) => pin.mintId === context.mint.id && pin.userId === viewerId);
    setPins((current) => exists
      ? current.filter((pin) => !(pin.mintId === context.mint.id && pin.userId === viewerId))
      : [...current, { id: localId("mint-pin"), mintId: context.mint.id, userId: viewerId, pinnedAt: new Date().toISOString() }]);
    return true;
  }

  function recordMeaningfulDwell(mintId: string, elapsedMs: number, activeSurface = true) {
    const now = new Date().toISOString();
    setDwellRecords((current) => {
      const existing = current.find((item) => item.mintId === mintId && item.userId === currentUserId) ?? null;
      const next = accumulateMeaningfulDwell(existing, { mintId, userId: currentUserId, elapsedMs, meaningfulVisible: true, documentVisible: document.visibilityState === "visible", activeSurface, now });
      if (!next) return current;
      return [...current.filter((item) => !(item.mintId === mintId && item.userId === currentUserId)), next];
    });
  }

  function recordShare(context: MintPermissionContext, channel: MintShare["channel"]) {
    const viewerId = context.viewer?.account.id;
    if (!viewerId || !canViewMint(context)) return false;
    setShares((current) => [...current, { id: localId("mint-share"), mintId: context.mint.id, userId: viewerId, channel, createdAt: new Date().toISOString() }]);
    setStoredMintz((current) => current.map((mint) => mint.id === context.mint.id ? { ...mint, shareCount: mint.shareCount + 1 } : mint));
    return true;
  }

  function updateOwnMint(
    mintId: string,
    userId: string,
    patch: EditableMintPatch,
  ) {
    const mint = storedMintz.find((candidate) => candidate.id === mintId);
    if (!mint || mint.authorId !== userId || mint.status !== "active") return false;

    const updatedAt = new Date().toISOString();
    if (!applyEditableMintPatch(mint, patch, updatedAt)) return false;

    setStoredMintz((current) =>
      current.map((candidate) =>
        candidate.id === mintId
          ? applyEditableMintPatch(candidate, patch, updatedAt) ?? candidate
          : candidate,
      ),
    );

    return true;
  }

  function toggleArchive(mintId: string, userId: string) {
    const mint = storedMintz.find((candidate) => candidate.id === mintId);
    if (!mint || mint.authorId !== userId) return false;
    setStoredMintz((current) => current.map((candidate) => candidate.id === mintId
      ? { ...candidate, archivedAt: candidate.archivedAt ? null : new Date().toISOString(), updatedAt: new Date().toISOString() }
      : candidate));
    return true;
  }

  function deleteOwnMint(mintId: string, userId: string) {
    const mint = storedMintz.find((candidate) => candidate.id === mintId);
    if (!mint || mint.authorId !== userId) return false;
    setStoredMintz((current) => current.map((candidate) => candidate.id === mintId
      ? { ...candidate, status: "deleted", updatedAt: new Date().toISOString() }
      : candidate));
    return true;
  }

  function reportMint(context: MintPermissionContext, reason: ContentReport["reason"], details: string | null) {
    const viewerId = context.viewer?.account.id;
    if (!viewerId || !canViewMint(context)) return false;
    setReports((current) => [...current, { id: localId("mint-report"), reporterId: viewerId, targetType: "mint", targetId: context.mint.id, reason, details, createdAt: new Date().toISOString() }]);
    return true;
  }

  function reportComment(context: MintPermissionContext, commentId: string, reason: ContentReport["reason"] = "other") {
    const viewerId = context.viewer?.account.id;
    const comment = comments.find((candidate) => candidate.id === commentId && candidate.status === "active");
    if (!viewerId || !comment || !canViewMint(context)) return false;
    setReports((current) => [...current, { id: localId("comment-report"), reporterId: viewerId, targetType: "comment", targetId: commentId, reason, details: null, createdAt: new Date().toISOString() }]);
    return true;
  }

  return {
    mintz,
    currentTime,
    privateAppreciations,
    publicEndorsements,
    /** Privacy-safe compatibility alias for legacy call sites during migration. */
    likes: privateAppreciations,
    comments,
    commentLikes,
    commentReposts,
    hiddenCommentIds,
    pins,
    dwellRecords,
    refreshGeneration,
    shares,
    reports,
    pendingNotifications,
    refreshMintz,
    createMint,
    registerPrivateAppreciation,
    togglePublicEndorsement,
    addComment,
    toggleCommentLike,
    toggleCommentRepost,
    hideComment,
    deleteOwnComment,
    togglePin,
    recordMeaningfulDwell,
    recordShare,
    updateOwnMint,
    toggleArchive,
    deleteOwnMint,
    reportMint,
    reportComment,
  };
}

export type MintzState = ReturnType<typeof useMintz>;
