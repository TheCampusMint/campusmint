"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  createDevelopmentMintComments,
  createDevelopmentMintz,
} from "@/data/development/mintz";
import { areDevelopmentFixturesEnabled } from "@/lib/runtime/fixturePolicy";
import { campusReadScope } from "@/lib/runtime/campusPreview";
import type { UniversityId } from "@/data/universities";
import type { LocalMintMediaSelection } from "@/lib/content/localMintMedia";
import { publishMint } from "@/lib/content/publishMint";
import { emptyPoll } from "@/lib/content/polls";
import { accountScopedValue, activateAccountRequestScope, beginAccountRequest, createAccountRequestScope } from "@/lib/content/accountRequestScope";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveContentStatus } from "@/lib/content/expiration";
import { validateCommentAttachment } from "@/lib/content/commentMedia";
import {
  readMintDrafts,
  removeMintDraft,
  upsertMintDraft,
  type MintDraft,
  type MintDraftInput,
} from "@/lib/content/mintDrafts";
import { deleteStoredMintDraft, listStoredMintDrafts, storeMintDraft } from "@/lib/content/mintDraftStore";
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
import type { MintFeedResponse } from "@/types/mintPersistence";
import type { CampusMintUser } from "@/types/profile";

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
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function interactionStorageKey(userId: string) {
  return `campusmint:mint-interactions:${userId}:v2`;
}

function feedStorageKey(userId: string) {
  return `campusmint:mint-feed:${userId}:v1`;
}

function readLegacyDrafts(userId: string) {
  try { return readMintDrafts(window.localStorage, userId); } catch { return []; }
}

