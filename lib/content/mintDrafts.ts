import type {
  OrganizationContentAudience,
  SocialContentPrivacy,
  SocialPostType,
} from "@/types/content";

/** Composer metadata. File bytes are stored alongside this record in IndexedDB. */
export type MintDraftFields = {
  /** Preserve publication idempotency if the server saved a post but its response was lost. */
  publishRequestId?: string;
  caption: string;
  postType: SocialPostType;
  commentsEnabled: boolean;
  privacy: SocialContentPrivacy;
  durationHours: string;
  locationChoice: string;
  customLocation: string;
  existingEventId: string;
  eventTitle: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  eventLocation: string;
  eventLocationDetails: string;
  eventDescription: string;
  selectedOrganizationId: string;
  taggedOrganizationId: string;
  organizationAudience: OrganizationContentAudience;
  mediaFileNames: string[];
  mediaCount: number;
};

export type MintDraft = MintDraftFields & {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type MintDraftInput = Partial<Pick<MintDraft, "id">> & MintDraftFields;

const STORAGE_VERSION = 1;
const MAX_DRAFTS = 50;

export function mintDraftStorageKey(userId: string) {
  return `campusmint:mint-drafts:${userId}:v${STORAGE_VERSION}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function mediaNames(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 12)
    : [];
}

function normalizeDraft(value: unknown, userId: string): MintDraft | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const updatedAt = stringValue(value.updatedAt);
  if (!id || !updatedAt) return null;
  const names = mediaNames(value.mediaFileNames);
  return {
    id,
    userId,
    createdAt: stringValue(value.createdAt) || updatedAt,
    updatedAt,
    ...(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stringValue(value.publishRequestId)) ? { publishRequestId: stringValue(value.publishRequestId) } : {}),
    caption: stringValue(value.caption),
    postType: value.postType === "event" || value.postType === "club" ? value.postType : "personal",
    commentsEnabled: booleanValue(value.commentsEnabled, true),
    privacy: value.privacy === "public" || value.privacy === "connections" || value.privacy === "private" ? value.privacy : "account",
    durationHours: stringValue(value.durationHours) || "permanent",
    locationChoice: stringValue(value.locationChoice) || "none",
    customLocation: stringValue(value.customLocation),
    existingEventId: stringValue(value.existingEventId),
    eventTitle: stringValue(value.eventTitle),
    eventDate: stringValue(value.eventDate),
    eventStartTime: stringValue(value.eventStartTime),
    eventEndTime: stringValue(value.eventEndTime),
    eventLocation: stringValue(value.eventLocation),
    eventLocationDetails: stringValue(value.eventLocationDetails),
    eventDescription: stringValue(value.eventDescription),
    selectedOrganizationId: stringValue(value.selectedOrganizationId),
    taggedOrganizationId: stringValue(value.taggedOrganizationId),
    organizationAudience: value.organizationAudience === "members" ? "members" : "public",
    mediaFileNames: names,
    mediaCount: Number.isInteger(value.mediaCount) && Number(value.mediaCount) >= 0
      ? Math.min(Number(value.mediaCount), 12)
      : names.length,
  };
}

export function readMintDrafts(storage: Pick<Storage, "getItem"> | null, userId: string) {
  if (!storage || !userId) return [] as MintDraft[];
  try {
    const raw = storage.getItem(mintDraftStorageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    const values = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.drafts) ? parsed.drafts : [];
    return values
      .map((value) => normalizeDraft(value, userId))
      .filter((value): value is MintDraft => value !== null)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, MAX_DRAFTS);
  } catch {
    return [];
  }
}

export function writeMintDrafts(storage: Pick<Storage, "setItem"> | null, userId: string, drafts: MintDraft[]) {
  if (!storage || !userId) return;
  storage.setItem(mintDraftStorageKey(userId), JSON.stringify({ version: STORAGE_VERSION, drafts: drafts.slice(0, MAX_DRAFTS) }));
}

export function upsertMintDraft(drafts: MintDraft[], userId: string, input: MintDraftInput, now = new Date().toISOString()) {
  const existing = input.id ? drafts.find((draft) => draft.id === input.id) : undefined;
  const draft: MintDraft = {
    ...input,
    id: existing?.id ?? input.id ?? `draft-${globalThis.crypto.randomUUID()}`,
    userId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  return [draft, ...drafts.filter((candidate) => candidate.id !== draft.id)].slice(0, MAX_DRAFTS);
}

export function removeMintDraft(drafts: MintDraft[], draftId: string) {
  return drafts.filter((draft) => draft.id !== draftId);
}
