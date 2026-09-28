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
import { SearchableSelector } from "@/components/content/SearchableSelector";
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
import { mintPublishIntent, nextMintPublishAttempt, restoreMintPublishAttempt } from "@/lib/content/mintPublishIntent";
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

type ComposerKind = "post" | "poll" | "event";
type ComposerContext = {
  clubs: Array<{ id: string; name: string; canPublish: boolean }>;
  events: Array<{ id: string; title: string; startAt: string; location: string }>;
};

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

const fieldClass = "mt-1 min-w-0 max-w-full w-full rounded-2xl border-0 bg-[var(--app-surface-elevated)] px-3 py-2.5 text-base text-[var(--app-text-primary)] placeholder:text-[var(--app-text-secondary)] outline-none sm:text-sm";

export function CreateContentFlow({ viewer, users, theme, onCreateMint, onClose, organizationMemberships, organizationRoles, defaultCommentsEnabled = true, highQualityUploads = false, selectedMedia, mediaError, mediaPreparing = false, onChooseMedia, onClearMedia, onRestoreMedia, drafts = [], onSaveDraft, onDeleteDraft }: CreateContentFlowProps) {
  const internalFileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const captionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const publishRequestIdRef = useRef(globalThis.crypto.randomUUID());
  const attemptedIntentRef = useRef<string | null>(null);
  const reducedMotion = useReducedMotion();
  const [closing, setClosing] = useState(false);
  const [internalMedia, setInternalMedia] = useState<LocalMintMediaSelection[]>([]);
  const [internalMediaError, setInternalMediaError] = useState<string | null>(null);
  const [internalMediaPreparing, setInternalMediaPreparing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [postType, setPostType] = useState<SocialPostType>("personal");
  const [composerKind, setComposerKind] = useState<ComposerKind | null>(null);
  const [eventMode, setEventMode] = useState<"rollcall" | "host">("rollcall");
  const [moreOpen, setMoreOpen] = useState(false);
  const [contextKind, setContextKind] = useState<"club" | "event" | "location" | "settings" | null>(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [contextCatalog, setContextCatalog] = useState<ComposerContext | null>(null);
  const [contextError, setContextError] = useState(false);
  const [contextLoading, setContextLoading] = useState(!viewer.account.isDevelopment);
  const [contextAttempt, setContextAttempt] = useState(0);
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);
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
    if (closing || submitting || draftBusy || mediaPreparing || internalMediaPreparing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(
      onClose,
      reducedMotion ? 0 : motion.duration.fast,
    );
  }, [closing, onClose, reducedMotion, submitting, draftBusy, mediaPreparing, internalMediaPreparing]);

  const closeAfterPublish = useCallback(() => {
    setClosing(true);
    closeTimerRef.current = window.setTimeout(
      onClose,
      reducedMotion ? 0 : motion.duration.fast,
    );
  }, [onClose, reducedMotion]);

  useModalLayer(dialogRef, requestClose);

  useEffect(() => {
    const update = () => setViewport({ height: window.visualViewport?.height ?? window.innerHeight, top: window.visualViewport?.offsetTop ?? 0 });
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => { window.visualViewport?.removeEventListener("resize", update); window.visualViewport?.removeEventListener("scroll", update); };
  }, []);

  useEffect(() => {
    if (viewer.account.isDevelopment) return;
    const controller = new AbortController();
    fetch("/api/mintz/context", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("Context unavailable"); return response.json(); })
      .then((payload: ComposerContext & { ok?: boolean }) => { if (controller.signal.aborted) return; if (!payload.ok) throw new Error("Context unavailable"); setContextCatalog(payload); })
      .catch(() => { if (!controller.signal.aborted) setContextError(true); })
      .finally(() => { if (!controller.signal.aborted) setContextLoading(false); });
    return () => controller.abort();
  }, [viewer.account.id, viewer.account.isDevelopment, contextAttempt]);

  useEffect(() => () => {
    restoredUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, []);
  const controlledMedia = selectedMedia !== undefined;
  const activeMedia = controlledMedia ? selectedMedia : internalMedia;
  const activeMediaError = (controlledMedia ? mediaError : null) ?? internalMediaError;
  const activeMediaPreparing = controlledMedia
    ? mediaPreparing || internalMediaPreparing
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

  const availableEvents = viewer.account.isDevelopment ? sampleEvents.filter(
    (event) =>
      theme.accessibleCampuses.includes(
        event.campus,
      ),
  ).map((event) => ({ id: event.id, title: event.title, startAt: event.eventStartAt, location: event.location })) : contextCatalog?.events ?? [];

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

  const developmentClubs =
    configuredUniversityId && viewer.account.isDevelopment
      ? (areDevelopmentFixturesEnabled() ? developmentOrganizations : []).filter(
          (organization) =>
            organization.universityId ===
            configuredUniversityId,
        )
      : [];

  const availableOrganizations = viewer.account.isDevelopment
    ? developmentClubs.map((organization) => ({ id: organization.id, name: organization.name, canPublish: Boolean(organizationActor && canPostAsOrganization(organizationActor, organization, organizationMemberships, organizationRoles)) }))
    : contextCatalog?.clubs ?? [];
  const postableOrganizations = availableOrganizations.filter((organization) => organization.canPublish);
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
    if (postType !== "event" && !existingEventId) return null;
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
    if (controlledMedia) onRestoreMedia?.(prepared.accepted);
    else setInternalMedia(prepared.accepted);
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
    const attempt = restoreMintPublishAttempt(draft);
    publishRequestIdRef.current = attempt.requestId;
    attemptedIntentRef.current = attempt.intent;
    setActiveDraftId(draft.id);
    setCaption(draft.caption);
    setPostType(draft.postType);
    setComposerKind(draft.composerKind ?? (draft.postType === "event" ? "event" : "post"));
    setEventMode(draft.eventMode ?? (draft.postType === "event" && !draft.existingEventId ? "host" : "rollcall"));
    setPollQuestion(draft.pollQuestion ?? "");
    setPollOptions(draft.pollOptions ?? ["", ""]);
    setMoreOpen(false);
    setContextKind(draft.taggedOrganizationId ? "club" : draft.existingEventId ? "event" : null);
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
      : attempt.uncertainLegacyAttempt ? "Draft reopened. If an earlier posting attempt was interrupted, check your feed before posting again." : "Draft reopened.");
    setDraftBusy(false);
  }

  function currentDraftFields(): MintDraftInput {
    return {
      caption,
      postType,
      composerKind: composerKind ?? "post",
      eventMode,
      pollQuestion,
      pollOptions,
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
    };
  }

  async function saveCurrentDraft() {
    if (!onSaveDraft || draftBusy || activeMediaPreparing) return false;
    const hasContent = Boolean(
      caption.trim() ||
      activeMedia.length > 0 ||
      eventTitle.trim() ||
      eventDescription.trim() ||
      existingEventId || pollQuestion.trim(),
    );
    if (!hasContent) {
      setSubmitError("Add text, an event detail, or media before saving a draft.");
      return false;
    }
    setDraftBusy(true);
    try {
    const saved = await onSaveDraft({
      ...currentDraftFields(),
      id: activeDraftId,
      publishRequestId: attemptedIntentRef.current ? publishRequestIdRef.current : undefined,
      publishIntent: attemptedIntentRef.current ?? undefined,
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
    if (submitting || draftBusy || activeMediaPreparing || !composerKind) return;
    setSubmitError(null);

    const hasEventDetails = Boolean(existingEventId || (postType === "event" && (eventTitle.trim() || eventDescription.trim())));

    if (composerKind === "poll" && (!pollQuestion.trim() || pollOptions.filter((option) => option.trim()).length < 2)) {
      setSubmitError("Add a question and at least two choices.");
      return;
    }
    if (postType === "event" && !existingEventId && (!eventTitle.trim() || !eventDate || !eventStartTime || !eventLocation.trim())) {
      setSubmitError("Add your event title, date, time, and place.");
      return;
    }
    if (composerKind === "event" && eventMode === "rollcall" && !existingEventId) {
      setSubmitError("Choose the event for your roll call.");
      return;
    }
    if (composerKind !== "poll" && media.length === 0 && !caption.trim() && !hasEventDetails) {
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
        : resolvedLocation();

    const attempt = nextMintPublishAttempt(publishRequestIdRef.current, attemptedIntentRef.current, mintPublishIntent(currentDraftFields(), activeMedia));
    publishRequestIdRef.current = attempt.requestId;
    attemptedIntentRef.current = attempt.intent;
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
      poll: composerKind === "poll" ? { question: pollQuestion.trim(), options: pollOptions.map((option) => option.trim()).filter(Boolean) } : null,
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

  const busy = submitting || draftBusy || activeMediaPreparing;
  const ready = composerKind === "poll"
    ? Boolean(pollQuestion.trim() && pollOptions.filter((option) => option.trim()).length >= 2)
    : composerKind === "event" && eventMode === "host"
      ? Boolean(eventTitle.trim() && eventDate && eventStartTime && eventLocation.trim())
      : composerKind === "event"
        ? Boolean(existingEventId)
        : Boolean(caption.trim() || media.length || existingEventId);
  const clubOptions = availableOrganizations.map((club) => ({ id: club.id, label: club.name }));
  const eventOptions = availableEvents.map((event) => ({ id: event.id, label: event.title, detail: `${new Date(event.startAt).toLocaleDateString()} · ${event.location}` }));

  function chooseKind(kind: ComposerKind) {
    setComposerKind(kind);
    setDraftsOpen(false);
    setMoreOpen(false);
    setSubmitError(null);
    if (kind === "event" && eventMode === "host") setExistingEventId("");
    setPostType(kind === "event" && eventMode === "host" ? "event" : selectedOrganizationId && kind !== "event" ? "club" : "personal");
    if (kind === "event" && !caption.trim()) setCaption("Who’s going?");
    window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>("[data-composer-input]")?.focus());
  }

  return createPortal(
    <div className={`cm-overlay-backdrop fixed inset-x-0 top-0 z-[90] flex h-dvh items-center justify-center bg-black/45 p-3 sm:p-6 ${closing ? "is-closing" : ""}`}
      style={viewport ? { height: viewport.height, top: viewport.top } : undefined}
      role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="create-content-title"
        className={`cm-panel-sheet cm-create-composer flex max-h-full w-full min-w-0 max-w-lg flex-col overflow-hidden rounded-[1.75rem] bg-[var(--app-surface)] text-[var(--app-text-primary)] ${closing ? "is-closing" : ""}`}>
        <header className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-4">
          {composerKind && <button type="button" aria-label="Back to post types" disabled={busy} onClick={() => setComposerKind(null)} className="rounded-full py-2 pr-1 text-xl">←</button>}
          <h2 id="create-content-title" className="min-w-0 flex-1 text-lg font-bold">{draftsOpen ? "Drafts" : composerKind === "poll" ? "New poll" : composerKind === "event" ? "Share an event" : composerKind ? "New post" : "Create"}</h2>
          {!draftsOpen && <button type="button" disabled={busy} onClick={() => setDraftsOpen(true)} className="rounded-full px-2 py-2 text-xs font-semibold text-[var(--app-accent)]">Drafts{drafts.length > 0 ? ` (${drafts.length})` : ""}</button>}
          <CloseButton onClick={requestClose} data-initial-focus label="Close Create Mint" />
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-4" style={{ WebkitOverflowScrolling: "touch" }}>
          {draftsOpen ? <section aria-label="Saved drafts" className="space-y-2">
            <p className="mb-3 text-xs text-[var(--app-text-secondary)]">Saved on this device, including your photos and videos.</p>
            {drafts.length === 0 && <p className="py-6 text-sm text-[var(--app-text-secondary)]">No drafts yet.</p>}
            {drafts.map((draft) => <div key={draft.id} className="flex items-center gap-3 rounded-2xl bg-[var(--app-surface-elevated)] p-3">
              <button type="button" disabled={busy} onClick={() => void openDraft(draft)} className="min-w-0 flex-1 rounded-xl text-left">
                <span className="block truncate text-sm font-semibold">{draft.pollQuestion?.trim() || draft.caption.trim() || draft.eventTitle.trim() || "Untitled draft"}</span>
                <span className="text-xs text-[var(--app-text-secondary)]">{new Date(draft.updatedAt).toLocaleDateString()} · {draft.mediaCount ? `${draft.mediaCount} attachment${draft.mediaCount === 1 ? "" : "s"}` : "Text"}</span>
              </button>
              {onDeleteDraft && <button type="button" disabled={busy} aria-label={`Delete ${draft.caption.trim() || "untitled"} draft`} className="rounded-full p-2 text-xs text-[var(--app-text-secondary)]"
                onClick={async () => { setDraftBusy(true); try { await onDeleteDraft(draft.id); if (activeDraftId === draft.id) setActiveDraftId(undefined); } catch { setSubmitError("Couldn’t delete this draft. Try again."); } finally { setDraftBusy(false); } }}>Delete</button>}
            </div>)}
            <button type="button" onClick={() => setDraftsOpen(false)} className="rounded-full py-2 text-sm font-semibold text-[var(--app-accent)]">Back to composer</button>
          </section> : !composerKind ? <div className="space-y-1 pb-2">
            {([
              { id: "post", symbol: "Aa", label: "Post", detail: "A thought, a question, photos or video" },
              { id: "poll", symbol: "☷", label: "Poll", detail: "Let your campus weigh in" },
              { id: "event", symbol: "↗", label: "Event", detail: "See who’s going or plan something" },
            ] as const).map((choice) => <button key={choice.id} type="button" onClick={() => chooseKind(choice.id)} className="flex w-full items-center gap-4 rounded-2xl px-2 py-4 text-left hover:bg-[var(--app-accent-soft)]">
              <span aria-hidden="true" className="w-8 text-center text-xl font-semibold text-[var(--app-accent)]">{choice.symbol}</span>
              <span><strong className="block text-base">{choice.label}</strong><span className="block text-xs text-[var(--app-text-secondary)]">{choice.detail}</span></span>
            </button>)}
          </div> : <form id="mint-composer-form" onSubmit={submit}>
            <fieldset disabled={busy} className="min-w-0 space-y-4 disabled:pointer-events-none disabled:opacity-70">
            <legend className="sr-only">Post details</legend>
            <input ref={internalFileInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={(event) => void selectInternalMedia(event)} />
            <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={(event) => void selectInternalMedia(event)} />
            {composerKind === "event" && <div className="flex gap-2 text-sm">
              {([ ["rollcall", "Event roll call"], ["host", "New event"] ] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={eventMode === mode}
                onClick={() => { setEventMode(mode); setPostType(mode === "host" ? "event" : "personal"); setExistingEventId(""); }}
                className={`rounded-full px-3 py-2 font-semibold ${eventMode === mode ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]" : "text-[var(--app-text-secondary)]"}`}>{label}</button>)}
            </div>}
            {composerKind === "poll" && <fieldset className="space-y-2">
              <legend className="sr-only">Poll question and choices</legend>
              <label className="block"><span className="sr-only">Poll question</span><textarea data-composer-input required maxLength={280} value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} placeholder="Ask your campus…" rows={2} className="w-full resize-none bg-transparent py-2 text-lg outline-none" /></label>
              {pollOptions.map((option, index) => <div key={index} className="flex items-center gap-2">
                <label className="min-w-0 flex-1"><span className="sr-only">Choice {index + 1}</span><input required={index < 2} maxLength={100} value={option} onChange={(event) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className={fieldClass} placeholder={`Choice ${index + 1}`} /></label>
                {index >= 2 && <button type="button" aria-label={`Remove choice ${index + 1}`} className="rounded-full p-2 text-xl" onClick={() => setPollOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>}
              </div>)}
              {pollOptions.length < 6 && <button type="button" className="rounded-full py-2 text-xs font-semibold text-[var(--app-accent)]" onClick={() => setPollOptions((current) => [...current, ""])}>+ Add choice</button>}
            </fieldset>}
            {composerKind === "event" && eventMode === "rollcall" && <SearchableSelector label="Event" value={existingEventId} options={eventOptions} loading={contextLoading} onChange={setExistingEventId} placeholder="Search campus events" />}
            {composerKind === "event" && eventMode === "host" && <fieldset className="grid grid-cols-2 gap-3">
              <legend className="sr-only">New event details</legend>
              <label className="col-span-2 text-xs font-semibold text-[var(--app-text-secondary)]">Event title<input data-composer-input required value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="What’s happening?" className={fieldClass} /></label>
              <label className="text-xs font-semibold text-[var(--app-text-secondary)]">Date<input required type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className={fieldClass} /></label>
              <label className="text-xs font-semibold text-[var(--app-text-secondary)]">Time<input required type="time" value={eventStartTime} onChange={(event) => setEventStartTime(event.target.value)} className={fieldClass} /></label>
              <label className="col-span-2 text-xs font-semibold text-[var(--app-text-secondary)]">Place<input required value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} placeholder="Where are we meeting?" className={fieldClass} /></label>
            </fieldset>}
            {(composerKind !== "poll" || caption) && <div className="relative">
              <label><span className="sr-only">Caption or text</span><textarea ref={captionTextareaRef} data-composer-input
                required={composerKind === "post" && media.length === 0 && !existingEventId} value={caption}
                onChange={(event) => { setCaption(event.target.value); setMentionQuery(getActiveMentionQuery(event.target.value, event.target.selectionStart)); }}
                onSelect={(event) => setMentionQuery(getActiveMentionQuery(event.currentTarget.value, event.currentTarget.selectionStart))}
                rows={composerKind === "post" ? 4 : 2} className="w-full resize-none bg-transparent py-2 text-base leading-relaxed outline-none placeholder:text-[var(--app-text-secondary)]"
                placeholder={media.length ? "Add a caption…" : composerKind === "event" ? "Say a little more (optional)…" : "What’s on your mind?"} /></label>
              {mentionQuery !== null && mentionSuggestions.length > 0 && <div className="rounded-2xl bg-[var(--app-surface-elevated)] p-1">
                {mentionSuggestions.map((candidate) => <button key={candidate.account.id} type="button" onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { const caret = captionTextareaRef.current?.selectionStart ?? caption.length; setCaption(insertMentionAtCaret(caption, caret, candidate.profile.usernameNormalized)); setMentionQuery(null); window.requestAnimationFrame(() => captionTextareaRef.current?.focus()); }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--app-accent-soft)]">@{candidate.profile.username}<span className="ml-2 text-xs text-[var(--app-text-secondary)]">{candidate.profile.displayName}</span></button>)}
              </div>}
            </div>}
            {activeMedia.length > 0 && <div>
              <div className="flex gap-2 overflow-x-auto pb-1">{activeMedia.map((item) => <figure key={item.media.id} className="relative h-36 w-40 shrink-0 overflow-hidden rounded-2xl bg-[var(--app-surface-elevated)]">
                {item.media.type === "image" ? <Image src={item.media.url ?? ""} alt={`Selected media preview: ${item.fileName}`} fill sizes="160px" className="object-contain" unoptimized /> : <video src={item.media.url ?? undefined} controls playsInline preload="metadata" className="h-full w-full object-contain" />}
              </figure>)}</div>
              <button type="button" onClick={clearMedia} className="rounded-full py-2 text-xs font-semibold text-[var(--app-text-secondary)]">Remove media</button>
            </div>}
            {activeMediaPreparing && <p role="status" className="text-xs text-[var(--app-text-secondary)]">Preparing your media…</p>}
            {activeMediaError && <p role="alert" className="text-sm text-[var(--app-danger)]">{activeMediaError}</p>}
            {moreOpen && <div id="composer-extras" className="space-y-4 rounded-2xl bg-[var(--app-surface-elevated)] p-3">
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-[var(--app-accent)]">
                <button type="button" disabled={busy} onClick={chooseMedia} className="rounded-full py-2">Photos / video</button>
                <button type="button" disabled={busy} onClick={() => { if (cameraInputRef.current) { cameraInputRef.current.value = ""; cameraInputRef.current.click(); } }} className="rounded-full py-2">Camera</button>
                <button type="button" aria-pressed={contextKind === "club"} onClick={() => setContextKind(contextKind === "club" ? null : "club")} className="rounded-full py-2">Club</button>
                {composerKind !== "event" && <button type="button" aria-pressed={contextKind === "event"} onClick={() => setContextKind(contextKind === "event" ? null : "event")} className="rounded-full py-2">Event</button>}
                <button type="button" aria-pressed={contextKind === "location"} onClick={() => setContextKind(contextKind === "location" ? null : "location")} className="rounded-full py-2">Location</button>
                <button type="button" aria-pressed={contextKind === "settings"} onClick={() => setContextKind(contextKind === "settings" ? null : "settings")} className="rounded-full py-2">Post settings</button>
                {onSaveDraft && <button type="button" disabled={busy} onClick={() => void saveCurrentDraft()} className="rounded-full py-2">Save draft</button>}
              </div>
              {contextKind === "club" && <SearchableSelector label="Tag a club (optional)" value={taggedOrganizationId} options={clubOptions} loading={contextLoading} onChange={setTaggedOrganizationId} placeholder="Search clubs" />}
              {contextKind === "event" && composerKind !== "event" && <SearchableSelector label="Attach an event" value={existingEventId} options={eventOptions} loading={contextLoading} onChange={setExistingEventId} placeholder="Search campus events" />}
              {contextKind === "location" && <label className="block text-xs font-semibold">Location<input value={customLocation} onChange={(event) => { setLocationChoice("custom"); setCustomLocation(event.target.value); }} placeholder="A campus spot or meeting place" className={fieldClass} /></label>}
              {contextKind === "settings" && <div className="space-y-3">
                <label className="block text-xs font-semibold">Mint privacy<select value={privacy} onChange={(event) => setPrivacy(event.target.value as SocialContentPrivacy)} className={fieldClass}><option value="account">Use account privacy</option><option value="public">Public across Campus Mint</option><option value="connections">Connections only</option><option value="private">Only me</option></select></label>
                <label className="block text-xs font-semibold">Duration<select value={postType === "event" ? "24" : durationHours} disabled={postType === "event"} onChange={(event) => setDurationHours(event.target.value)} className={fieldClass}>{postType === "event" ? <option value="24">24 hours</option> : personalDurationOptions.map((option) => <option key={option.hours} value={option.hours}>{option.label}</option>)}</select></label>
                {postableOrganizations.length > 0 && composerKind !== "event" && <SearchableSelector label="Post as a club" value={selectedOrganizationId} options={postableOrganizations.map((club) => ({ id: club.id, label: club.name }))} onChange={(id) => { setSelectedOrganizationId(id); setPostType(id ? "club" : "personal"); }} placeholder="Post as yourself" />}
                {postType === "club" && <label className="block text-xs font-semibold">Club audience<select value={organizationAudience} onChange={(event) => setOrganizationAudience(event.target.value as OrganizationContentAudience)} className={fieldClass}><option value="public">Everyone</option><option value="members">Club members</option></select></label>}
                <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={commentsEnabled} onChange={(event) => setCommentsEnabled(event.target.checked)} className="accent-[var(--app-accent)]" />Allow replies</label>
              </div>}
            </div>}
            {!moreOpen && (taggedOrganizationId || (existingEventId && composerKind !== "event") || customLocation || (postType === "club" && selectedOrganization)) && <div className="flex flex-wrap gap-2 text-xs text-[var(--app-accent)]">
              {postType === "club" && selectedOrganization && <span>Posting as {selectedOrganization.name}</span>}
              {taggedOrganizationId && <span>↗ {availableOrganizations.find((club) => club.id === taggedOrganizationId)?.name ?? "Club attached"}</span>}
              {existingEventId && composerKind !== "event" && <span>↗ {availableEvents.find((event) => event.id === existingEventId)?.title ?? "Event attached"}</span>}
              {customLocation && <span>⌖ {customLocation}</span>}
            </div>}
            {contextError && ((composerKind === "event" && eventMode === "rollcall") || contextKind === "club" || contextKind === "event") && <p role="status" className="text-xs text-[var(--app-text-secondary)]">Club and event choices couldn’t load. <button type="button" onClick={() => { setContextLoading(true); setContextError(false); setContextAttempt((attempt) => attempt + 1); }} className="rounded-full font-semibold text-[var(--app-accent)]">Retry</button></p>}
            </fieldset>
          </form>}
          {draftNotice && <p role="status" className="mt-3 text-xs text-[var(--app-personal)]">{draftNotice}</p>}
          {submitError && <p role="alert" className="mt-3 text-sm text-[var(--app-danger)]">{submitError}</p>}
        </div>
        {composerKind && !draftsOpen && <footer className="flex shrink-0 items-center gap-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button type="button" disabled={busy} aria-label={moreOpen ? "Hide optional post options" : "Add to your post"} aria-expanded={moreOpen} aria-controls="composer-extras" onClick={() => setMoreOpen((open) => !open)} className="rounded-full px-2 py-1 text-3xl font-light text-[var(--app-accent)]">{moreOpen ? "−" : "+"}</button>
          <span className="min-w-0 flex-1 text-xs text-[var(--app-text-secondary)]">{privacy === "private" ? "Only you" : privacy === "connections" ? "Your connections" : privacy === "public" ? "Public" : "Your account audience"}</span>
          <button type="submit" form="mint-composer-form" disabled={busy || !ready} className="rounded-full bg-[var(--app-accent)] px-6 py-2.5 text-sm font-bold text-[var(--app-accent-contrast)] disabled:opacity-45">{submitting ? "Posting…" : "Post"}</button>
        </footer>}
      </section>
    </div>, document.body,
  );
}
