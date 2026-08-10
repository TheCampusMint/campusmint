"use client";

import { useMemo, useState, type FormEvent } from "react";

import { sampleEvents } from "@/data/events";
import { developmentOrganizations } from "@/data/organizations";
import { developmentBuildings } from "@/data/development/campusData";
import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import { universities, type UniversityTheme } from "@/data/universities";
import {
  createExpiresAt,
  EVENT_CONTENT_DURATION_HOURS,
  MAX_PERSONAL_MINT_DURATION_HOURS,
  MAX_STORY_DURATION_HOURS,
  personalMintDurationOptions,
  storyDurationOptions,
} from "@/lib/content/expiration";
import { parseHashtags } from "@/lib/content/hashtags";
import { zonedDateTimeToIso } from "@/lib/content/eventTiming";
import { normalizeUsername } from "@/lib/social/usernames";
import { canPostAsOrganization } from "@/lib/organizationPermissions";
import type {
  ContentDestination,
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
import type { Story, StoryAudience } from "@/types/story";

type CreateContentFlowProps = {
  viewer: CampusMintUser;
  users: CampusMintUser[];
  theme: UniversityTheme;
  onCreateMint: (input: CreateMintInput) => void;
  onCreateStory: (story: Story) => void;
  onClose: () => void;
  organizationMemberships: OrganizationMembership[];
  organizationRoles: OrganizationRoleAssignment[];
};

const fieldClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm";

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

export function CreateContentFlow({ viewer, users, theme, onCreateMint, onCreateStory, onClose, organizationMemberships, organizationRoles }: CreateContentFlowProps) {
  const [step, setStep] = useState<"media" | "settings">("media");
  const [destination, setDestination] = useState<ContentDestination>("mint");
  const [contentType, setContentType] = useState<SocialContentType>("text");
  const [postType, setPostType] = useState<SocialPostType>("personal");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [mentionInput, setMentionInput] = useState("");
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [likesVisible, setLikesVisible] = useState(true);
  const [privacy, setPrivacy] = useState<SocialContentPrivacy>("account");
  const [audience, setAudience] = useState<StoryAudience>("students-only");
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
  const network = getCampusNetworkForUniversity(viewer.account.universityId);
  const availableEvents = sampleEvents.filter((event) => theme.accessibleCampuses.includes(event.campus));
  const availableBuildings = developmentBuildings.filter((building) => building.universityId === viewer.account.universityId);
  const otherUsers = users.filter((user) => user.account.id !== viewer.account.id);
  const organizationActor = { id: viewer.account.id, universityId: viewer.account.universityId };
  const availableOrganizations = developmentOrganizations.filter((organization) =>
    organization.universityId === viewer.account.universityId,
  );
  const postableOrganizations = availableOrganizations.filter((organization) =>
    canPostAsOrganization(organizationActor, organization, organizationMemberships, organizationRoles),
  );
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
    const eventTimeZone = universities[viewer.account.universityId].timeZone;
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
      destination === "story" ? MAX_STORY_DURATION_HOURS : MAX_PERSONAL_MINT_DURATION_HOURS,
    );
    const eventData = resolvedEventData();
    const location = postType === "event" ? eventData?.location ?? null : resolvedLocation();
    const media = placeholderMedia(contentType);

    if (destination === "mint") {
      onCreateMint({
        publishFormat: "mint",
        authorId: viewer.account.id,
        universityId: viewer.account.universityId,
        campusNetworkId: network.id,
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
    } else {
      const initials = viewer.profile.photo.placeholderId ?? viewer.profile.firstName.slice(0, 2).toUpperCase();
      onCreateStory({
        id: `local-story-${globalThis.crypto.randomUUID()}`,
        publishFormat: "story",
        authorUserId: viewer.account.id,
        authorName: viewer.profile.displayName,
        authorUniversity: viewer.account.universityId,
        authorRole: viewer.account.role,
        avatarPlaceholder: initials,
        contentType,
        text: caption.trim(),
        postType,
        media,
        caption: caption.trim(),
        music: null,
        mentions: mentionMatches,
        taggedUserIds,
        location,
        eventData,
        organizationId: postType === "club" ? selectedOrganization!.id : undefined,
        taggedOrganizationIds: postType !== "club" && taggedOrganizationId ? [taggedOrganizationId] : [],
        organizationAudience: postType === "club" ? organizationAudience : "public",
        commentsEnabled,
        likesVisible,
        status: "active",
        imagePlaceholder: media.length ? "Development media placeholder" : undefined,
        category: postType === "event" ? "Campus Life" : postType === "club" ? "Club" : "Social",
        campus: viewer.account.universityId,
        audience,
        createdAt: now,
        expiresAt: expiresAt ?? createExpiresAt(now, 24, MAX_STORY_DURATION_HOURS)!,
        likeCount: 0,
        commentCount: 0,
        likedByCurrentUser: false,
        comments: [],
      });
    }
    onClose();
  }

  const personalDurationOptions = destination === "story"
    ? storyDurationOptions.map((hours) => ({ hours: String(hours), label: `${hours} hours` }))
    : personalMintDurationOptions.map((option) => ({ hours: option.hours === null ? "permanent" : String(option.hours), label: option.label }));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-3 sm:p-6" role="presentation">
      <section className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="create-content-title">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide" style={{ color: theme.primary }}>Local development flow</p><h2 id="create-content-title" className="mt-1 text-2xl font-black">Create content</h2></div><button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold">Close</button></div>

        {step === "media" ? <div className="mt-6 space-y-6"><fieldset><legend className="font-bold text-slate-900">1. Select media/content</legend><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{(["text", "image", "video", "carousel"] as SocialContentType[]).map((type) => <button key={type} type="button" onClick={() => setContentType(type)} className="rounded-xl border p-4 text-sm font-bold capitalize" style={{ borderColor: contentType === type ? theme.primary : "#e2e8f0", color: contentType === type ? theme.primary : "#475569" }}>{type === "carousel" ? "Multiple photos" : type}</button>)}</div><p className="mt-2 text-xs text-slate-500">Media uses development placeholders. No upload or licensed audio is enabled.</p></fieldset><fieldset><legend className="font-bold text-slate-900">2. Publish as</legend><div className="mt-3 grid grid-cols-2 gap-3">{(["mint", "story"] as ContentDestination[]).map((value) => <button key={value} type="button" onClick={() => { setDestination(value); setDurationHours(value === "story" ? "24" : "permanent"); }} className="rounded-xl border p-4 text-sm font-bold" style={{ borderColor: destination === value ? theme.primary : "#e2e8f0", color: destination === value ? theme.primary : "#475569" }}>{value === "mint" ? "Mint" : "Story"}</button>)}</div></fieldset><button type="button" onClick={() => setStep("settings")} className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ backgroundColor: theme.primary }}>Continue to settings</button></div> : <form onSubmit={submit} className="mt-6 space-y-6">
          <fieldset><legend className="font-bold text-slate-900">Content type</legend><p className="mt-1 text-xs text-slate-500">This is separate from the Mint or Story publish format.</p><div className="mt-3 grid grid-cols-3 gap-3">{(["personal", "event", "club"] as SocialPostType[]).map((value) => <button key={value} type="button" onClick={() => setPostType(value)} className="rounded-xl border p-4 text-sm font-bold capitalize" style={{ borderColor: postType === value ? (value === "event" ? "#059669" : theme.primary) : "#e2e8f0", color: postType === value ? (value === "event" ? "#047857" : theme.primary) : "#475569" }}>{value}</button>)}</div></fieldset>

          {postType === "event" && <fieldset className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-5"><legend className="px-2 font-black uppercase tracking-wide text-emerald-800">Event details · 24H</legend><label className="block text-sm font-bold text-emerald-950">Existing Campus Mint Event<select value={existingEventId} onChange={(event) => setExistingEventId(event.target.value)} className={fieldClass}><option value="">Informal/custom event</option>{availableEvents.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{!existingEventId && <><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-emerald-950">Event title<input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} className={fieldClass} /></label><label className="text-sm font-black uppercase text-emerald-950">When · Date<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className={fieldClass} /></label><label className="text-sm font-black uppercase text-emerald-950">When · Start time<input type="time" value={eventStartTime} onChange={(event) => setEventStartTime(event.target.value)} className={fieldClass} /></label><label className="text-sm font-bold text-emerald-950">End time (optional)<input type="time" value={eventEndTime} onChange={(event) => setEventEndTime(event.target.value)} className={fieldClass} /></label><label className="text-sm font-black uppercase text-emerald-950">Where<input value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} className={fieldClass} placeholder="Venue or general location" /></label><label className="text-sm font-bold text-emerald-950">Location details<input value={eventLocationDetails} onChange={(event) => setEventLocationDetails(event.target.value)} className={fieldClass} /></label></div><label className="mt-4 block text-sm font-bold text-emerald-950">Add details<textarea value={eventDescription} onChange={(event) => setEventDescription(event.target.value)} rows={3} className={fieldClass} /></label></>}</fieldset>}

          {postType === "club" && <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><legend className="px-2 font-black uppercase tracking-wide text-slate-800">Official club identity</legend>{postableOrganizations.length ? <><label className="block text-sm font-bold text-slate-800">Select Club<select required value={selectedOrganizationId} onChange={(event) => setSelectedOrganizationId(event.target.value)} className={fieldClass}><option value="">Choose an organization</option>{postableOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>{selectedOrganization && <p className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600">Publishing as <span className="font-black text-slate-900">{selectedOrganization.name}</span>. The Mint or Story stores only its organization ID.</p>}<label className="mt-4 block text-sm font-bold text-slate-800">Club content audience<select value={organizationAudience} onChange={(event) => setOrganizationAudience(event.target.value as OrganizationContentAudience)} className={fieldClass}><option value="public">Public club content</option><option value="members">Members only</option></select></label></> : <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">You do not hold a leader, officer, or approved publishing role for a club at this university. Create Personal content and tag a club instead.</p>}</fieldset>}

          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700 sm:col-span-2">Caption<textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={4} className={fieldClass} /></label><label className="text-sm font-bold text-slate-700">Hashtags<input value={hashtags} onChange={(event) => setHashtags(event.target.value)} className={fieldClass} placeholder="#Campus #StudyGroup" /></label><label className="text-sm font-bold text-slate-700">Mentions<input value={mentionInput} onChange={(event) => setMentionInput(event.target.value)} className={fieldClass} placeholder="@username" /></label>{postType !== "event" && <label className="text-sm font-bold text-slate-700">Location<select value={locationChoice} onChange={(event) => setLocationChoice(event.target.value)} className={fieldClass}><option value="none">No location</option>{availableBuildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}<option value="custom">Other / Custom Location</option></select></label>}{locationChoice === "custom" && postType !== "event" && <label className="text-sm font-bold text-slate-700">Custom location<input value={customLocation} onChange={(event) => setCustomLocation(event.target.value)} className={fieldClass} /></label>}{postType !== "club" && <label className="text-sm font-bold text-slate-700">Tag a club (optional)<select value={taggedOrganizationId} onChange={(event) => setTaggedOrganizationId(event.target.value)} className={fieldClass}><option value="">No club tag</option>{availableOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>}<label className="text-sm font-bold text-slate-700">Expiration<select value={postType === "event" ? "24" : durationHours} disabled={postType === "event"} onChange={(event) => setDurationHours(event.target.value)} className={fieldClass}>{postType === "event" ? <option value="24">24 hours (Event default)</option> : personalDurationOptions.map((option) => <option key={option.hours} value={option.hours}>{option.label}</option>)}</select></label>{destination === "mint" ? <label className="text-sm font-bold text-slate-700">Mint privacy<select value={privacy} onChange={(event) => setPrivacy(event.target.value as SocialContentPrivacy)} className={fieldClass}><option value="account">Use account privacy</option><option value="public">Public within discovery scope</option><option value="connections">Connections only</option><option value="private">Only me</option></select></label> : <label className="text-sm font-bold text-slate-700">Story audience<select value={audience} onChange={(event) => setAudience(event.target.value as StoryAudience)} className={fieldClass}><option value="students-only">Students only</option><option value="students-alumni">Students + alumni</option><option value="everyone">Everyone</option></select></label>}</div>
          <fieldset><legend className="text-sm font-bold text-slate-700">Tagged users</legend><div className="mt-2 flex flex-wrap gap-2">{otherUsers.map((user) => <label key={user.account.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><input type="checkbox" className="mr-2" checked={taggedUserIds.includes(user.account.id)} onChange={() => setTaggedUserIds((current) => current.includes(user.account.id) ? current.filter((id) => id !== user.account.id) : [...current, user.account.id])} />@{user.profile.username}</label>)}</div></fieldset>
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><p className="font-bold">Music</p><p className="mt-1">No music selected. Licensed provider integration is intentionally not enabled.</p></div>
          <div className="flex flex-wrap gap-5"><label className="text-sm font-semibold"><input type="checkbox" className="mr-2" checked={commentsEnabled} onChange={(event) => setCommentsEnabled(event.target.checked)} />Comments enabled</label><label className="text-sm font-semibold"><input type="checkbox" className="mr-2" checked={likesVisible} onChange={(event) => setLikesVisible(event.target.checked)} />Show like count</label></div>
          <div className="flex gap-3"><button type="button" onClick={() => setStep("media")} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">Back</button><button className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ backgroundColor: postType === "event" ? "#059669" : theme.primary }}>Publish {destination === "mint" ? "Mint" : "Story"}</button></div>
        </form>}
      </section>
    </div>
  );
}
