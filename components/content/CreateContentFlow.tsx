"use client";

import Image from "next/image";
import { MintLeafIcon } from "@/components/icons/MintLeafIcon";
import { PlacePicker } from "@/components/content/PlacePicker";
import { composerProgress, hasComposerText } from "@/lib/content/composerProgress";
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
  const [composerKind, setComposerKind] = useState<ComposerKind | null>("post");
  const [eventMode, setEventMode] = useState<"rollcall" | "host">("rollcall");
  const [moreOpen, setMoreOpen] = useState(false);
  const [privacyChosen, setPrivacyChosen] = useState(false);
  const [durationChosen, setDurationChosen] = useState(false);
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
  const [privacy, setPrivacy] = useState<SocialContentPrivacy>("public");
  const personalDurationRef = useRef("permanent");
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
    ? developmentClubs.filter((organization) => organizationMemberships.some((membership) => membership.organizationId === organization.id && membership.userId === viewer.account.id && ["member", "officer", "leader"].includes(membership.status))).map((organization) => ({ id: organization.id, name: organization.name, canPublish: Boolean(organizationActor && canPostAsOrganization(organizationActor, organization, organizationMemberships, organizationRoles)) }))
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
      title: eventTitle.trim() || caption.trim().slice(0, 120) || null,
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
    setCaption(draft.caption || draft.pollQuestion || "");
    setPrivacyChosen(true); setDurationChosen(true);
    setPostType(draft.postType);
    setComposerKind(draft.composerKind ?? (draft.postType === "event" ? "event" : "post"));
    setEventMode(draft.eventMode ?? (draft.postType === "event" && !draft.existingEventId ? "host" : "rollcall"));
    setPollQuestion(draft.pollQuestion ?? "");
    setPollOptions(draft.pollOptions ?? ["", ""]);
    setMoreOpen(false);
    setContextKind(draft.taggedOrganizationId || draft.selectedOrganizationId ? "club" : draft.postType === "event" || draft.existingEventId ? "event" : null);
    setCommentsEnabled(draft.commentsEnabled);
    setPrivacy(draft.privacy);
    setDurationHours(draft.postType === "event" ? String(EVENT_CONTENT_DURATION_HOURS) : draft.durationHours);
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
    if (submitting || draftBusy || activeMediaPreparing || !composerKind || !ready) return;
    setSubmitError(null);

    const hasEventDetails = Boolean(existingEventId || (postType === "event" && (eventTitle.trim() || eventDescription.trim())));

    if (composerKind === "poll" && (!pollQuestion.trim() || pollOptions.filter((option) => option.trim()).length < 2)) {
      setSubmitError("Add a question and at least two choices.");
      return;
    }
    if (postType === "event" && !existingEventId && !eventLocation.trim()) {
      setSubmitError("Select a location to confirm your event’s address.");
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
    }, activeMedia, publishRequestIdRef.current).catch(() => ({ ok: false, message: "Couldn’t reach Campus Mint. Your work is still here; try again." }));
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
  const clubOptions = availableOrganizations.map((club) => ({ id: club.id, label: club.name }));
  const eventOptions = availableEvents.map((event) => ({ id: event.id, label: event.title, detail: `${new Date(event.startAt).toLocaleDateString()} · ${event.location}` }));

  const hasContent = hasComposerText(caption) || media.length > 0 || (composerKind === "poll" && hasComposerText(pollQuestion));
  const progress = composerProgress(hasContent, privacyChosen, durationChosen);
  const ready = hasContent && (composerKind !== "poll" || (hasComposerText(pollQuestion) && pollOptions.filter((option) => hasComposerText(option)).length >= 2)) && (postType !== "event" || Boolean(existingEventId || eventLocation.trim())) && (contextKind !== "club" || Boolean(taggedOrganizationId || selectedOrganizationId));
  function insertToken(token: string) {
    const field = captionTextareaRef.current;
    const caret = field?.selectionStart ?? caption.length;
    const prefix = caret > 0 && !/\s/.test(caption[caret - 1]) ? " " : "";
    const next = caption.slice(0, caret) + prefix + token + caption.slice(field?.selectionEnd ?? caret);
    setCaption(next); if (composerKind === "poll") setPollQuestion(next);
    setMentionQuery(token === "@" ? "" : null);
    requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(caret + prefix.length + 1, caret + prefix.length + 1); });
  }
  function toggleContext(kind: "club" | "event") {
    const next = contextKind === kind ? null : kind;
    setContextKind(next); setTaggedOrganizationId(""); setSelectedOrganizationId(""); setExistingEventId("");
    setPostType(next === "event" ? "event" : "personal"); setEventMode("host");
    if (next === "event") { personalDurationRef.current = durationHours; setDurationHours(String(EVENT_CONTENT_DURATION_HOURS)); }
    else if (contextKind === "event") setDurationHours(personalDurationRef.current);
  }

  return createPortal(
    <div className={`cm-overlay-backdrop fixed inset-x-0 top-0 z-[90] flex h-dvh items-center justify-center bg-black/45 p-3 sm:p-6 ${closing ? "is-closing" : ""}`}
      style={viewport ? { height: viewport.height, top: viewport.top } : undefined}
      role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="create-content-title"
        className={`cm-panel-sheet cm-create-composer flex max-h-full w-full min-w-0 max-w-lg flex-col overflow-hidden rounded-[1.75rem] bg-[var(--app-surface)] text-[var(--app-text-primary)] ${closing ? "is-closing" : ""}`}>
        <header className="flex shrink-0 items-center justify-between px-5 pt-3">
          <h2 id="create-content-title" className="sr-only">{draftsOpen ? "Drafts" : "Create Mint"}</h2>
          <button type="button" disabled={busy} onClick={() => setDraftsOpen(!draftsOpen)} className="rounded-full py-2 text-xs text-[var(--app-text-secondary)]">{draftsOpen ? "Back" : `Drafts${drafts.length ? ` (${drafts.length})` : ""}`}</button>
          <CloseButton onClick={requestClose} label="Close Create Mint" />
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
          {draftsOpen ? <section aria-label="Saved drafts" className="space-y-2 py-3">
            <p className="text-xs text-[var(--app-text-secondary)]">On this device</p>
            {drafts.length === 0 && <p className="py-6 text-sm">No drafts yet.</p>}
            {drafts.map((draft) => <div key={draft.id} className="flex items-center gap-3 rounded-2xl bg-[var(--app-surface-elevated)] p-3">
              <button type="button" disabled={busy} onClick={() => void openDraft(draft)} className="min-w-0 flex-1 rounded-xl text-left"><span className="block truncate text-sm font-semibold">{draft.pollQuestion?.trim() || draft.caption.trim() || draft.eventTitle.trim() || "Untitled draft"}</span><span className="text-xs text-[var(--app-text-secondary)]">{new Date(draft.updatedAt).toLocaleDateString()} · {draft.mediaCount} attachments</span></button>
              {onDeleteDraft && <button type="button" disabled={busy} aria-label="Delete draft" className="rounded-full p-2 text-sm" onClick={async () => { setDraftBusy(true); try { await onDeleteDraft(draft.id); } catch { setSubmitError("Couldn’t delete this draft."); } finally { setDraftBusy(false); } }}>×</button>}
            </div>)}
          </section> : <form id="mint-composer-form" onSubmit={submit}>
            <fieldset disabled={busy} className="min-w-0 disabled:pointer-events-none disabled:opacity-70">
              <legend className="sr-only">Post details</legend>
              <input ref={internalFileInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={(event) => void selectInternalMedia(event)} />
              <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={(event) => void selectInternalMedia(event)} />
              <div className="flex items-start gap-2">
                <label className="min-w-0 flex-1"><span className="sr-only">Text here</span><textarea ref={captionTextareaRef} data-initial-focus data-composer-input value={caption} maxLength={composerKind === "poll" ? 280 : 5000}
                  onChange={(event) => { setCaption(event.target.value); if (composerKind === "poll") setPollQuestion(event.target.value); setMentionQuery(getActiveMentionQuery(event.target.value, event.target.selectionStart)); }}
                  onSelect={(event) => setMentionQuery(getActiveMentionQuery(event.currentTarget.value, event.currentTarget.selectionStart))}
                  rows={3} className="cm-composer-field block min-h-24 w-full resize-none rounded-xl bg-transparent py-3 text-base leading-relaxed placeholder:text-[var(--app-text-secondary)]" placeholder="Text here" /></label>
                <div className="flex shrink-0 items-center pt-2">
                  <button type="button" onClick={chooseMedia} aria-label="Add photo or video" className="rounded-full p-2 text-[var(--app-accent)]"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg></button>
                  <button type="button" aria-label="More post options" aria-expanded={moreOpen} aria-controls="composer-extras" onClick={() => setMoreOpen(!moreOpen)} className="rounded-full p-2 text-[var(--app-text-secondary)]"><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="m5 8 5 5 5-5"/></svg></button>
                </div>
              </div>
              <div className="flex gap-1"><button type="button" aria-label="Add hashtag" onClick={() => insertToken("#")} className="rounded-full px-2 py-1 text-sm text-[var(--app-text-secondary)]">#</button><button type="button" aria-label="Mention someone" onClick={() => insertToken("@")} className="rounded-full px-2 py-1 text-sm text-[var(--app-text-secondary)]">@</button></div>
              {mentionQuery !== null && mentionSuggestions.length > 0 && <div className="rounded-2xl bg-[var(--app-surface-elevated)] p-1">{mentionSuggestions.map((candidate) => <button key={candidate.account.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { const next = insertMentionAtCaret(caption, captionTextareaRef.current?.selectionStart ?? caption.length, candidate.profile.usernameNormalized); setCaption(next); if (composerKind === "poll") setPollQuestion(next); setMentionQuery(null); captionTextareaRef.current?.focus(); }} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--app-accent-soft)]">@{candidate.profile.username}<span className="ml-2 text-xs text-[var(--app-text-secondary)]">{candidate.profile.displayName}</span></button>)}</div>}
              {moreOpen && <div id="composer-extras" className="cm-composer-reveal my-2 flex flex-wrap gap-4 rounded-2xl bg-[var(--app-surface-elevated)] px-3 py-2 text-sm">
                <button type="button" aria-pressed={composerKind === "poll"} onClick={() => { setComposerKind(composerKind === "poll" ? "post" : "poll"); setPollQuestion(caption.slice(0, 280)); if (composerKind !== "poll") setCaption(caption.slice(0, 280)); setMoreOpen(false); }} className="rounded-full py-1">{composerKind === "poll" ? "Remove poll" : "Poll"}</button>
                <button type="button" onClick={() => cameraInputRef.current?.click()} className="rounded-full py-1">Camera</button>
                {onSaveDraft && <button type="button" onClick={() => void saveCurrentDraft()} className="rounded-full py-1">Save draft</button>}
              </div>}
              {composerKind === "poll" && <div className="cm-composer-reveal space-y-2 py-3" aria-label="Poll choices">
                {pollOptions.map((option, index) => <div key={index} className="flex items-center gap-2"><input aria-label={`Choice ${index + 1}`} value={option} maxLength={100} onChange={(event) => setPollOptions((current) => current.map((item, i) => i === index ? event.target.value : item))} placeholder={`Choice ${index + 1}`} className={fieldClass + " cm-composer-field"}/>{index > 1 && <button type="button" aria-label={`Remove choice ${index + 1}`} onClick={() => setPollOptions((current) => current.filter((_, i) => i !== index))} className="rounded-full p-2">×</button>}</div>)}
                {pollOptions.length < 6 && <button type="button" onClick={() => setPollOptions((current) => [...current, ""])} className="rounded-full py-1 text-xs text-[var(--app-accent)]">+ Choice</button>}
              </div>}
              {activeMedia.length > 0 && <div className="py-3"><div className="flex gap-2 overflow-x-auto">{activeMedia.map((item) => <figure key={item.media.id} className="relative h-36 w-40 shrink-0 overflow-hidden rounded-2xl bg-[var(--app-surface-elevated)]">{item.media.type === "image" ? <Image src={item.media.url ?? ""} alt={`Selected media: ${item.fileName}`} fill sizes="160px" className="object-contain" unoptimized /> : <video src={item.media.url ?? undefined} controls playsInline className="h-full w-full object-contain" />}</figure>)}</div><button type="button" onClick={clearMedia} className="rounded-full py-2 text-xs text-[var(--app-text-secondary)]">Remove media</button></div>}
              {activeMediaPreparing && <p role="status" className="text-xs">Preparing media…</p>}
              {activeMediaError && <p role="alert" className="text-sm text-[var(--app-danger)]">{activeMediaError}</p>}
              {progress >= 1 && <div className="cm-composer-reveal pt-3"><label className="sr-only" htmlFor="composer-privacy">Privacy</label><select id="composer-privacy" aria-label="Privacy" value={privacyChosen ? privacy : ""} onChange={(event) => { setPrivacy(event.target.value as SocialContentPrivacy); setPrivacyChosen(true); }} className={fieldClass + " cm-composer-field"}><option value="" disabled>Privacy · Public</option>{privacy === "account" && <option value="account">Profile default</option>}<option value="public">Public</option><option value="connections">Connections</option><option value="private">Only me</option></select></div>}
              {progress >= 2 && <div className="cm-composer-reveal pt-2"><label className="sr-only" htmlFor="composer-duration">Duration</label><select id="composer-duration" aria-label="Duration" disabled={postType === "event"} value={durationChosen ? durationHours : ""} onChange={(event) => { setDurationHours(event.target.value); setDurationChosen(true); }} className={fieldClass + " cm-composer-field"}><option value="" disabled>Duration · Permanent</option>{personalDurationOptions.map((option) => <option key={option.hours} value={option.hours}>{option.label}</option>)}</select></div>}
              {progress >= 3 && <div className="cm-composer-reveal space-y-3 pt-4">
                <div className="flex gap-2">{([ ["event", "Event"], ["club", "Club"] ] as const).map(([kind, label]) => <button key={kind} type="button" aria-pressed={contextKind === kind} onClick={() => toggleContext(kind)} className={`cm-context-${kind} rounded-full px-4 py-1.5 text-sm font-semibold ${contextKind === kind ? "is-selected" : ""}`}>{label}</button>)}</div>
                {contextKind === "club" && <><SearchableSelector label="Club" value={taggedOrganizationId || selectedOrganizationId} options={clubOptions} loading={contextLoading} onChange={(id) => { setTaggedOrganizationId(id); setSelectedOrganizationId(""); setPostType("personal"); }} placeholder="Your joined clubs" />{!contextLoading && !clubOptions.length && <p className="text-xs text-[var(--app-text-secondary)]">Join a club first</p>}</>}
                {contextKind === "event" && <><p className="text-xs text-[var(--app-text-secondary)]">Event posts last 24 hours.</p><PlacePicker sessionKey={viewer.account.id} universityId={configuredUniversityId} value={eventLocation} onChange={setEventLocation} /><details className="text-xs text-[var(--app-text-secondary)]"><summary className="cursor-pointer rounded-full py-1">Link a campus event</summary><SearchableSelector label="Campus event" value={existingEventId} options={eventOptions} loading={contextLoading} onChange={setExistingEventId} /></details></>}
                {contextError && (contextKind === "club" || contextKind === "event") && <button type="button" onClick={() => { setContextLoading(true); setContextError(false); setContextAttempt((attempt) => attempt + 1); }} className="text-xs text-[var(--app-accent)]">Couldn’t load choices. Retry</button>}
              </div>}
            </fieldset>
          </form>}
          {draftNotice && <p role="status" className="mt-3 text-xs text-[var(--app-personal)]">{draftNotice}</p>}
          {submitError && <p role="alert" className="mt-3 text-sm text-[var(--app-danger)]">{submitError}</p>}
        </div>
        {!draftsOpen && <footer className="flex shrink-0 justify-end px-5 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-1"><button type="submit" form="mint-composer-form" aria-label={submitting ? "Publishing" : "Publish"} title="Publish" disabled={busy || !ready} className="flex h-11 w-11 items-center justify-center rounded-full bg-transparent text-[#52a77d] disabled:opacity-30"><MintLeafIcon className="!h-7 !w-7" /><span className="sr-only">{submitting ? "Publishing…" : "Publish"}</span></button></footer>}
      </section>
    </div>, document.body,
  );
}
