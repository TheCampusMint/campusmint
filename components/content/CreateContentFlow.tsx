"use client";

import { useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { sampleEvents } from "@/data/events";
import { developmentOrganizations } from "@/data/organizations";
import { developmentBuildings } from "@/data/development/campusData";
import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import {
  getAccountConfiguredUniversityId,
  getAccountUniversityTheme,
  universities,
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
import { normalizeUsername } from "@/lib/social/usernames";
import { canPostAsOrganization } from "@/lib/organizationPermissions";
import type {
  ContentLocation,
  EventContentData,
  SocialContentPrivacy,
  SocialContentType,
  SocialMedia,
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
};

const fieldClass = "mt-1 min-w-0 max-w-full w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base sm:text-sm";

function placeholderMedia(contentType: SocialContentType): SocialMedia[] {
  if (contentType === "text") return [];
  const count = contentType === "carousel" ? 2 : 1;
  const mediaType = contentType === "video" ? "video" : "image";
  return Array.from({ length: count }, (_, order) => ({
    id: `local-media-${globalThis.crypto.randomUUID()}`,
    type: mediaType,
    url: null,
    thumbnailUrl: null,
    width: null,
    height: null,
    durationSeconds: null,
    order,
    isDevelopmentPlaceholder: true,
  }));
}

export function CreateContentFlow({ viewer, users, theme, onCreateMint, onClose, organizationMemberships, organizationRoles, defaultCommentsEnabled = true, defaultHideLikeCounts = false }: CreateContentFlowProps) {
  const [step, setStep] = useState<"media" | "settings">("media");
  const [contentType, setContentType] = useState<SocialContentType>("text");
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

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!network) return;
    if (postType === "club" && !selectedOrganization) return;
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
    const media = placeholderMedia(contentType);

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
      organizationId: postType === "club" ? selectedOrganization!.id : null,
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

        {step === "media" ? <div className="mt-6 space-y-6"><fieldset><legend className="font-bold text-slate-900">1. Select media/content</legend><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{(["text", "image", "video", "carousel"] as SocialContentType[]).map((type) => <button key={type} type="button" onClick={() => setContentType(type)} className="rounded-xl border p-4 text-sm font-bold capitalize" style={{ borderColor: contentType === type ? theme.primary : "#e2e8f0", color: contentType === type ? theme.primary : "#475569" }}>{type === "carousel" ? "Multiple photos" : type}</button>)}</div><p className="mt-2 text-xs text-slate-500">Media uses development placeholders. No upload or licensed audio is enabled.</p></fieldset><fieldset><legend className="font-bold text-slate-900">2. Mint type</legend><div className="mt-3 grid grid-cols-3 gap-3">{(["personal", "event", "club"] as SocialPostType[]).map((value) => <button key={value} type="button" onClick={() => setPostType(value)} className="rounded-xl border p-4 text-sm font-bold capitalize" style={{ borderColor: postType === value ? (value === "event" ? "#059669" : value === "club" ? "#f97316" : theme.primary) : "#e2e8f0", color: postType === value ? (value === "event" ? "#047857" : value === "club" ? "#c2410c" : theme.primary) : "#475569" }}>{value}</button>)}</div></fieldset><button type="button" onClick={() => setStep("settings")} className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ backgroundColor: theme.primary }}>Continue to details</button></div> : <form onSubmit={submit} className="mt-6 space-y-6">
          

          {postType === "event" && <fieldset className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-5"><legend className="px-2 font-black uppercase tracking-wide text-emerald-800">Event details · 24H</legend><label className="block text-sm font-bold text-emerald-950">Existing Campus Mint Event<select value={existingEventId} onChange={(event) => setExistingEventId(event.target.value)} className={fieldClass}><option value="">Informal/custom event</option>{availableEvents.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{!existingEventId && <><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-emerald-950">Event title<input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} className={fieldClass} /></label><label className="text-sm font-black uppercase text-emerald-950">When · Date<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className={fieldClass} /></label><label className="text-sm font-black uppercase text-emerald-950">When · Start time<input type="time" value={eventStartTime} onChange={(event) => setEventStartTime(event.target.value)} className={fieldClass} /></label><label className="text-sm font-bold text-emerald-950">End time (optional)<input type="time" value={eventEndTime} onChange={(event) => setEventEndTime(event.target.value)} className={fieldClass} /></label><label className="text-sm font-black uppercase text-emerald-950">Where<input value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} className={fieldClass} placeholder="Venue or general location" /></label><label className="text-sm font-bold text-emerald-950">Location details<input value={eventLocationDetails} onChange={(event) => setEventLocationDetails(event.target.value)} className={fieldClass} /></label></div><label className="mt-4 block text-sm font-bold text-emerald-950">Add details<textarea value={eventDescription} onChange={(event) => setEventDescription(event.target.value)} rows={3} className={fieldClass} /></label></>}</fieldset>}

          {postType === "club" && <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><legend className="px-2 font-black uppercase tracking-wide text-slate-800">Official club identity</legend>{postableOrganizations.length ? <><label className="block text-sm font-bold text-slate-800">Select Club<select required value={selectedOrganizationId} onChange={(event) => setSelectedOrganizationId(event.target.value)} className={fieldClass}><option value="">Choose an organization</option>{postableOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>{selectedOrganization && <p className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600">Publishing as <span className="font-black text-slate-900">{selectedOrganization.name}</span>. The Mint stores only its organization ID.</p>}<label className="mt-4 block text-sm font-bold text-slate-800">Club content audience<select value={organizationAudience} onChange={(event) => setOrganizationAudience(event.target.value as OrganizationContentAudience)} className={fieldClass}><option value="public">Public club content</option><option value="members">Members only</option></select></label></> : <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">You do not hold a leader, officer, or approved publishing role for a club at this university. Create Personal content and tag a club instead.</p>}</fieldset>}

          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700 sm:col-span-2">Caption<textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={4} className={fieldClass} /></label><label className="text-sm font-bold text-slate-700">Hashtags<input value={hashtags} onChange={(event) => setHashtags(event.target.value)} className={fieldClass} placeholder="#Campus #StudyGroup" /></label><label className="text-sm font-bold text-slate-700">Mentions<input value={mentionInput} onChange={(event) => setMentionInput(event.target.value)} className={fieldClass} placeholder="@username" /></label>{postType !== "event" && <label className="text-sm font-bold text-slate-700">Location<select value={locationChoice} onChange={(event) => setLocationChoice(event.target.value)} className={fieldClass}><option value="none">No location</option>{availableBuildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}<option value="custom">Other / Custom Location</option></select></label>}{locationChoice === "custom" && postType !== "event" && <label className="text-sm font-bold text-slate-700">Custom location<input value={customLocation} onChange={(event) => setCustomLocation(event.target.value)} className={fieldClass} /></label>}{postType !== "club" && <label className="text-sm font-bold text-slate-700">Tag a club (optional)<select value={taggedOrganizationId} onChange={(event) => setTaggedOrganizationId(event.target.value)} className={fieldClass}><option value="">No club tag</option>{availableOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>}<label className="text-sm font-bold text-slate-700">Expiration<select value={postType === "event" ? "24" : durationHours} disabled={postType === "event"} onChange={(event) => setDurationHours(event.target.value)} className={fieldClass}>{postType === "event" ? <option value="24">24 hours (Event default)</option> : personalDurationOptions.map((option) => <option key={option.hours} value={option.hours}>{option.label}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Mint privacy<select value={privacy} onChange={(event) => setPrivacy(event.target.value as SocialContentPrivacy)} className={fieldClass}><option value="account">Use account privacy</option><option value="public">Public within discovery scope</option><option value="connections">Connections only</option><option value="private">Only me</option></select></label></div>
          <fieldset><legend className="text-sm font-bold text-slate-700">Tagged users</legend><div className="mt-2 flex flex-wrap gap-2">{otherUsers.map((user) => <label key={user.account.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><input type="checkbox" className="mr-2" checked={taggedUserIds.includes(user.account.id)} onChange={() => setTaggedUserIds((current) => current.includes(user.account.id) ? current.filter((id) => id !== user.account.id) : [...current, user.account.id])} />@{user.profile.username}</label>)}</div></fieldset>
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><p className="font-bold">Music</p><p className="mt-1">No music selected. Licensed provider integration is intentionally not enabled.</p></div>
          <div className="flex flex-wrap gap-5"><label className="text-sm font-semibold"><input type="checkbox" className="mr-2" checked={commentsEnabled} onChange={(event) => setCommentsEnabled(event.target.checked)} />Comments enabled</label><label className="text-sm font-semibold"><input type="checkbox" className="mr-2" checked={likesVisible} onChange={(event) => setLikesVisible(event.target.checked)} />Show like count</label></div>
          <div className="flex gap-3"><button type="button" onClick={() => setStep("media")} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">Back</button><button className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ backgroundColor: postType === "event" ? "#059669" : theme.primary }}>Publish Mint</button></div>
        </form>}
      </section>
    </div>,
    document.body,
  );
}
