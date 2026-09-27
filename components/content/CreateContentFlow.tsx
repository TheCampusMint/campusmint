"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";

import { CloseButton } from "@/components/ui/CloseButton";
import { sampleEvents } from "@/data/events";
import { developmentOrganizations } from "@/data/organizations";
import { areDevelopmentFixturesEnabled } from "@/lib/runtime/fixturePolicy";
import { developmentBuildings } from "@/data/development/campusData";
import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import {
  getAccountConfiguredUniversityId,
  getAccountUniversityTheme,
  type UniversityTheme,
} from "@/data/universities";
import {
  createExpiresAt,
  EVENT_CONTENT_DURATION_HOURS,
  MAX_PERSONAL_MINT_DURATION_HOURS,
  personalMintDurationOptions,
} from "@/lib/content/expiration";
import { extractHashtagsFromCaption } from "@/lib/content/hashtags";
import {
  extractMentionsFromCaption,
  getActiveMentionQuery,
  insertMentionAtCaret,
} from "@/lib/content/mentions";
import { zonedDateTimeToIso } from "@/lib/content/eventTiming";
import {
  getMintContentType,
  prepareLocalMintMedia,
  type LocalMintMediaSelection,
} from "@/lib/content/localMintMedia";
import { canPostAsOrganization } from "@/lib/organizationPermissions";
import type { MintDraft, MintDraftInput } from "@/lib/content/mintDrafts";
import { restoreMintDraftMedia } from "@/lib/content/mintDraftStore";
import { useModalLayer } from "@/hooks/useModalLayer";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { motion } from "@/lib/motion/interaction";
import type {
  ContentLocation,
  EventContentData,
  SocialContentPrivacy,
  SocialPostType,
  OrganizationContentAudience,
} from "@/types/content";
import type { OrganizationMembership, OrganizationRoleAssignment } from "@/types/organization";
import type { CreateMintInput } from "@/types/mint";
import type { CampusMintUser } from "@/types/profile";

type CreateContentFlowProps = {
  viewer: CampusMintUser;
  users: CampusMintUser[];
  theme: UniversityTheme;
  onCreateMint: (
    input: CreateMintInput,
    media: readonly LocalMintMediaSelection[],
    requestId: string,
  ) => Promise<{ ok: boolean; message: string | null }>;
  onClose: () => void;
  organizationMemberships: OrganizationMembership[];
  organizationRoles: OrganizationRoleAssignment[];
  defaultCommentsEnabled?: boolean;
  highQualityUploads?: boolean;
  selectedMedia?: LocalMintMediaSelection[];
  mediaError?: string | null;
  mediaPreparing?: boolean;
  onChooseMedia?: () => void;
  onClearMedia?: () => void;
  onRestoreMedia?: (media: LocalMintMediaSelection[]) => void;
  drafts?: MintDraft[];
  onSaveDraft?: (input: MintDraftInput, media: readonly LocalMintMediaSelection[]) => Promise<MintDraft>;
  onDeleteDraft?: (draftId: string) => Promise<void>;
};

const fieldClass = "mt-1 min-w-0 max-w-full w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 py-2.5 text-base text-[var(--app-text-primary)] placeholder:text-[var(--app-text-secondary)] outline-none transition focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-accent)]/30 sm:text-sm";

