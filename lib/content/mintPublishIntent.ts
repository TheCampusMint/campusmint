import type { LocalMintMediaSelection } from "./localMintMedia";
import type { MintDraftFields } from "./mintDrafts";

/** Stable user intent: preview URLs and expiry timestamps change on a retry. */
export function mintPublishIntent(fields: MintDraftFields, media: readonly LocalMintMediaSelection[]) {
  const kind = fields.composerKind ?? (fields.postType === "event" ? "event" : "post");
  return JSON.stringify({
    caption: fields.caption.trim(), postType: fields.postType,
    poll: kind === "poll" ? { question: fields.pollQuestion?.trim() ?? "", options: (fields.pollOptions ?? []).map((option) => option.trim()).filter(Boolean) } : null,
    event: fields.existingEventId ? { id: fields.existingEventId } : fields.postType === "event" ? {
      title: fields.eventTitle.trim(), date: fields.eventDate, start: fields.eventStartTime, end: fields.eventEndTime,
      location: fields.eventLocation.trim(), details: fields.eventLocationDetails.trim(), description: fields.eventDescription.trim(),
    } : null,
    location: fields.postType === "event" ? null : { choice: fields.locationChoice, custom: fields.locationChoice === "custom" ? fields.customLocation.trim() : "" },
    privacy: fields.privacy, duration: fields.postType === "event" ? "24" : fields.durationHours,
    commentsEnabled: fields.commentsEnabled,
    organizationId: fields.postType === "club" ? fields.selectedOrganizationId : null,
    organizationAudience: fields.postType === "club" ? fields.organizationAudience : "public",
    taggedOrganizationId: fields.postType === "club" ? null : fields.taggedOrganizationId,
    // New picker selections receive new media IDs. IndexedDB keeps those IDs
    // when reopening, so changing a file rotates a request even if its name and
    // size match; simply recreating an object URL does not.
    media: media.map((item) => ({ id: item.media.id, name: item.file.name, size: item.file.size, type: item.file.type, lastModified: item.file.lastModified })),
  });
}

export function nextMintPublishAttempt(requestId: string, previousIntent: string | null, intent: string, newId: () => string = () => globalThis.crypto.randomUUID()) {
  return { requestId: previousIntent !== null && previousIntent !== intent ? newId() : requestId, intent };
}

export function restoreMintPublishAttempt(fields: Pick<MintDraftFields, "publishRequestId" | "publishIntent">, newId: () => string = () => globalThis.crypto.randomUUID()) {
  const knownAttempt = Boolean(fields.publishRequestId && fields.publishIntent);
  return {
    requestId: knownAttempt ? fields.publishRequestId! : newId(),
    intent: knownAttempt ? fields.publishIntent! : null,
    uncertainLegacyAttempt: Boolean(fields.publishRequestId && !fields.publishIntent),
  };
}