export function useMintz(currentUserId: string, previewUniversityId: UniversityId | null = null) {
  const readScope = campusReadScope(currentUserId, previewUniversityId);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const [feedRevision, setFeedRevision] = useState(0);
  const [rawStoredMintz, setStoredMintz] = useState<Mint[]>(() =>
    FIXTURES_ENABLED ? createDevelopmentMintz(currentTime) : [],
  );
  const [rawPersistedAuthors, setPersistedAuthors] = useState<CampusMintUser[]>([]);
  const [feedOwnerId, setFeedOwnerId] = useState(readScope);
  const [persistenceStatus, setPersistenceStatus] = useState<{ userId: string; error: string | null; loading: boolean }>({ userId: readScope, error: null, loading: false });
  const persistenceError = accountScopedValue(persistenceStatus.userId, readScope, persistenceStatus.error, null);
  const persistedMintzLoading = accountScopedValue(persistenceStatus.userId, readScope, persistenceStatus.loading, uuidPattern.test(currentUserId));
  const persistedAuthors = accountScopedValue(feedOwnerId, readScope, rawPersistedAuthors, []);
  // Hide the prior account's feed during render, before effect cleanup runs.
  // This includes private poll choices present on otherwise public Mintz.
  const storedMintz = useMemo(() => accountScopedValue(feedOwnerId, readScope, rawStoredMintz, previewUniversityId ? [] : rawStoredMintz.filter((mint) => mint.isDevelopment)), [feedOwnerId, readScope, rawStoredMintz, previewUniversityId]);
  const feedRequestScope = useRef(createAccountRequestScope(readScope));
  useLayoutEffect(() => {
    const scope = feedRequestScope.current;
    activateAccountRequestScope(scope, readScope);
    return () => activateAccountRequestScope(scope, "");
  }, [readScope]);
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
  const [draftState, setDraftState] = useState<{ userId: string; drafts: MintDraft[] }>({ userId: "", drafts: [] });
  const draftLoadRef = useRef<{ userId: string; promise: Promise<MintDraft[]> } | null>(null);
  const drafts = draftState.userId === currentUserId ? draftState.drafts : [];

  useEffect(() => {
    let cancelled = false;
    const promise = (async () => {
      try {
        let stored = await listStoredMintDrafts(currentUserId);
        const legacy = readLegacyDrafts(currentUserId).filter((draft) => !stored.some((item) => item.id === draft.id));
        for (const draft of legacy) {
          try { await storeMintDraft(draft, []); } catch {
            // A full device must not hide drafts already read successfully.
            // Legacy text stays available in this list for a later retry.
          }
        }
        stored = [...stored, ...legacy].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return stored;
      } catch {
        return readLegacyDrafts(currentUserId);
      }
    })();
    draftLoadRef.current = { userId: currentUserId, promise };
    void promise.then((stored) => {
      if (!cancelled) setDraftState({ userId: currentUserId, drafts: stored });
    });
    return () => { cancelled = true; };
  }, [currentUserId]);

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

  const loadPersistedMintz = useCallback(async () => {
    if (!uuidPattern.test(currentUserId)) return;
    const request = beginAccountRequest(feedRequestScope.current, readScope);
    if (!request) return;
    setPersistenceStatus({ userId: readScope, loading: true, error: null });
    try {
      const query = previewUniversityId ? `?universityId=${encodeURIComponent(previewUniversityId)}` : "";
      const response = await fetch(`/api/mintz${query}`, { cache: "no-store", signal: request.signal });
      const result = await response.json().catch(() => null) as MintFeedResponse | null;
      if (!request.isCurrent()) return;
      if (!response.ok || !result?.ok) {
        throw new Error(result && !result.ok ? result.message : "Mintz are temporarily unavailable.");
      }
      setStoredMintz((current) => {
        const persistedIds = new Set(result.mintz.map((mint) => mint.id));
        return [...result.mintz, ...current.filter((mint) => !previewUniversityId && mint.isDevelopment && !persistedIds.has(mint.id))];
      });
      setPersistedAuthors(result.authors);
      setFeedOwnerId(readScope);
      setFeedRevision((revision) => revision + 1);
      setPersistenceStatus({ userId: readScope, loading: false, error: null });
    } catch (error) {
      if (request.isCurrent()) setPersistenceStatus({ userId: readScope, loading: false, error: error instanceof Error ? error.message : "Mintz are temporarily unavailable." });
    }
  }, [currentUserId, readScope, previewUniversityId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadPersistedMintz(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPersistedMintz]);

  function refreshMintz() {
    setCurrentTime(Date.now());
    // Fixture releases are immediate. Real feeds advance only after their new
    // rows arrive, so one refresh includes the records it actually fetched.
    if (!uuidPattern.test(currentUserId)) setRefreshGeneration((current) => current + 1);
    void loadPersistedMintz();
  }

  async function saveDraft(input: MintDraftInput, media: readonly LocalMintMediaSelection[] = []) {
    // Complete migration first: a late hydration result must not overwrite a
    // freshly saved draft, or restore legacy metadata over its attached files.
    const initialDrafts = draftLoadRef.current?.userId === currentUserId ? await draftLoadRef.current.promise : [];
    const saved = upsertMintDraft(draftState.userId === currentUserId ? drafts : initialDrafts, currentUserId, input)[0];
    await storeMintDraft(saved, media);
    setDraftState((current) => draftLoadRef.current?.userId !== currentUserId ? current : ({ userId: currentUserId, drafts: [saved, ...(current.userId === currentUserId ? current.drafts : initialDrafts).filter((draft) => draft.id !== saved.id)] }));
    return saved;
  }

  async function deleteDraft(draftId: string) {
    if (draftLoadRef.current?.userId === currentUserId) await draftLoadRef.current.promise;
    await deleteStoredMintDraft(currentUserId, draftId);
    // Remove migrated metadata too, so a deleted legacy draft cannot reappear.
    try {
      const legacy = readLegacyDrafts(currentUserId);
      window.localStorage.setItem(`campusmint:mint-drafts:${currentUserId}:v1`, JSON.stringify(removeMintDraft(legacy, draftId)));
    } catch {
      // IndexedDB deletion succeeded; blocked legacy storage must not leave a
      // phantom row visible or turn a completed publication into a failure.
    }
    setDraftState((current) => current.userId === currentUserId ? { ...current, drafts: removeMintDraft(current.drafts, draftId) } : current);
  }

  const mintz = useMemo(() => storedMintz
    .filter((mint) => (mint.developmentFeedGeneration ?? 0) <= refreshGeneration)
    .map((mint) => ({
      ...mint,
      status: resolveContentStatus(mint.status, mint.expiresAt, currentTime),
    })), [currentTime, refreshGeneration, storedMintz]);

  function createLocalMint(input: CreateMintInput) {
    const now = new Date().toISOString();
    const mint: Mint = {
      ...input,
      poll: input.poll ? emptyPoll(input.poll) : null,
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
    setFeedRevision((revision) => revision + 1);
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

  async function createMint(
    input: CreateMintInput,
    selections: readonly LocalMintMediaSelection[] = [],
    requestId = globalThis.crypto.randomUUID(),
  ) {
    if (previewUniversityId) return { ok: false as const, message: "Exit campus preview to post from your own account.", retryable: false };
    if (input.isDevelopment) {
      return { ok: true as const, mint: createLocalMint(input), message: null };
    }

    const payload = {
      requestId,
      caption: input.caption,
      poll: input.poll ?? null,
      postType: input.postType,
      privacy: input.privacy,
      expiresAt: input.expiresAt,
      commentsEnabled: input.commentsEnabled,
      location: input.location,
      eventData: input.eventData,
      organizationId: input.organizationId ?? null,
      taggedOrganizationIds: input.taggedOrganizationIds ?? [],
      organizationAudience: input.organizationAudience ?? "public",
      hashtags: input.hashtags,
      mentions: input.mentions,
      taggedUserIds: input.taggedUserIds,
      music: input.music,
      mediaMetadata: selections.map((selection) => ({
        width: selection.media.width,
        height: selection.media.height,
        durationSeconds: selection.media.durationSeconds,
      })),
    };

    try {
      const result = await publishMint(payload, selections.map((selection) => selection.file), (destination, file) =>
        createSupabaseBrowserClient().storage.from("mint-media").uploadToSignedUrl(destination.storagePath, destination.token, file, {
          contentType: file.type,
          cacheControl: "31536000",
        }),
      );
      if (!result.ok) {
        return {
          ok: false as const,
          message: result.message,
          retryable: result.retryable,
        };
      }
      if (feedRequestScope.current.accountId === readScope && result.author.account.id === currentUserId) {
        // A feed request started before this publish must not replace the
        // newly confirmed post with an older snapshot when it arrives late.
        activateAccountRequestScope(feedRequestScope.current, readScope);
        setStoredMintz((current) => [result.mint, ...current.filter((mint) => (feedOwnerId === readScope || mint.isDevelopment) && mint.id !== result.mint.id)]);
        setPersistedAuthors((current) => [result.author, ...current.filter((author) => feedOwnerId === readScope && author.account.id !== result.author.account.id)]);
        setFeedOwnerId(readScope);
        setFeedRevision((revision) => revision + 1);
        setPersistenceStatus({ userId: readScope, loading: false, error: null });
      }
      return { ok: true as const, mint: result.mint, message: null };
    } catch {
      return {
        ok: false as const,
        message: "The network interrupted publishing. Your draft is still here—try again.",
        retryable: true,
      };
    }
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
      parentCommentId: structured.parentCommentId ?? null,
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
    feedRevision,
    shares,
    reports,
    pendingNotifications,
    drafts,
    persistedAuthors,
    persistedMintzLoading,
    persistenceError,
    refreshMintz,
    createMint,
    saveDraft,
    deleteDraft,
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
