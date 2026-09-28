import type { Mint, MintDwellRecord, MintPin, MintPrivateAppreciation, MintPublicEndorsement, MintSave } from "../../types/mint.ts";

export type MintFeedGeneration = {
  id: number;
  createdAt: string;
  refreshed: boolean;
  previousEligibleMintIds: string[];
  eligibleMintIds: string[];
  pinnedMintIds: string[];
  newMintIds: string[];
  oldMintIds: string[];
};

export const FEED_REFRESH_THRESHOLD_PX = 64;
export const MEANINGFUL_VISIBILITY_RATIO = 0.6;
export const MAX_DWELL_SESSION_MS = 120_000;

export function isFeedRefreshArmed(distance: number) {
  return distance >= FEED_REFRESH_THRESHOLD_PX;
}

export function migrateSavedMintzToPins(input: {
  saves?: readonly MintSave[];
  savedMintIds?: readonly string[];
  userId: string;
  fallbackPinnedAt: string;
}) {
  const pins = new Map<string, MintPin>();
  for (const save of input.saves ?? []) {
    if (save.userId !== input.userId) continue;
    pins.set(save.mintId, { id: `migrated-pin:${save.id}`, mintId: save.mintId, userId: save.userId, pinnedAt: save.createdAt });
  }
  for (const mintId of input.savedMintIds ?? []) {
    if (!pins.has(mintId)) pins.set(mintId, { id: `migrated-pin:${mintId}`, mintId, userId: input.userId, pinnedAt: input.fallbackPinnedAt });
  }
  return [...pins.values()];
}

export function accumulateMeaningfulDwell(record: MintDwellRecord | null, input: { mintId: string; userId: string; elapsedMs: number; meaningfulVisible: boolean; documentVisible: boolean; activeSurface: boolean; now: string }) {
  if (!input.meaningfulVisible || !input.documentVisible || !input.activeSurface || input.elapsedMs <= 0) return record;
  const elapsed = Math.min(MAX_DWELL_SESSION_MS, input.elapsedMs);
  return {
    mintId: input.mintId,
    userId: input.userId,
    totalMeaningfulDwellMs: (record?.totalMeaningfulDwellMs ?? 0) + elapsed,
    lastViewedAt: input.now,
    viewSessions: (record?.viewSessions ?? 0) + 1,
  };
}

export function normalizedDwellScore(milliseconds: number) {
  const cappedSeconds = Math.min(MAX_DWELL_SESSION_MS, Math.max(0, milliseconds)) / 1000;
  return Math.log2(1 + cappedSeconds) * 9;
}

export function scoreOldMintForViewer(input: { mint: Mint; dwellMs: number; privateAppreciated: boolean; publiclyEndorsed: boolean; networkBoost?: number }) {
  return normalizedDwellScore(input.dwellMs) + (input.privateAppreciated ? 38 : 0) + (input.publiclyEndorsed ? 54 : 0) + Math.max(0, input.networkBoost ?? 0);
}

export function resolveNetworkDiscoveryBoost(input: { connectedPositiveEngagements: number; attendingConnections?: number; recencyHours: number }) {
  return Math.min(60, Math.max(0, input.connectedPositiveEngagements) * 12 + Math.max(0, input.attendingConnections ?? 0) * 7) + Math.max(0, 12 - input.recencyHours / 6);
}

export function rankOldMintz(input: { mints: readonly Mint[]; viewerId: string; dwell: readonly MintDwellRecord[]; privateAppreciations: readonly MintPrivateAppreciation[]; publicEndorsements: readonly MintPublicEndorsement[]; networkBoosts?: Readonly<Record<string, number>> }) {
  const scores = new Map(input.mints.map((mint) => {
    const dwellMs = input.dwell.find((item) => item.mintId === mint.id && item.userId === input.viewerId)?.totalMeaningfulDwellMs ?? 0;
    return [mint.id, scoreOldMintForViewer({ mint, dwellMs, privateAppreciated: input.privateAppreciations.some((item) => item.mintId === mint.id && item.userId === input.viewerId), publiclyEndorsed: input.publicEndorsements.some((item) => item.mintId === mint.id && item.userId === input.viewerId), networkBoost: input.networkBoosts?.[mint.id] })];
  }));
  return [...input.mints].sort((first, second) => (scores.get(second.id) ?? 0) - (scores.get(first.id) ?? 0) || new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime() || first.id.localeCompare(second.id));
}

