"use client";

import Image from "next/image";
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";

import { sampleEvents } from "@/data/events";
import { developmentOrganizations } from "@/data/organizations";
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
import { parseHashtags } from "@/lib/content/hashtags";
import { zonedDateTimeToIso } from "@/lib/content/eventTiming";
import {
  getMintContentType,
  prepareLocalMintMedia,
  type LocalMintMediaSelection,
} from "@/lib/content/localMintMedia";
import { normalizeUsername } from "@/lib/social/usernames";
import { canPostAsOrganization } from "@/lib/organizationPermissions";
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
  onCreateMint: (input: CreateMintInput) => void;
  onClose: () => void;
  organizationMemberships: OrganizationMembership[];
  organizationRoles: OrganizationRoleAssignment[];
  defaultCommentsEnabled?: boolean;
  defaultHideLikeCounts?: boolean;
  selectedMedia?: LocalMintMediaSelection[];
  mediaError?: string | null;
  mediaPreparing?: boolean;
  onChooseMedia?: () => void;
  onClearMedia?: () => void;
};

const fieldClass = "mt-1 min-w-0 max-w-full w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base sm:text-sm";

export function CreateContentFlow({ viewer, users, theme, onCreateMint, onClose, organizationMemberships, organizationRoles, defaultCommentsEnabled = true, defaultHideLikeCounts = false, selectedMedia, mediaError, mediaPreparing = false, onChooseMedia, onClearMedia }: CreateContentFlowProps) {
  const internalFileInputRef = useRef<HTMLInputElement>(null);
  const [internalMedia, setInternalMedia] = useState<LocalMintMediaSelection[]>([]);
  const [internalMediaError, setInternalMediaError] = useState<string | null>(null);
  const [internalMediaPreparing, setInternalMediaPreparing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [postType, setPostType] = useState<SocialPostType>("personal");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [mentionInput, setMentionInput] = useState("");
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [commentsEnabled, setCommentsEnabled] = useState(defaultCommentsEnabled);
  const [likesVisible, setLikesVisible] = useState(!defaultHideLikeCounts);
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

  const otherUsers = users.filter(
    (user) =>
      user.account.id !== viewer.account.id,
  );

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
      ? developmentOrganizations.filter(
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

  const mentionMatches = useMemo(() => mentionInput.split(/[\s,]+/)
    .map((value) => normalizeUsername(value.replace(/^@/, "")))
    .filter(Boolean)
    .map((username) => users.find((user) => user.profile.usernameNormalized === username))
    .filter((user): user is CampusMintUser => Boolean(user))
    .map((user) => ({ userId: user.account.id, username: user.profile.usernameNormalized })), [mentionInput, users]);

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
    const prepared = await prepareLocalMintMedia(files);
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

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    if (!network) {
      setSubmitError("A verified campus network is required to publish.");
      return;
    }

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
    const location = postType === "event" ? eventData?.location ?? null : resolvedLocation();

    onCreateMint({
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
      hashtags: parseHashtags(hashtags),
      mentions: mentionMatches,
      taggedUserIds,
      location,
      music: null,
      expiresAt,
      commentsEnabled,
      likesVisible,
      eventData,
      organizationId:
        postType === "club" ? selectedOrganization?.id ?? null : null,
      taggedOrganizationIds: postType !== "club" && taggedOrganizationId ? [taggedOrganizationId] : [],
      organizationAudience: postType === "club" ? organizationAudience : "public",
      privacy,
      isDevelopment: true,
    });
    onClose();
  }

  const personalDurationOptions = personalMintDurationOptions.map((option) => ({
    hours: option.hours === null ? "permanent" : String(option.hours),
    label: option.label,
  }));

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center overflow-hidden bg-slate-950/55 sm:items-center sm:p-6"
      role="presentation"
    >
      <section
        className="mx-auto max-h-[calc(100dvh-0.35rem)] w-full min-w-0 max-w-xl overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-[2rem] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-2xl sm:p-7"
        style={{ WebkitOverflowScrolling: "touch" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-content-title"
      >
        <div className="sticky -top-5 z-30 -mx-4 -mt-5 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-4 pb-3 pt-5 backdrop-blur-xl sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: theme.primary }}>
              Local development flow
            </p>
            <h2 id="create-content-title" className="mt-1 text-xl font-black sm:text-2xl">
              Create Mint
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Create Mint"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-700"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-6">
          <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <legend className="px-2 text-sm font-black text-slate-900">
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
                <p className="text-sm font-bold text-slate-800">
                  {activeMediaPreparing
                    ? "Preparing your selection…"
                    : activeMedia.length > 0
                      ? `${activeMedia.length} media item${activeMedia.length === 1 ? "" : "s"} selected`
                      : "Text-only Mint"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Photos and videos stay local to this development session.
                  No production upload is performed.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {activeMedia.length > 0 && (
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="rounded-full px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                  >
                    Use text only
                  </button>
                )}
                <button
                  type="button"
                  onClick={chooseMedia}
                  disabled={activeMediaPreparing}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 disabled:cursor-wait disabled:opacity-60"
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
                    className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="relative aspect-square overflow-hidden bg-slate-950">
                      {item.media.type === "image" ? (
                        <Image
                          src={item.media.url ?? ""}
                          alt={`Selected media preview: ${item.fileName}`}
                          fill
                          sizes="(max-width: 640px) 50vw, 14rem"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <video
                          src={item.media.url ?? undefined}
                          controls
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <figcaption className="truncate px-2 py-1.5 text-[10px] font-semibold text-slate-500">
                      {item.fileName}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}

            {activeMediaError && (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
              >
                {activeMediaError}
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="font-bold text-slate-900">Mint type</legend>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {(["personal", "event", "club"] as SocialPostType[]).map(
                (value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPostType(value)}
                    className="rounded-xl border p-3 text-sm font-bold capitalize sm:p-4"
                    style={{
                      borderColor:
                        postType === value
                          ? value === "event"
                            ? "#059669"
                            : value === "club"
                              ? "#f97316"
                              : theme.primary
                          : "#e2e8f0",
                      color:
                        postType === value
                          ? value === "event"
                            ? "#047857"
                            : value === "club"
                              ? "#c2410c"
                              : theme.primary
                          : "#475569",
                    }}
                  >
                    {value}
                  </button>
                ),
              )}
            </div>
          </fieldset>

          {postType === "event" && <fieldset className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-5"><legend className="px-2 font-black uppercase tracking-wide text-emerald-800">Event details · 24H</legend><label className="block text-sm font-bold text-emerald-950">Existing Campus Mint Event<select value={existingEventId} onChange={(event) => setExistingEventId(event.target.value)} className={fieldClass}><option value="">Informal/custom event</option>{availableEvents.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{!existingEventId && <><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-emerald-950">Event title<input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} className={fieldClass} /></label><label className="text-sm font-black uppercase text-emerald-950">When · Date<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className={fieldClass} /></label><label className="text-sm font-black uppercase text-emerald-950">When · Start time<input type="time" value={eventStartTime} onChange={(event) => setEventStartTime(event.target.value)} className={fieldClass} /></label><label className="text-sm font-bold text-emerald-950">End time (optional)<input type="time" value={eventEndTime} onChange={(event) => setEventEndTime(event.target.value)} className={fieldClass} /></label><label className="text-sm font-black uppercase text-emerald-950">Where<input value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} className={fieldClass} placeholder="Venue or general location" /></label><label className="text-sm font-bold text-emerald-950">Location details<input value={eventLocationDetails} onChange={(event) => setEventLocationDetails(event.target.value)} className={fieldClass} /></label></div><label className="mt-4 block text-sm font-bold text-emerald-950">Add details<textarea value={eventDescription} onChange={(event) => setEventDescription(event.target.value)} rows={3} className={fieldClass} /></label></>}</fieldset>}

          {postType === "club" && <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><legend className="px-2 font-black uppercase tracking-wide text-slate-800">Official club identity</legend>{postableOrganizations.length ? <><label className="block text-sm font-bold text-slate-800">Select Club<select required value={selectedOrganizationId} onChange={(event) => setSelectedOrganizationId(event.target.value)} className={fieldClass}><option value="">Choose an organization</option>{postableOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>{selectedOrganization && <p className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600">Publishing as <span className="font-black text-slate-900">{selectedOrganization.name}</span>. The Mint stores only its organization ID.</p>}<label className="mt-4 block text-sm font-bold text-slate-800">Club content audience<select value={organizationAudience} onChange={(event) => setOrganizationAudience(event.target.value as OrganizationContentAudience)} className={fieldClass}><option value="public">Public club content</option><option value="members">Members only</option></select></label></> : <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">You do not hold a leader, officer, or approved publishing role for a club at this university. Create Personal content and tag a club instead.</p>}</fieldset>}

          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700 sm:col-span-2">Caption or text<textarea required={media.length === 0 && postType !== "event"} value={caption} onChange={(event) => setCaption(event.target.value)} rows={4} className={fieldClass} placeholder={media.length === 0 ? "What do you want to share?" : "Add a caption (optional)"} /></label><label className="text-sm font-bold text-slate-700">Hashtags<input value={hashtags} onChange={(event) => setHashtags(event.target.value)} className={fieldClass} placeholder="#Campus #StudyGroup" /></label><label className="text-sm font-bold text-slate-700">Mentions<input value={mentionInput} onChange={(event) => setMentionInput(event.target.value)} className={fieldClass} placeholder="@username" /></label>{postType !== "event" && <label className="text-sm font-bold text-slate-700">Location<select value={locationChoice} onChange={(event) => setLocationChoice(event.target.value)} className={fieldClass}><option value="none">No location</option>{availableBuildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}<option value="custom">Other / Custom Location</option></select></label>}{locationChoice === "custom" && postType !== "event" && <label className="text-sm font-bold text-slate-700">Custom location<input value={customLocation} onChange={(event) => setCustomLocation(event.target.value)} className={fieldClass} /></label>}{postType !== "club" && <label className="text-sm font-bold text-slate-700">Tag a club (optional)<select value={taggedOrganizationId} onChange={(event) => setTaggedOrganizationId(event.target.value)} className={fieldClass}><option value="">No club tag</option>{availableOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>}<label className="text-sm font-bold text-slate-700">Expiration<select value={postType === "event" ? "24" : durationHours} disabled={postType === "event"} onChange={(event) => setDurationHours(event.target.value)} className={fieldClass}>{postType === "event" ? <option value="24">24 hours (Event default)</option> : personalDurationOptions.map((option) => <option key={option.hours} value={option.hours}>{option.label}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Mint privacy<select value={privacy} onChange={(event) => setPrivacy(event.target.value as SocialContentPrivacy)} className={fieldClass}><option value="account">Use account privacy</option><option value="public">Public within discovery scope</option><option value="connections">Connections only</option><option value="private">Only me</option></select></label></div>
          <fieldset><legend className="text-sm font-bold text-slate-700">Tagged users</legend><div className="mt-2 flex flex-wrap gap-2">{otherUsers.map((user) => <label key={user.account.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><input type="checkbox" className="mr-2" checked={taggedUserIds.includes(user.account.id)} onChange={() => setTaggedUserIds((current) => current.includes(user.account.id) ? current.filter((id) => id !== user.account.id) : [...current, user.account.id])} />@{user.profile.username}</label>)}</div></fieldset>
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><p className="font-bold">Music</p><p className="mt-1">No music selected. Licensed provider integration is intentionally not enabled.</p></div>
          <div className="flex flex-wrap gap-5"><label className="text-sm font-semibold"><input type="checkbox" className="mr-2" checked={commentsEnabled} onChange={(event) => setCommentsEnabled(event.target.checked)} />Comments enabled</label><label className="text-sm font-semibold"><input type="checkbox" className="mr-2" checked={likesVisible} onChange={(event) => setLikesVisible(event.target.checked)} />Show like count</label></div>
          {submitError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{submitError}</p>}
          <div className="flex gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">Cancel</button><button className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ backgroundColor: postType === "event" ? "#059669" : theme.primary }}>Publish Mint</button></div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