export function CreateContentFlow({ viewer, users, theme, onCreateMint, onClose, organizationMemberships, organizationRoles, defaultCommentsEnabled = true, highQualityUploads = false, selectedMedia, mediaError, mediaPreparing = false, onChooseMedia, onClearMedia, onRestoreMedia, drafts = [], onSaveDraft, onDeleteDraft }: CreateContentFlowProps) {
  const internalFileInputRef = useRef<HTMLInputElement>(null);
  const captionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const publishRequestIdRef = useRef(globalThis.crypto.randomUUID());
  const reducedMotion = useReducedMotion();
  const [closing, setClosing] = useState(false);
  const [internalMedia, setInternalMedia] = useState<LocalMintMediaSelection[]>([]);
  const [internalMediaError, setInternalMediaError] = useState<string | null>(null);
  const [internalMediaPreparing, setInternalMediaPreparing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [postType, setPostType] = useState<SocialPostType>("personal");
  const [caption, setCaption] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [commentsEnabled, setCommentsEnabled] = useState(defaultCommentsEnabled);
  const [privacy, setPrivacy] = useState<SocialContentPrivacy>("account");
  const [durationHours, setDurationHours] = useState<string>("permanent");
  const [locationChoice, setLocationChoice] = useState("none");
  const [customLocation, setCustomLocation] = useState("");
  const [existingEventId, setExistingEventId] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventLocationDetails, setEventLocationDetails] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [taggedOrganizationId, setTaggedOrganizationId] = useState("");
  const [organizationAudience, setOrganizationAudience] = useState<OrganizationContentAudience>("public");
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(undefined);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const restoredUrlsRef = useRef<string[]>([]);

  const requestClose = useCallback(() => {
    if (closing || submitting || draftBusy) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(
      onClose,
      reducedMotion ? 0 : motion.duration.fast,
    );
  }, [closing, onClose, reducedMotion, submitting, draftBusy]);

  const closeAfterPublish = useCallback(() => {
    setClosing(true);
    closeTimerRef.current = window.setTimeout(
      onClose,
      reducedMotion ? 0 : motion.duration.fast,
    );
  }, [onClose, reducedMotion]);

  useModalLayer(dialogRef, requestClose);

  useEffect(() => () => {
    restoredUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, []);
  const controlledMedia = selectedMedia !== undefined;
  const activeMedia = controlledMedia ? selectedMedia : internalMedia;
  const activeMediaError = controlledMedia ? mediaError : internalMediaError;
  const activeMediaPreparing = controlledMedia
    ? mediaPreparing
    : internalMediaPreparing;
  const media = activeMedia.map((item) => item.media);
  const contentType = getMintContentType(media);
  const configuredUniversityId =
    getAccountConfiguredUniversityId(
      viewer.account,
    );

  const network = configuredUniversityId
    ? getCampusNetworkForUniversity(
        configuredUniversityId,
      )
    : null;

  const availableEvents = sampleEvents.filter(
    (event) =>
      theme.accessibleCampuses.includes(
        event.campus,
      ),
  );

  const availableBuildings =
    configuredUniversityId
      ? developmentBuildings.filter(
          (building) =>
            building.universityId ===
            configuredUniversityId,
        )
      : [];

  const organizationActor =
    configuredUniversityId
      ? {
          id: viewer.account.id,
          universityId:
            configuredUniversityId,
        }
      : null;

  const availableOrganizations =
    configuredUniversityId
      ? (areDevelopmentFixturesEnabled() ? developmentOrganizations : []).filter(
          (organization) =>
            organization.universityId ===
            configuredUniversityId,
        )
      : [];

  const postableOrganizations =
    organizationActor
      ? availableOrganizations.filter(
          (organization) =>
            canPostAsOrganization(
              organizationActor,
              organization,
              organizationMemberships,
              organizationRoles,
            ),
        )
      : [];
  const selectedOrganization = postableOrganizations.find((organization) => organization.id === selectedOrganizationId) ?? null;

  const mentionMatches = useMemo(
    () => extractMentionsFromCaption(caption, users),
    [caption, users],
  );
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return users
      .filter(
        (candidate) =>
          candidate.account.id !== viewer.account.id &&
          (candidate.profile.usernameNormalized.startsWith(mentionQuery) ||
            candidate.profile.displayName.toLocaleLowerCase().includes(mentionQuery)),
      )
      .slice(0, 5);
  }, [mentionQuery, users, viewer.account.id]);

  function resolvedLocation(): ContentLocation | null {
    if (locationChoice === "custom" && customLocation.trim()) return { source: "custom", entityId: null, label: customLocation.trim(), details: null };
    const building = availableBuildings.find((candidate) => candidate.id === locationChoice);
    return building ? { source: "campus_entity", entityId: building.id, label: building.name, details: null } : null;
  }

  function resolvedEventData(): EventContentData | null {
    if (postType !== "event") return null;
    const eventTimeZone =
      getAccountUniversityTheme(
        viewer.account,
      )?.timeZone ??
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ??
      "UTC";
    if (existingEventId) return { eventId: existingEventId, title: null, eventStartAt: null, eventEndAt: null, timeZone: eventTimeZone, location: null, locationDetails: null, description: null };
    const customEventLocation = eventLocation.trim() ? { source: "custom" as const, entityId: null, label: eventLocation.trim(), details: eventLocationDetails.trim() || null } : null;
    const eventStartAt = eventDate && eventStartTime ? zonedDateTimeToIso(eventDate, eventStartTime, eventTimeZone) : null;
    let eventEndAt = eventDate && eventEndTime ? zonedDateTimeToIso(eventDate, eventEndTime, eventTimeZone) : null;
    if (eventStartAt && eventEndAt && new Date(eventEndAt).getTime() <= new Date(eventStartAt).getTime()) {
      const [year, month, day] = eventDate.split("-").map(Number);
      const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
      eventEndAt = zonedDateTimeToIso(nextDate, eventEndTime, eventTimeZone);
    }
    return {
      eventId: null,
      title: eventTitle.trim() || null,
      eventStartAt,
      eventEndAt,
      timeZone: eventTimeZone,
      location: customEventLocation,
      locationDetails: eventLocationDetails.trim() || null,
      description: eventDescription.trim() || null,
    };
  }

  function chooseMedia() {
    setSubmitError(null);

    if (onChooseMedia) {
      onChooseMedia();
      return;
    }

    const input = internalFileInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }

  async function selectInternalMedia(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length === 0) return;

    setInternalMediaPreparing(true);
    setInternalMediaError(null);
    const prepared = await prepareLocalMintMedia(files, highQualityUploads);
    setInternalMedia(prepared.accepted);
    setInternalMediaPreparing(false);

    if (prepared.rejectedFileNames.length > 0) {
      setInternalMediaError(
        `${prepared.rejectedFileNames.length} unsupported or unreadable file${prepared.rejectedFileNames.length === 1 ? " was" : "s were"} skipped.`,
      );
    }
  }

  function clearMedia() {
    setSubmitError(null);

    if (controlledMedia) {
      onClearMedia?.();
      return;
    }

    setInternalMedia([]);
    setInternalMediaError(null);
  }

  async function openDraft(draft: MintDraft) {
    if (draftBusy || submitting || activeMediaPreparing) return;
    setDraftBusy(true);
    let restored: LocalMintMediaSelection[];
    try {
      restored = await restoreMintDraftMedia(viewer.account.id, draft.id);
    } catch {
      setSubmitError("This draft could not be opened. Try again without closing the composer.");
      setDraftBusy(false);
      return;
    }
    restoredUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    restoredUrlsRef.current = restored.flatMap((item) => item.media.url ? [item.media.url] : []);
    if (controlledMedia) onRestoreMedia?.(restored);
    else setInternalMedia(restored);
    publishRequestIdRef.current = draft.publishRequestId ?? globalThis.crypto.randomUUID();
    setActiveDraftId(draft.id);
    setCaption(draft.caption);
    setPostType(draft.postType);
    setCommentsEnabled(draft.commentsEnabled);
    setPrivacy(draft.privacy);
    setDurationHours(draft.durationHours);
    setLocationChoice(draft.locationChoice);
    setCustomLocation(draft.customLocation);
    setExistingEventId(draft.existingEventId);
    setEventTitle(draft.eventTitle);
    setEventDate(draft.eventDate);
    setEventStartTime(draft.eventStartTime);
    setEventEndTime(draft.eventEndTime);
    setEventLocation(draft.eventLocation);
    setEventLocationDetails(draft.eventLocationDetails);
    setEventDescription(draft.eventDescription);
    setSelectedOrganizationId(draft.selectedOrganizationId);
    setTaggedOrganizationId(draft.taggedOrganizationId);
    setOrganizationAudience(draft.organizationAudience);
    setMentionQuery(null);
    setSubmitError(null);
    setDraftsOpen(false);
    setDraftNotice(draft.mediaCount > restored.length
      ? `This older draft saved file names only. Reselect ${draft.mediaFileNames.join(", ") || "your media"} before publishing.`
      : "Draft reopened.");
    setDraftBusy(false);
  }

  async function saveCurrentDraft() {
    if (!onSaveDraft || draftBusy || activeMediaPreparing) return false;
    const hasContent = Boolean(
      caption.trim() ||
      activeMedia.length > 0 ||
      eventTitle.trim() ||
      eventDescription.trim() ||
      existingEventId,
    );
    if (!hasContent) {
      setSubmitError("Add text, an event detail, or media before saving a draft.");
      return false;
    }
    setDraftBusy(true);
    try {
    const saved = await onSaveDraft({
      id: activeDraftId,
      publishRequestId: publishRequestIdRef.current,
      caption,
      postType,
      commentsEnabled,
      privacy,
      durationHours,
      locationChoice,
      customLocation,
      existingEventId,
      eventTitle,
      eventDate,
      eventStartTime,
      eventEndTime,
      eventLocation,
      eventLocationDetails,
      eventDescription,
      selectedOrganizationId,
      taggedOrganizationId,
      organizationAudience,
      mediaFileNames: activeMedia.map((item) => item.fileName),
      mediaCount: activeMedia.length,
    }, activeMedia);
    setActiveDraftId(saved.id);
    setSubmitError(null);
    setDraftNotice("Draft and media saved on this device for your account.");
    return true;
    } catch {
      setSubmitError("Your draft could not be saved on this device. Free some storage and retry; your work is still open.");
      return false;
    } finally {
      setDraftBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting || draftBusy) return;
    setSubmitError(null);

    const hasEventDetails =
      postType === "event" &&
      Boolean(
        existingEventId ||
          eventTitle.trim() ||
          eventDescription.trim(),
      );

    if (media.length === 0 && !caption.trim() && !hasEventDetails) {
      setSubmitError("Add text or choose a photo or video before publishing.");
      return;
    }

    if (postType === "club" && !selectedOrganization) {
      setSubmitError("Choose a club you are allowed to publish for.");
      return;
    }
    const now = new Date().toISOString();
    const selectedDuration = postType === "event"
      ? EVENT_CONTENT_DURATION_HOURS
      : durationHours === "permanent" ? null : Number(durationHours);
    const expiresAt = createExpiresAt(
      now,
      selectedDuration,
      MAX_PERSONAL_MINT_DURATION_HOURS,
    );
    const eventData = resolvedEventData();
    const location =
      postType === "event"
        ? eventData?.location ?? null
        : postType === "club"
          ? resolvedLocation()
          : null;

    setSubmitting(true);
    const result = await onCreateMint({
      publishFormat: "mint",
      authorId: viewer.account.id,

      // Legacy value remains required while older campus
      // models are migrated. Do not use it to infer that a
      // provisional .edu account belongs to that campus.
      universityId:
        configuredUniversityId ??
        viewer.account.universityId,

      universityIdentityId:
        viewer.account.universityIdentityId ??
        null,

      knownUniversityId:
        configuredUniversityId,

      campusNetworkId:
        network?.id ?? "universal",

      contentType,
      postType,
      media,
      caption: caption.trim(),
      hashtags: extractHashtagsFromCaption(caption),
      mentions: mentionMatches,
      taggedUserIds: [],
      location,
      music: null,
      expiresAt,
      commentsEnabled,
      // Retained only for old stored records; traditional Like totals are not public.
      likesVisible: false,
      eventData,
      organizationId:
        postType === "club" ? selectedOrganization?.id ?? null : null,
      taggedOrganizationIds: postType !== "club" && taggedOrganizationId ? [taggedOrganizationId] : [],
      organizationAudience: postType === "club" ? organizationAudience : "public",
      privacy,
      isDevelopment: viewer.account.isDevelopment,
    }, activeMedia, publishRequestIdRef.current);
    setSubmitting(false);
    if (!result.ok) {
      // Keep a durable copy when the server rejects or interrupts a publish;
      // the composer preview is not itself a persisted draft.
      const draftSaved = await saveCurrentDraft();
      const publishError = result.message ?? "We couldn't publish your Mint. Your draft is still here—try again.";
      setSubmitError(draftSaved || !onSaveDraft ? publishError : `${publishError} This device could not save a backup draft. Keep the composer open and retry.`);
      return;
    }
    if (activeDraftId) {
      try { await onDeleteDraft?.(activeDraftId); } catch {
        // The post is already saved remotely. A device cleanup error must not
        // turn a successful publish into another publish attempt.
      }
      setActiveDraftId(undefined);
    }
    closeAfterPublish();
  }

  const personalDurationOptions = personalMintDurationOptions.map((option) => ({
    hours: option.hours === null ? "permanent" : String(option.hours),
    label: option.label,
  }));

  return createPortal(
    <div
      className={`cm-overlay-backdrop fixed inset-0 z-[90] flex items-end justify-center overflow-hidden bg-slate-950/55 sm:items-center sm:p-6 ${
        closing ? "is-closing" : ""
      }`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className={`cm-panel-sheet cm-create-composer mx-auto max-h-[calc(100dvh-0.35rem)] w-full min-w-0 max-w-xl overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-[2rem] bg-[var(--app-surface)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 text-[var(--app-text-primary)] shadow-none sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-2xl sm:p-7 ${
          closing ? "is-closing" : ""
        }`}
        style={{ WebkitOverflowScrolling: "touch" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-content-title"
      >
        <div className="sticky -top-5 z-30 -mx-4 -mt-5 flex items-start justify-between gap-4 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 pb-3 pt-5 sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: theme.primary }}>
              {viewer.account.isDevelopment ? "Local development flow" : "Campus Mint publishing"}
            </p>
            <h2 id="create-content-title" className="mt-1 text-xl font-black sm:text-2xl">
              Create Mint
            </h2>
          </div>
          <CloseButton
            onClick={requestClose}
            data-initial-focus
            label="Close Create Mint"
          />
        </div>

        <section className="mt-5 rounded-2xl bg-[var(--app-surface-elevated)] p-3" aria-labelledby="mint-drafts-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 id="mint-drafts-title" className="text-sm font-black text-[var(--app-text-primary)]">Drafts</h3>
              <p className="mt-0.5 text-xs text-[var(--app-text-secondary)]">Saved on this device, including photos and videos.</p>
            </div>
            <button
              type="button"
              onClick={() => setDraftsOpen((current) => !current)}
              aria-expanded={draftsOpen}
              className="rounded-full px-3 py-2 text-xs font-black text-[var(--app-text-primary)] hover:bg-[var(--app-accent-soft)]"
            >
              {draftsOpen ? "Hide" : `View ${drafts.length || ""} drafts`.replace("  ", " ")}
            </button>
          </div>
          {draftsOpen && (
            <div className="mt-3 space-y-2" role="list">
              {drafts.length === 0 ? (
                <p className="rounded-xl bg-[var(--app-surface)] px-3 py-3 text-xs text-[var(--app-text-secondary)]">No saved drafts yet.</p>
              ) : drafts.map((draft) => (
                <div key={draft.id} role="listitem" className="flex items-center gap-3 rounded-xl bg-[var(--app-surface)] px-3 py-2.5">
                  <button type="button" disabled={draftBusy || submitting || activeMediaPreparing} onClick={() => void openDraft(draft)} className="min-w-0 flex-1 text-left disabled:opacity-50">
                    <span className="block truncate text-sm font-bold text-[var(--app-text-primary)]">
                      {draft.caption.trim() || (draft.postType === "event" ? draft.eventTitle.trim() : "Untitled draft")}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[var(--app-text-secondary)]">
                      {new Date(draft.updatedAt).toLocaleDateString()} · {draft.mediaCount > 0 ? `${draft.mediaCount} media item${draft.mediaCount === 1 ? "" : "s"}` : "Text"}
                    </span>
                  </button>
                  {onDeleteDraft && (
                    <button
                      type="button"
                      disabled={draftBusy || submitting}
                      onClick={async () => {
                        setDraftBusy(true);
                        try {
                          await onDeleteDraft(draft.id);
                          if (activeDraftId === draft.id) setActiveDraftId(undefined);
                        } catch { setSubmitError("This draft could not be deleted. Try again."); }
                        finally { setDraftBusy(false); }
                      }}
                      className="rounded-full px-2 py-1 text-xs font-bold text-[var(--app-text-secondary)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-text-primary)]"
                      aria-label={`Delete ${draft.caption.trim() || "untitled"} draft`}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {draftNotice && (
          <p role="status" className="mt-3 rounded-xl bg-[var(--app-surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--app-text-secondary)]">
            {draftNotice}
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-6">
          <fieldset className="rounded-2xl bg-[var(--app-surface-elevated)] p-4 sm:p-5">
            <legend className="px-2 text-sm font-black text-[var(--app-text-primary)]">
              Media
            </legend>
            <input
              ref={internalFileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={selectInternalMedia}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--app-text-primary)]">
                  {activeMediaPreparing
                    ? "Preparing your selection…"
                    : activeMedia.length > 0
                      ? `${activeMedia.length} media item${activeMedia.length === 1 ? "" : "s"} selected`
                      : "Text-only Mint"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">
                  {viewer.account.isDevelopment
                    ? "Development accounts keep media in this browser session."
                    : "Photos are optimized before upload. Your Mint is saved before this composer closes."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {activeMedia.length > 0 && (
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="rounded-full px-3 py-2 text-xs font-bold text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
                  >
                    Use text only
                  </button>
                )}
                <button
                  type="button"
                  onClick={chooseMedia}
                  disabled={activeMediaPreparing}
                  className="rounded-full bg-[var(--app-surface)] px-4 py-2 text-xs font-black text-[var(--app-text-primary)]  disabled:cursor-wait disabled:opacity-60"
                >
                  {activeMedia.length > 0 ? "Replace media" : "Add photos or videos"}
                </button>
              </div>
            </div>

            {activeMedia.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {activeMedia.map((item) => (
                  <figure
                    key={item.media.id}
                    className="min-w-0 overflow-hidden rounded-xl bg-[var(--app-surface)]"
                  >
                    <div className="relative aspect-square overflow-hidden bg-slate-950">
                      {item.media.type === "image" ? (
                        <Image
                          src={item.media.url ?? ""}
                          alt={`Selected media preview: ${item.fileName}`}
                          fill
                          sizes="(max-width: 640px) 50vw, 14rem"
                          className="object-contain"
                          unoptimized
                        />
                      ) : (
                        <video
                          src={item.media.url ?? undefined}
                          controls
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-contain"
                        />
                      )}
                    </div>
                    <figcaption className="truncate px-2 py-1.5 text-[10px] font-semibold text-[var(--app-text-secondary)]">
                      {item.fileName}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}

            {activeMediaError && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-[var(--app-surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--app-danger)]"
              >
                {activeMediaError}
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="font-bold text-[var(--app-text-primary)]">Mint type</legend>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {(["personal", "event", "club"] as SocialPostType[]).map(
                (value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPostType(value)}
                    className="rounded-xl p-3 text-sm font-bold capitalize  sm:p-4"
                    style={{
                      borderColor:
                        postType === value
                          ? "var(--app-accent)"
                          : "var(--app-border)",
                      color:
                        postType === value
                          ? "var(--app-accent)"
                          : "var(--app-text-secondary)",
                      backgroundColor: postType === value ? "var(--app-accent-soft)" : "transparent",
                    }}
                  >
                    {value}
                  </button>
                ),
              )}
            </div>
          </fieldset>

          {postType === "event" && <fieldset className="cm-content-swap rounded-2xl bg-[var(--app-accent-soft)] p-5"><legend className="px-2 font-black uppercase tracking-wide text-[var(--app-accent)]">Event details · 24H</legend><label className="block text-sm font-bold text-[var(--app-text-primary)]">Existing Campus Mint Event<select value={existingEventId} onChange={(event) => setExistingEventId(event.target.value)} className={fieldClass}><option value="">Informal/custom event</option>{availableEvents.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{!existingEventId && <><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-[var(--app-text-primary)]">Event title<input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} className={fieldClass} /></label><label className="text-sm font-black uppercase text-[var(--app-text-primary)]">When · Date<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className={fieldClass} /></label><label className="text-sm font-black uppercase text-[var(--app-text-primary)]">When · Start time<input type="time" value={eventStartTime} onChange={(event) => setEventStartTime(event.target.value)} className={fieldClass} /></label><label className="text-sm font-bold text-[var(--app-text-primary)]">End time (optional)<input type="time" value={eventEndTime} onChange={(event) => setEventEndTime(event.target.value)} className={fieldClass} /></label><label className="text-sm font-black uppercase text-[var(--app-text-primary)]">Where<input value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} className={fieldClass} placeholder="Venue or general location" /></label><label className="text-sm font-bold text-[var(--app-text-primary)]">Location details<input value={eventLocationDetails} onChange={(event) => setEventLocationDetails(event.target.value)} className={fieldClass} /></label></div><label className="mt-4 block text-sm font-bold text-[var(--app-text-primary)]">Add details<textarea value={eventDescription} onChange={(event) => setEventDescription(event.target.value)} rows={3} className={fieldClass} /></label></>}</fieldset>}

          {postType === "club" && <fieldset className="cm-content-swap rounded-2xl bg-[var(--app-surface-elevated)] p-5"><legend className="px-2 font-black uppercase tracking-wide text-[var(--app-text-primary)]">Official club identity</legend>{postableOrganizations.length ? <><label className="block text-sm font-bold text-[var(--app-text-primary)]">Select Club<select required value={selectedOrganizationId} onChange={(event) => setSelectedOrganizationId(event.target.value)} className={fieldClass}><option value="">Choose an organization</option>{postableOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>{selectedOrganization && <p className="mt-3 rounded-xl bg-[var(--app-surface)] p-3 text-xs leading-5 text-[var(--app-text-secondary)]">Publishing as <span className="font-black text-[var(--app-text-primary)]">{selectedOrganization.name}</span>. The Mint stores only its organization ID.</p>}<label className="mt-4 block text-sm font-bold text-[var(--app-text-primary)]">Club content audience<select value={organizationAudience} onChange={(event) => setOrganizationAudience(event.target.value as OrganizationContentAudience)} className={fieldClass}><option value="public">Public club content</option><option value="members">Members only</option></select></label></> : <p className="rounded-xl bg-[var(--app-surface-elevated)] p-3 text-sm text-[var(--app-text-primary)]">You do not hold a leader, officer, or approved publishing role for a club at this university. Create Personal content and tag a club instead.</p>}</fieldset>}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="relative text-sm font-bold text-[var(--app-text-primary)] sm:col-span-2">
              Caption or text
              <textarea
                ref={captionTextareaRef}
                required={media.length === 0 && postType !== "event"}
                value={caption}
                onChange={(event) => {
                  setCaption(event.target.value);
                  setMentionQuery(
                    getActiveMentionQuery(
                      event.target.value,
                      event.target.selectionStart,
                    ),
                  );
                }}
                onSelect={(event) =>
                  setMentionQuery(
                    getActiveMentionQuery(
                      event.currentTarget.value,
                      event.currentTarget.selectionStart,
                    ),
                  )
                }
                rows={4}
                className={fieldClass}
                placeholder={
                  media.length === 0
                    ? "What do you want to share? Use #topics and @usernames inline."
                    : "Add a caption with #topics or @mentions (optional)"
                }
              />
              {mentionQuery !== null && mentionSuggestions.length > 0 && (
                <span className="absolute inset-x-0 top-full z-20 mt-1 block overflow-hidden rounded-2xl bg-[var(--app-surface-elevated)] p-1">
                  {mentionSuggestions.map((candidate) => (
                    <button
                      key={candidate.account.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        const caret = captionTextareaRef.current?.selectionStart ?? caption.length;
                        const nextCaption = insertMentionAtCaret(
                          caption,
                          caret,
                          candidate.profile.usernameNormalized,
                        );
                        setCaption(nextCaption);
                        setMentionQuery(null);
                        window.requestAnimationFrame(() => captionTextareaRef.current?.focus());
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-left text-xs hover:bg-[var(--app-accent-soft)]"
                    >
                      <strong>@{candidate.profile.username}</strong>
                      <span className="ml-2 font-normal text-[var(--app-text-secondary)]">
                        {candidate.profile.displayName}
                      </span>
                    </button>
                  ))}
                </span>
              )}
            </label>

            {postType === "club" && (
              <label className="text-sm font-bold text-[var(--app-text-primary)]">
                Location
                <select
                  value={locationChoice}
                  onChange={(event) => setLocationChoice(event.target.value)}
                  className={fieldClass}
                >
                  <option value="none">No location</option>
                  {availableBuildings.map((building) => (
                    <option key={building.id} value={building.id}>{building.name}</option>
                  ))}
                  <option value="custom">Other / Custom Location</option>
                </select>
              </label>
            )}
            {locationChoice === "custom" && postType === "club" && (
              <label className="text-sm font-bold text-[var(--app-text-primary)]">
                Custom location
                <input
                  value={customLocation}
                  onChange={(event) => setCustomLocation(event.target.value)}
                  className={fieldClass}
                />
              </label>
            )}
            {postType !== "club" && (
              <label className="text-sm font-bold text-[var(--app-text-primary)]">
                Tag a club (optional)
                <select
                  value={taggedOrganizationId}
                  onChange={(event) => setTaggedOrganizationId(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">No club tag</option>
                  {availableOrganizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>{organization.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-sm font-bold text-[var(--app-text-primary)]">
              Duration
              <select
                value={postType === "event" ? "24" : durationHours}
                disabled={postType === "event"}
                onChange={(event) => setDurationHours(event.target.value)}
                className={fieldClass}
              >
                {postType === "event" ? (
                  <option value="24">24 hours (Event default)</option>
                ) : (
                  personalDurationOptions.map((option) => (
                    <option key={option.hours} value={option.hours}>{option.label}</option>
                  ))
                )}
              </select>
            </label>
            <label className="text-sm font-bold text-[var(--app-text-primary)]">
              Mint privacy
              <select
                value={privacy}
                onChange={(event) => setPrivacy(event.target.value as SocialContentPrivacy)}
                className={fieldClass}
              >
                <option value="account">Use account privacy</option>
                <option value="public">Public across Campus Mint</option>
                <option value="connections">Connections only</option>
                <option value="private">Only me</option>
              </select>
            </label>
          </div>


          <div className="flex flex-wrap gap-5"><label className="text-sm font-semibold"><input type="checkbox" className="mr-2 accent-[var(--app-accent)]" checked={commentsEnabled} onChange={(event) => setCommentsEnabled(event.target.checked)} />Comments enabled</label></div>
          {submitError && <p role="alert" className="rounded-xl bg-[var(--app-surface-elevated)] p-3 text-sm font-semibold text-[var(--app-danger)]">{submitError}</p>}
          <div className="flex flex-wrap gap-3"><button type="button" onClick={requestClose} disabled={submitting || draftBusy} className="rounded-full px-4 py-3 text-sm font-bold disabled:cursor-wait disabled:opacity-50">Cancel</button>{onSaveDraft && <button type="button" onClick={() => void saveCurrentDraft()} disabled={submitting || activeMediaPreparing || draftBusy} className="rounded-full px-4 py-3 text-sm font-bold text-[var(--app-text-primary)] disabled:cursor-wait disabled:opacity-50">Save draft</button>}<button type="submit" disabled={submitting || activeMediaPreparing || draftBusy} className="min-w-32 flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60" style={{ backgroundColor: "var(--app-accent)", color: "var(--app-accent-contrast)" }}>{submitting ? "Publishing…" : submitError ? "Retry Publish" : "Publish Mint"}</button></div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