export function createFeedGeneration(input: { eligibleMintz: readonly Mint[]; previousEligibleMintIds: readonly string[] | null; pins: readonly MintPin[]; viewerId: string; dwell: readonly MintDwellRecord[]; privateAppreciations: readonly MintPrivateAppreciation[]; publicEndorsements: readonly MintPublicEndorsement[]; generationId: number; now: string }) {
  const eligibleById = new Map(input.eligibleMintz.map((mint) => [mint.id, mint]));
  const pins = input.pins.filter((pin) => pin.userId === input.viewerId && eligibleById.has(pin.mintId)).sort((a, b) => new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime() || a.mintId.localeCompare(b.mintId));
  const pinnedIds = new Set(pins.map((pin) => pin.mintId));
  const previous = input.previousEligibleMintIds ? new Set(input.previousEligibleMintIds) : null;
  const unpinned = input.eligibleMintz.filter((mint) => !pinnedIds.has(mint.id));
  const newMintz = previous ? unpinned.filter((mint) => !previous.has(mint.id)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.id.localeCompare(b.id)) : unpinned;
  const oldMintz = previous ? rankOldMintz({ mints: unpinned.filter((mint) => previous.has(mint.id)), viewerId: input.viewerId, dwell: input.dwell, privateAppreciations: input.privateAppreciations, publicEndorsements: input.publicEndorsements }) : [];
  return {
    id: input.generationId,
    createdAt: input.now,
    refreshed: previous !== null,
    previousEligibleMintIds: input.previousEligibleMintIds ? [...input.previousEligibleMintIds] : [],
    eligibleMintIds: input.eligibleMintz.map((mint) => mint.id),
    pinnedMintIds: pins.map((pin) => pin.mintId),
    newMintIds: newMintz.map((mint) => mint.id),
    oldMintIds: oldMintz.map((mint) => mint.id),
  } satisfies MintFeedGeneration;
}

export function flattenFeedGeneration(generation: MintFeedGeneration) {
  return [...generation.pinnedMintIds, ...generation.newMintIds, ...generation.oldMintIds];
}

export type MintFeedGenerationCursor = { feedScope: string; refreshGeneration: number; feedRevision: number };

/** Keep a finite session stable until a deliberate refresh, confirmed post, or loaded feed arrives. */
export function advanceFeedGeneration(
  state: { cursor: MintFeedGenerationCursor; generation: MintFeedGeneration },
  cursor: MintFeedGenerationCursor,
  input: Omit<Parameters<typeof createFeedGeneration>[0], "previousEligibleMintIds" | "generationId">,
) {
  if (state.cursor.feedScope === cursor.feedScope && state.cursor.refreshGeneration === cursor.refreshGeneration && state.cursor.feedRevision === cursor.feedRevision) return state;
  const sameScope = state.cursor.feedScope === cursor.feedScope;
  return { cursor, generation: createFeedGeneration({
    ...input,
    previousEligibleMintIds: sameScope ? state.generation.eligibleMintIds : null,
    generationId: sameScope ? state.generation.id + 1 : 0,
  }) };
}

export function applyCurrentPinsToGeneration(
  generation: MintFeedGeneration,
  pins: readonly MintPin[],
  viewerId: string,
) {
  const eligible = new Set(generation.eligibleMintIds);
  const pinnedMintIds = pins
    .filter((pin) => pin.userId === viewerId && eligible.has(pin.mintId))
    .sort((a, b) => new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime() || a.mintId.localeCompare(b.mintId))
    .map((pin) => pin.mintId);
  const pinned = new Set(pinnedMintIds);
  const previous = new Set(generation.previousEligibleMintIds);
  const newlyUnpinned = generation.pinnedMintIds.filter((id) => !pinned.has(id));
  return {
    ...generation,
    pinnedMintIds,
    newMintIds: [...generation.newMintIds.filter((id) => !pinned.has(id)), ...newlyUnpinned.filter((id) => !previous.has(id) && !generation.newMintIds.includes(id))],
    oldMintIds: [...generation.oldMintIds.filter((id) => !pinned.has(id)), ...newlyUnpinned.filter((id) => previous.has(id) && !generation.oldMintIds.includes(id))],
  };
}
