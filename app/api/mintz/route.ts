import { NextResponse } from "next/server";

import { configuredUniversityIds, universities, type UniversityId } from "@/data/universities";
import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabasePublicConfig, hasSupabaseServerConfig } from "@/lib/supabase/server";
import type { ContentLocation, ContentPoll, ContentPollInput, EventContentData, MusicMetadata, OrganizationContentAudience, SocialContentPrivacy, SocialPostType } from "@/types/content";
import type { Mint } from "@/types/mint";
import type { MintFeedResponse, MintPublishResponse } from "@/types/mintPersistence";
import type { CampusMintUser, ProfilePrivacySettings } from "@/types/profile";
import type { AccountCapability } from "@/types/accountCapabilities";
import { launchPublishedMediaPolicy } from "@/lib/content/mediaPolicy";
import { mintMediaFormats as mediaMimeTypes, matchesMintMediaSignature, validateMintStoredObject, validateMintUploadFiles, type MintUploadObject } from "@/lib/content/mintUploadPolicy";
import { createMintUploadTicket, verifyMintUploadTicket } from "@/lib/content/mintUploadTicket";
import { createPollDefinition, validatePollInput } from "@/lib/content/polls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };
const maxMediaItems = launchPublishedMediaPolicy.maxItemsPerMint;
const maxRequestMediaBytes = launchPublishedMediaPolicy.maxRequestBytes;
const signedUrlLifetimeSeconds = 60 * 60;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const defaultPrivacy: ProfilePrivacySettings = {
  bio: "everyone", major: "students_only", graduationYear: "students_only",
  classes: "friends_only", clubs: "students_only", interests: "everyone",
  roommate: "private", tutoring: "students_only", hometown: "private",
  instagram: "friends_only", linkedin: "everyone", portfolioUrl: "everyone",
  personalWebsite: "everyone",
};

type RawPublishPayload = {
  requestId?: unknown;
  caption?: unknown;
  postType?: unknown;
  privacy?: unknown;
  expiresAt?: unknown;
  commentsEnabled?: unknown;
  location?: unknown;
  eventData?: unknown;
  organizationId?: unknown;
  taggedOrganizationIds?: unknown;
  organizationAudience?: unknown;
  hashtags?: unknown;
  mentions?: unknown;
  taggedUserIds?: unknown;
  music?: unknown;
  mediaMetadata?: unknown;
  poll?: unknown;
};

type ValidatedPublishPayload = {
  requestId: string;
  caption: string;
  postType: SocialPostType;
  privacy: SocialContentPrivacy;
  expiresAt: string | null;
  commentsEnabled: boolean;
  location: ContentLocation | null;
  eventData: EventContentData | null;
  organizationId: string | null;
  taggedOrganizationIds: string[];
  organizationAudience: OrganizationContentAudience;
  hashtags: string[];
  mentionedUserIds: string[];
  taggedUserIds: string[];
  music: MusicMetadata | null;
  poll: ContentPollInput | null;
  mediaMetadata: Array<{
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
  }>;
};

type UploadedMedia = {
  storagePath: string;
  mediaType: "image" | "video";
  mimeType: string;
  byteSize: number;
  sortOrder: number;
};

function json<T>(body: T, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

function logFailure(operation: string, error: unknown) {
  if (process.env.NODE_ENV === "production") return;
  const candidate = error && typeof error === "object" ? error as Record<string, unknown> : null;
  console.error(`[api/mintz] ${operation}`, {
    code: candidate?.code ?? null,
    message: candidate?.message ?? String(error),
    details: candidate?.details ?? null,
    hint: candidate?.hint ?? null,
  });
}

function cleanString(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function nullableString(value: unknown, maximum: number) {
  return cleanString(value, maximum) || null;
}

function stringArray(value: unknown, maximum: number) {
  return Array.isArray(value)
    ? [...new Set(value.flatMap((item) => typeof item === "string" ? [item] : []).slice(0, maximum))]
    : [];
}

function uuidArray(value: unknown, maximum: number) {
  return stringArray(value, maximum).filter((item) => uuidPattern.test(item));
}

function parseLocation(value: unknown): ContentLocation | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const source = record.source;
  const label = cleanString(record.label, 240);
  if ((source !== "campus_entity" && source !== "event" && source !== "custom") || !label) return null;
  const entityId = typeof record.entityId === "string" && uuidPattern.test(record.entityId) ? record.entityId : null;
  if (source === "campus_entity" && !entityId) return null;
  return { source, entityId, label, details: nullableString(record.details, 1000) };
}

function parseEventData(value: unknown): EventContentData | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const eventStartAt = nullableString(record.eventStartAt, 64);
  const eventEndAt = nullableString(record.eventEndAt, 64);
  if (eventStartAt && !Number.isFinite(Date.parse(eventStartAt))) return null;
  if (eventEndAt && !Number.isFinite(Date.parse(eventEndAt))) return null;
  if (eventStartAt && eventEndAt && Date.parse(eventEndAt) <= Date.parse(eventStartAt)) return null;
  return {
    eventId: nullableString(record.eventId, 300),
    title: nullableString(record.title, 240),
    eventStartAt,
    eventEndAt,
    timeZone: nullableString(record.timeZone, 80),
    location: parseLocation(record.location),
    locationDetails: nullableString(record.locationDetails, 1000),
    description: nullableString(record.description, 5000),
  };
}

function parseMediaMetadata(value: unknown): ValidatedPublishPayload["mediaMetadata"] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxMediaItems).map((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const dimension = (candidate: unknown) =>
      typeof candidate === "number" && Number.isInteger(candidate) && candidate > 0 && candidate <= 20_000
        ? candidate
        : null;
    const durationSeconds = typeof record.durationSeconds === "number" && Number.isFinite(record.durationSeconds) && record.durationSeconds >= 0
      ? Math.min(record.durationSeconds, 24 * 60 * 60)
      : null;
    return {
      width: dimension(record.width),
      height: dimension(record.height),
      durationSeconds,
    };
  });
}

function validatePayload(value: unknown): { value: ValidatedPublishPayload | null; message: string | null } {
  if (!value || typeof value !== "object") return { value: null, message: "The Mint draft is invalid." };
  const raw = value as RawPublishPayload;
  const requestId = cleanString(raw.requestId, 36);
  if (!uuidPattern.test(requestId)) return { value: null, message: "The Mint request identifier is invalid." };
  const postType = raw.postType;
  if (postType !== "personal" && postType !== "event" && postType !== "club") return { value: null, message: "Choose a valid Mint type." };
  const privacy = raw.privacy;
  if (privacy !== "account" && privacy !== "public" && privacy !== "connections" && privacy !== "private") return { value: null, message: "Choose a valid Mint audience." };
  const expiresAt = nullableString(raw.expiresAt, 64);
  const expiresAtTime = expiresAt ? Date.parse(expiresAt) : null;
  if (expiresAt && !Number.isFinite(expiresAtTime)) return { value: null, message: "Choose a valid Mint duration." };
  const now = Date.now();
  const maximumLifetime = postType === "event" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  if (expiresAtTime !== null && (expiresAtTime <= now || expiresAtTime > now + maximumLifetime + 60_000)) {
    return { value: null, message: "Choose a supported Mint duration." };
  }
  if (postType === "event" && !expiresAt) return { value: null, message: "Event Mintz require an expiration time." };
  const organizationId = typeof raw.organizationId === "string" && uuidPattern.test(raw.organizationId) ? raw.organizationId : null;
  if (postType === "club" && !organizationId) return { value: null, message: "Choose a Club you can publish for." };
  const organizationAudience = raw.organizationAudience === "members" ? "members" : "public";
  const hashtags = stringArray(raw.hashtags, 30)
    .map((item) => item.toLocaleLowerCase().replace(/[^a-z0-9_]/g, ""))
    .filter(Boolean);
  const mentionedUserIds = Array.isArray(raw.mentions)
    ? uuidArray(raw.mentions.map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).userId : null), 30)
    : [];
  let poll: ContentPollInput | null;
  try { poll = validatePollInput(raw.poll); }
  catch (error) { return { value: null, message: error instanceof Error ? error.message : "The poll is invalid." }; }
  const eventData = parseEventData(raw.eventData);
  if (raw.eventData && !eventData) return { value: null, message: "Choose a valid event attachment." };
  if ((eventData?.eventId && !uuidPattern.test(eventData.eventId)) || (postType !== "event" && eventData && !eventData.eventId)) {
    return { value: null, message: "Choose an existing campus event to attach." };
  }
  return {
    value: {
      requestId,
      caption: cleanString(raw.caption, 10_000),
      postType,
      privacy,
      expiresAt,
      commentsEnabled: raw.commentsEnabled !== false,
      location: parseLocation(raw.location),
      eventData,
      organizationId,
      taggedOrganizationIds: uuidArray(raw.taggedOrganizationIds, 20),
      organizationAudience,
      hashtags: [...new Set(hashtags)],
      mentionedUserIds,
      taggedUserIds: uuidArray(raw.taggedUserIds, 30),
      // Music attachment is unavailable until provider rights are in place.
      music: null,
      poll,
      mediaMetadata: parseMediaMetadata(raw.mediaMetadata),
    },
    message: null,
  };
}

function mapPrivacy(row: Record<string, unknown> | null, key: keyof ProfilePrivacySettings) {
  const databaseKey = key === "portfolioUrl" ? "portfolio_url" : key === "personalWebsite" ? "personal_website" : key;
  return (row?.[databaseKey] as ProfilePrivacySettings[typeof key] | undefined) ?? defaultPrivacy[key];
}

function mapAuthor(
  profile: Record<string, unknown>,
  identity: Record<string, unknown>,
  privacy: Record<string, unknown> | null,
  capabilities: AccountCapability[],
): CampusMintUser {
  const knownUniversityId = configuredUniversityIds.includes(identity.university_id as UniversityId)
    ? identity.university_id as UniversityId
    : null;
  const universityId = knownUniversityId ?? "tamu";
  const userId = String(profile.user_id);
  return {
    account: {
      id: userId,
      accountType: identity.account_type === "creator" ? "creator" : "student",
      capabilities,
      universityId,
      universityIdentityId: knownUniversityId,
      knownUniversityId,
      role: identity.role === "alumni" || identity.role === "supporter" || identity.role === "university-admin" || identity.role === "local-business" ? identity.role : "student",
      verifiedStudent: identity.verified_student === true,
      verifiedAlumni: identity.verified_alumni === true,
      onboardingCompletedAt: String(profile.created_at),
      isDevelopment: false,
      createdAt: String(identity.created_at),
      updatedAt: String(identity.updated_at),
    },
    profile: {
      id: userId,
      accountId: userId,
      username: String(profile.username),
      usernameNormalized: String(profile.username_normalized),
      firstName: String(profile.first_name),
      lastName: String(profile.last_name),
      displayName: String(profile.display_name),
      photo: {
        kind: "initials",
        placeholderId: profile.profile_photo_placeholder ? String(profile.profile_photo_placeholder) : null,
        storagePath: profile.profile_photo_storage_path ? String(profile.profile_photo_storage_path) : null,
      },
      bio: profile.bio ? String(profile.bio) : null,
      major: profile.major ? String(profile.major) : null,
      academicArea: profile.major ? String(profile.major) : null,
      graduationYear: typeof profile.graduation_year === "number" ? profile.graduation_year : null,
      classIds: [],
      clubIds: [],
      interests: Array.isArray(profile.interests) ? profile.interests.filter((item): item is string => typeof item === "string") : [],
      hometown: profile.hometown ? String(profile.hometown) : null,
      instagram: profile.instagram ? String(profile.instagram) : null,
      linkedin: profile.linkedin ? String(profile.linkedin) : null,
      portfolioUrl: profile.portfolio_url ? String(profile.portfolio_url) : null,
      personalWebsite: profile.personal_website ? String(profile.personal_website) : null,
      createdAt: String(profile.created_at),
      updatedAt: String(profile.updated_at),
    },
    privacy: {
      bio: mapPrivacy(privacy, "bio"), major: mapPrivacy(privacy, "major"), graduationYear: mapPrivacy(privacy, "graduationYear"),
      classes: mapPrivacy(privacy, "classes"), clubs: mapPrivacy(privacy, "clubs"), interests: mapPrivacy(privacy, "interests"),
      roommate: mapPrivacy(privacy, "roommate"), tutoring: mapPrivacy(privacy, "tutoring"), hometown: mapPrivacy(privacy, "hometown"),
      instagram: mapPrivacy(privacy, "instagram"), linkedin: mapPrivacy(privacy, "linkedin"), portfolioUrl: mapPrivacy(privacy, "portfolioUrl"),
      personalWebsite: mapPrivacy(privacy, "personalWebsite"),
    },
    socialSettings: {
      accountType: profile.social_account_type === "public" ? "public" : "private",
      discoveryScope: profile.social_discovery_scope === "community" || profile.social_discovery_scope === "campus_network"
        ? profile.social_discovery_scope
        : "university",
    },
  };
}

async function signedMediaUrls(admin: ReturnType<typeof createSupabaseAdminClient>, rows: Array<Record<string, unknown>>) {
  const paths = rows.map((row) => String(row.storage_path));
  if (paths.length === 0) return new Map<string, string>();
  const { data, error } = await admin.storage.from("mint-media").createSignedUrls(paths, signedUrlLifetimeSeconds);
  if (error) throw error;
  return new Map(paths.map((path, index) => [path, data[index]?.signedUrl ?? ""]));
}

async function loadMintFeed(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  viewerId: string,
  onlyContentId: string | null = null,
  previewUniversityId: UniversityId | null = null,
): Promise<{ mintz: Mint[]; authors: CampusMintUser[] }> {
  const { data: viewerIdentity, error: viewerError } = await admin.from("profile_identities")
    .select("user_id,university_id")
    .eq("user_id", viewerId)
    .maybeSingle();
  if (viewerError || !viewerIdentity) throw viewerError ?? new Error("Verified profile identity is missing.");

  let contentQuery = admin.from("social_content")
    .select("id,author_id,university_id,campus_network_id,content_type,post_type,caption,location_id,event_details_id,music_provider,music_track_id,music_track_title,music_artist,music_artwork_url,music_preview_url,comments_enabled,likes_visible,status,expires_at,created_at,updated_at,organization_id,organization_audience,poll_definition")
    .eq("kind", "mint")
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (onlyContentId) contentQuery = contentQuery.eq("id", onlyContentId);
  if (previewUniversityId) contentQuery = contentQuery.in("university_id", universities[previewUniversityId].accessibleCampuses);
  const { data: contentRows, error: contentError } = await contentQuery;
  if (contentError) throw contentError;
  const contentIds = (contentRows ?? []).map((row) => row.id);
  if (contentIds.length === 0) return { mintz: [], authors: [] };
  const emptyRelationId = "00000000-0000-0000-0000-000000000000";
  const locationIds = (contentRows ?? []).flatMap((row) => row.location_id ? [row.location_id] : []);
  const eventDetailsIds = (contentRows ?? []).flatMap((row) => row.event_details_id ? [row.event_details_id] : []);

  const [mintResult, mediaResult, hashtagResult, mentionResult, tagResult, locationResult, eventResult, membershipResult, followResult, friendshipResult, blockResult, organizationTagResult, authorPrivacyResult, viewCountResult] = await Promise.all([
    admin.from("mints").select("content_id,privacy,archived_at").in("content_id", contentIds),
    admin.from("content_media").select("id,content_id,media_type,storage_path,thumbnail_storage_path,width,height,duration_seconds,sort_order,mime_type,byte_size").in("content_id", contentIds).order("sort_order"),
    admin.from("content_hashtags").select("content_id,hashtag_normalized").in("content_id", contentIds),
    admin.from("content_mentions").select("content_id,mentioned_user_id").in("content_id", contentIds),
    admin.from("content_tags").select("content_id,tagged_user_id").in("content_id", contentIds),
    admin.from("content_locations").select("id,source,campus_entity_id,canonical_event_key,label,details").in("id", locationIds.length > 0 ? locationIds : [emptyRelationId]),
    admin.from("content_event_details").select("id,canonical_event_key,title,event_start_at,event_end_at,event_timezone,location_id,location_details,description").in("id", eventDetailsIds.length > 0 ? eventDetailsIds : [emptyRelationId]),
    admin.from("organization_memberships").select("organization_id,status").eq("user_id", viewerId).in("status", ["member", "leader"]),
    admin.from("profile_follows").select("follower_id,following_id").or(`follower_id.eq.${viewerId},following_id.eq.${viewerId}`),
    admin.from("friendships").select("requester_id,addressee_id,status").or(`requester_id.eq.${viewerId},addressee_id.eq.${viewerId}`).eq("status", "friends"),
    admin.from("profile_blocks").select("blocker_id,blocked_id").or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`),
    admin.from("content_tagged_organizations").select("content_id,organization_id").in("content_id", contentIds),
    admin.from("profiles").select("user_id,social_account_type").in("user_id", [...new Set((contentRows ?? []).map((row) => row.author_id))]),
    admin.from("feed_view_counts").select("mint_id,view_count").in("mint_id",contentIds),
  ]);
  for (const result of [mintResult, mediaResult, hashtagResult, mentionResult, tagResult, locationResult, eventResult, membershipResult, followResult, friendshipResult, blockResult, organizationTagResult, authorPrivacyResult, viewCountResult]) {
    if (result.error) throw result.error;
  }

  const mintById = new Map((mintResult.data ?? []).map((row) => [row.content_id, row]));
  const authorPrivacyById = new Map((authorPrivacyResult.data ?? []).map((row) => [row.user_id, row.social_account_type]));
  const blockedIds = new Set((blockResult.data ?? []).map((row) => row.blocker_id === viewerId ? row.blocked_id : row.blocker_id));
  const connectedIds = new Set<string>();
  (followResult.data ?? []).forEach((row) => connectedIds.add(row.follower_id === viewerId ? row.following_id : row.follower_id));
  (friendshipResult.data ?? []).forEach((row) => connectedIds.add(row.requester_id === viewerId ? row.addressee_id : row.requester_id));
  const memberOrganizationIds = new Set((membershipResult.data ?? []).map((row) => row.organization_id));
  let visibleRows = (contentRows ?? []).filter((row) => {
    const mint = mintById.get(row.id);
    if (!mint || mint.archived_at || blockedIds.has(row.author_id)) return false;
    // Campus testing is a public browsing context, never another student's
    // identity or a bypass for campus-only, private or Club-member content.
    if (previewUniversityId && (mint.privacy !== "public" || authorPrivacyById.get(row.author_id) !== "public" || row.organization_audience === "members")) return false;
    if (row.author_id === viewerId) return true;
    if (!authorPrivacyById.has(row.author_id) || (authorPrivacyById.get(row.author_id) === "private" && !connectedIds.has(row.author_id))) return false;
    if (row.organization_audience === "members" && row.organization_id && !memberOrganizationIds.has(row.organization_id)) return false;
    if (mint.privacy === "public") return true;
    if (mint.privacy === "connections") return connectedIds.has(row.author_id);
    if (mint.privacy === "private") return false;
    return Boolean(row.university_id && viewerIdentity.university_id && row.university_id === viewerIdentity.university_id);
  });
  const visibleIds = new Set(visibleRows.map((row) => row.id));
  const taggedOrganizationIds = [...new Set((organizationTagResult.data ?? []).filter((row) => visibleIds.has(row.content_id)).map((row) => row.organization_id))];
  const taggedOrganizationNames = new Map<string, string>();
  if (taggedOrganizationIds.length > 0) {
    const { data, error } = await admin.from("organizations").select("id,name").in("id", taggedOrganizationIds)
      .eq("status", "active").eq("is_development", false).in("official_status", ["university_verified", "community_verified"])
      .in("confidence_level", ["official", "community_verified"]);
    if (error) throw error;
    (data ?? []).forEach((row) => taggedOrganizationNames.set(row.id, row.name));
  }
  const polls = new Map<string, ContentPoll>();
  await Promise.all(visibleRows.filter((row) => row.poll_definition).map(async (row) => {
    const { data, error } = await admin.rpc("read_mint_poll", { target_content_id: row.id, viewer_id: viewerId });
    // Privacy or expiry can change after the initial feed query. Hide that one
    // post instead of leaking its media or failing the rest of the feed.
    if (error?.code === "P0002") { visibleIds.delete(row.id); return; }
    if (error) throw error;
    if (data) polls.set(row.id, data as ContentPoll);
  }));
  visibleRows = visibleRows.filter((row) => visibleIds.has(row.id));
  const visibleMedia = (mediaResult.data ?? []).filter((row) => visibleIds.has(row.content_id));
  const mediaUrls = await signedMediaUrls(admin, visibleMedia);
  const authorIds = [...new Set(visibleRows.map((row) => row.author_id))];
  const [profilesResult, identitiesResult, privacyResult, capabilityResult] = await Promise.all([
    admin.from("profiles").select("*").in("user_id", authorIds),
    admin.from("profile_identities").select("*").in("user_id", authorIds),
    admin.from("profile_privacy_settings").select("*").in("user_id", authorIds),
    admin.from("account_capabilities").select("user_id,capability").in("user_id", authorIds).is("revoked_at", null),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (identitiesResult.error) throw identitiesResult.error;
  if (privacyResult.error) throw privacyResult.error;
  if (capabilityResult.error) throw capabilityResult.error;
  const identities = new Map((identitiesResult.data ?? []).map((row) => [row.user_id, row]));
  const privacy = new Map((privacyResult.data ?? []).map((row) => [row.user_id, row]));
  const capabilities = new Map<string, AccountCapability[]>();
  (capabilityResult.data ?? []).forEach((row) => capabilities.set(row.user_id, [...(capabilities.get(row.user_id) ?? []), row.capability as AccountCapability]));
  const authors = (profilesResult.data ?? []).flatMap((profile) => {
    const identity = identities.get(profile.user_id);
    if (!identity) return [];
    const fieldPrivacy = privacy.get(profile.user_id) ?? null;
    const author = mapAuthor(profile, identity, fieldPrivacy, capabilities.get(profile.user_id) ?? []);
    if (previewUniversityId) {
      author.account.capabilities = author.account.capabilities?.filter((capability) => capability === "creator");
      // Only public profile details accompany a campus preview response.
      for (const field of ["bio", "major", "graduationYear", "hometown", "instagram", "linkedin", "portfolioUrl", "personalWebsite"] as const) {
        if (author.privacy[field] !== "everyone") author.profile[field] = null;
      }
      author.profile.academicArea = author.profile.major;
      if (author.privacy.interests !== "everyone") author.profile.interests = [];
    }
    return [author];
  });
  const authorById = new Map(authors.map((author) => [author.account.id, author]));
  const locations = new Map((locationResult.data ?? []).map((row) => [row.id, row]));
  const events = new Map((eventResult.data ?? []).map((row) => [row.id, row]));

  const mintz = visibleRows.flatMap((row): Mint[] => {
    if (!authorById.has(row.author_id)) return [];
    const mint = mintById.get(row.id);
    if (!mint) return [];
    const locationRow = row.location_id ? locations.get(row.location_id) : null;
    const eventRow = row.event_details_id ? events.get(row.event_details_id) : null;
    const mappedLocation: ContentLocation | null = locationRow ? {
      source: locationRow.source,
      entityId: locationRow.campus_entity_id,
      label: locationRow.label,
      details: locationRow.details,
    } : null;
    const mappedMedia = visibleMedia
      .filter((media) => media.content_id === row.id)
      .map((media) => ({
        id: media.id,
        type: media.media_type,
        url: mediaUrls.get(media.storage_path) || null,
        thumbnailUrl: media.thumbnail_storage_path ? mediaUrls.get(media.thumbnail_storage_path) || null : null,
        width: media.width,
        height: media.height,
        durationSeconds: media.duration_seconds === null ? null : Number(media.duration_seconds),
        order: media.sort_order,
        isDevelopmentPlaceholder: false,
      }));
    return [{
      id: row.id,
      publishFormat: "mint",
      authorId: row.author_id,
      universityId: row.university_id as UniversityId | null,
      universityIdentityId: row.university_id,
      knownUniversityId: row.university_id as UniversityId | null,
      campusNetworkId: row.campus_network_id,
      contentType: row.content_type,
      postType: row.post_type,
      media: mappedMedia,
      caption: row.caption,
      poll: polls.get(row.id) ?? null,
      hashtags: (hashtagResult.data ?? []).filter((item) => item.content_id === row.id).map((item) => item.hashtag_normalized),
      mentions: (mentionResult.data ?? []).filter((item) => item.content_id === row.id).flatMap((item) => {
        const mentioned = authorById.get(item.mentioned_user_id);
        return mentioned ? [{ userId: item.mentioned_user_id, username: mentioned.profile.username }] : [];
      }),
      taggedUserIds: (tagResult.data ?? []).filter((item) => item.content_id === row.id).map((item) => item.tagged_user_id),
      location: mappedLocation,
      music: row.music_provider && row.music_track_id && row.music_track_title && row.music_artist ? {
        provider: row.music_provider,
        trackId: row.music_track_id,
        trackTitle: row.music_track_title,
        artist: row.music_artist,
        artworkUrl: row.music_artwork_url,
        previewUrl: row.music_preview_url,
      } : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      commentsEnabled: row.comments_enabled,
      likesVisible: row.likes_visible,
      eventData: eventRow ? {
        eventId: eventRow.canonical_event_key,
        title: eventRow.title,
        eventStartAt: eventRow.event_start_at,
        eventEndAt: eventRow.event_end_at,
        timeZone: eventRow.event_timezone,
        location: eventRow.location_id === row.location_id ? mappedLocation : null,
        locationDetails: eventRow.location_details,
        description: eventRow.description,
      } : null,
      organizationId: row.organization_id,
      taggedOrganizationIds: (organizationTagResult.data ?? []).filter((item) => item.content_id === row.id).map((item) => item.organization_id),
      taggedOrganizations: (organizationTagResult.data ?? []).filter((item) => item.content_id === row.id).flatMap((item) => {
        const name = taggedOrganizationNames.get(item.organization_id);
        return name ? [{ id: item.organization_id, name }] : [];
      }),
      organizationAudience: row.organization_audience,
      status: row.status,
      privacy: mint.privacy,
      likeCount: 0,
      viewCount: viewCountResult.data?.find(item => item.mint_id === row.id)?.view_count ?? 0,
      commentCount: 0,
      saveCount: 0,
      shareCount: 0,
      repostCount: 0,
      archivedAt: mint.archived_at,
      isDevelopment: false,
    }];
  });
  return { mintz, authors };
}

async function removeUploadedMedia(admin: ReturnType<typeof createSupabaseAdminClient>, paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await admin.storage.from("mint-media").remove(paths);
  if (error) logFailure("orphaned media cleanup failed", error);
}

async function verifyUploadedObject(admin: ReturnType<typeof createSupabaseAdminClient>, item: MintUploadObject): Promise<UploadedMedia> {
  const bucket = admin.storage.from("mint-media");
  const { data: info, error: infoError } = await bucket.info(item.storagePath);
  if (infoError || !info) throw new Error("A media upload is incomplete. Retry publishing.");
  const { data: download, error: downloadError } = await bucket.createSignedUrl(item.storagePath, 60);
  if (downloadError || !download) throw new Error("The uploaded media could not be checked. Retry publishing.");
  // The URL comes only from our private bucket. Read a small prefix even if a
  // storage proxy ignores Range; never buffer a full 100 MB video in this route.
  const response = await fetch(download.signedUrl, {
    headers: { Range: "bytes=0-511" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok || !response.body) throw new Error("The uploaded media could not be checked. Retry publishing.");
  const reader = response.body.getReader();
  const prefix = new Uint8Array(512);
  let length = 0;
  try {
    while (length < prefix.length) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, prefix.length - length);
      prefix.set(chunk, length);
      length += chunk.length;
    }
  } finally {
    await reader.cancel();
  }
  validateMintStoredObject(item, info, prefix.subarray(0, length));
  return { ...item, mediaType: mediaMimeTypes.get(item.mimeType)!.type };
}

export async function GET(request: Request) {
  if (!hasSupabasePublicConfig() || !hasSupabaseServerConfig()) {
    return json<MintFeedResponse>({ ok: false, message: "Mint publishing is not configured." }, 503);
  }
  const session = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await session.auth.getUser();
  if (userError || !user) return json<MintFeedResponse>({ ok: false, message: "Sign in to view Mintz." }, 401);
  try {
    const admin = createSupabaseAdminClient();
    const requestedCampus = new URL(request.url).searchParams.get("universityId");
    if (requestedCampus !== null && !configuredUniversityIds.includes(requestedCampus as UniversityId)) {
      return json<MintFeedResponse>({ ok: false, message: "Unknown campus context." }, 400);
    }
    if (requestedCampus) {
      const { data: tester, error } = await admin.from("account_capabilities").select("capability")
        .eq("user_id", user.id).eq("capability", "owner_campus_tester").is("revoked_at", null).maybeSingle();
      if (error) throw error;
      if (!tester) return json<MintFeedResponse>({ ok: false, message: "Campus test access is required." }, 403);
    }
    const result = await loadMintFeed(admin, user.id, null, requestedCampus as UniversityId | null);
    return json<MintFeedResponse>({ ok: true, ...result });
  } catch (error) {
    logFailure("feed load failed", error);
    return json<MintFeedResponse>({ ok: false, message: "Mintz are temporarily unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  if (!hasSupabasePublicConfig() || !hasSupabaseServerConfig()) {
    return json<MintPublishResponse>({ ok: false, message: "Mint publishing is not configured.", retryable: false }, 503);
  }
  const session = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await session.auth.getUser();
  if (userError || !user) return json<MintPublishResponse>({ ok: false, message: "Sign in again before publishing.", retryable: false }, 401);

  let rawPayload: unknown;
  let files: File[] = [];
  let action: "prepare" | "publish" = "publish";
  let declaredFiles: unknown = [];
  let uploadTicket: unknown;
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json();
      if (!body || typeof body !== "object" || (body.action !== "prepare" && body.action !== "publish")) throw new Error("Invalid action");
      action = body.action;
      rawPayload = body.payload;
      declaredFiles = body.files;
      uploadTicket = body.uploadTicket;
    } else {
      // Retain compatibility with older tabs for small uploads. New clients send
      // binary data directly to Storage so the hosting request limit cannot reject it.
      const formData = await request.formData();
      rawPayload = JSON.parse(String(formData.get("payload") ?? ""));
      files = formData.getAll("media").filter((value): value is File => value instanceof File);
    }
  } catch {
    return json<MintPublishResponse>({ ok: false, message: "The Mint draft is invalid.", retryable: false }, 400);
  }
  const parsed = validatePayload(rawPayload);
  if (!parsed.value) return json<MintPublishResponse>({ ok: false, message: parsed.message ?? "The Mint draft is invalid.", retryable: false }, 400);
  const payload = parsed.value;
  let directMedia: MintUploadObject[] = [];
  let preparedFiles: ReturnType<typeof validateMintUploadFiles> = [];
  try {
    if (action === "prepare") preparedFiles = validateMintUploadFiles(declaredFiles);
    else if (uploadTicket !== undefined) {
      directMedia = verifyMintUploadTicket(uploadTicket, user.id, payload.requestId, process.env.SUPABASE_SERVICE_ROLE_KEY!).files;
    }
  } catch (error) {
    return json<MintPublishResponse>({ ok: false, message: error instanceof Error ? error.message : "The media upload is invalid.", retryable: true }, 400);
  }
  if (files.length > maxMediaItems) return json<MintPublishResponse>({ ok: false, message: `Choose no more than ${maxMediaItems} media items.`, retryable: false }, 413);
  let totalBytes = 0;
  for (const file of files) {
    const accepted = mediaMimeTypes.get(file.type);
    if (!accepted) return json<MintPublishResponse>({ ok: false, message: `${file.name || "A file"} uses an unsupported format.`, retryable: false }, 415);
    if (file.size < 1 || file.size > accepted.maximum) return json<MintPublishResponse>({ ok: false, message: `${file.name || "A file"} exceeds the ${accepted.type === "image" ? "12 MB image" : "100 MB video"} limit.`, retryable: false }, 413);
    totalBytes += file.size;
  }
  if (totalBytes > maxRequestMediaBytes) return json<MintPublishResponse>({ ok: false, message: "The selected media exceeds the 150 MB total upload limit.", retryable: false }, 413);
  if (files.length + directMedia.length + preparedFiles.length === 0 && !payload.caption && !payload.poll && !payload.eventData?.eventId && !payload.eventData?.title && !payload.eventData?.description) {
    return json<MintPublishResponse>({ ok: false, message: "Add text or media before publishing.", retryable: false }, 400);
  }

  const admin = createSupabaseAdminClient();
  try {
    const { data: existing, error: existingError } = await admin.from("social_content")
      .select("id")
      .eq("author_id", user.id)
      .eq("client_request_id", payload.requestId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      const persisted = await loadMintFeed(admin, user.id, existing.id);
      const mint = persisted.mintz[0];
      const author = persisted.authors.find((candidate) => candidate.account.id === user.id);
      if (mint && author) return json<MintPublishResponse>({ ok: true, mint, author, deduplicated: true });
    }

    const [{ data: identity, error: identityError }, { data: profile, error: profileError }, { data: creatorCapability, error: creatorCapabilityError }] = await Promise.all([
      admin.from("profile_identities").select("user_id,university_id,account_type,verified_student").eq("user_id", user.id).maybeSingle(),
      admin.from("profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
      admin.from("account_capabilities").select("capability").eq("user_id", user.id).eq("capability", "creator").is("revoked_at", null).maybeSingle(),
    ]);
    if (identityError || profileError || creatorCapabilityError) throw identityError ?? profileError ?? creatorCapabilityError;
    const verifiedStudent = identity?.account_type === "student" && identity.verified_student === true && Boolean(identity.university_id);
    const approvedCreator = Boolean(creatorCapability);
    if (!identity || !profile || (!verifiedStudent && !approvedCreator)) {
      return json<MintPublishResponse>({ ok: false, message: "A verified Student or approved Creator profile is required to publish.", retryable: false }, 403);
    }
    const { data: network, error: networkError } = identity.university_id
      ? await admin.from("campus_network_universities").select("campus_network_id").eq("university_id", identity.university_id).maybeSingle()
      : { data: null, error: null };
    if (networkError) throw networkError;
    if (verifiedStudent && !network) return json<MintPublishResponse>({ ok: false, message: "Your university does not have a publishing network yet.", retryable: false }, 409);

    if (payload.taggedOrganizationIds.length > 0) {
      const accessibleCampuses = universities[identity.university_id as UniversityId]?.accessibleCampuses ?? [];
      const { data: organizations, error } = await admin.from("organizations").select("id")
        .in("id", payload.taggedOrganizationIds).in("university_id", accessibleCampuses)
        .eq("status", "active").eq("is_development", false).in("official_status", ["university_verified", "community_verified"])
        .in("confidence_level", ["official", "community_verified"]);
      if (error) throw error;
      if (organizations?.length !== payload.taggedOrganizationIds.length) return json<MintPublishResponse>({ ok: false, message: "A selected Club is no longer available. Update your Club attachment.", retryable: false }, 400);
    }

    const attachedClubs = [...new Set([...payload.taggedOrganizationIds, ...(payload.organizationId ? [payload.organizationId] : [])])];
    if (attachedClubs.length) {
      const memberships = await admin.from("organization_memberships").select("organization_id")
        .eq("user_id", user.id).in("organization_id", attachedClubs).in("status", ["member", "officer", "leader"]);
      if (memberships.error) throw memberships.error;
      const joined = new Set((memberships.data ?? []).map((row) => row.organization_id));
      if (attachedClubs.some((id) => !joined.has(id))) return json<MintPublishResponse>({ ok: false, message: "Join the Club and wait for acceptance before attaching its badge.", retryable: false }, 403);
    }

    if (payload.eventData?.eventId) {
      const accessibleCampuses = universities[identity.university_id as UniversityId]?.accessibleCampuses ?? [];
      const { data: event, error: eventError } = await admin.from("campus_events")
        .select("id,title,starts_at,ends_at,timezone,location_name,brief_description,campus_id,status")
        .eq("id", payload.eventData.eventId).in("campus_id", accessibleCampuses)
        .in("status", ["scheduled", "updated"]).maybeSingle();
      if (eventError) throw eventError;
      if (!event || !Number.isFinite(Date.parse(event.ends_at ?? event.starts_at)) || Date.parse(event.ends_at ?? event.starts_at) <= Date.now()) {
        return json<MintPublishResponse>({ ok: false, message: "That campus event is no longer available. Choose another event.", retryable: false }, 400);
      }
      payload.eventData = {
        eventId: event.id, title: event.title, eventStartAt: event.starts_at, eventEndAt: event.ends_at,
        timeZone: event.timezone, location: { source: "event", entityId: event.id, label: event.location_name, details: null },
        locationDetails: null, description: event.brief_description,
      };
    }

    if (payload.organizationId) {
      const { data: publishingRole, error: roleError } = await admin.from("organization_roles")
        .select("id")
        .eq("organization_id", payload.organizationId)
        .eq("user_id", user.id)
        .eq("can_publish", true)
        .limit(1)
        .maybeSingle();
      if (roleError) throw roleError;
      if (!publishingRole) return json<MintPublishResponse>({ ok: false, message: "You are not authorized to publish for that Club.", retryable: false }, 403);
    }

    if (action === "prepare") {
      const prepared = createMintUploadTicket(user.id, payload.requestId, preparedFiles, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      // Queue cleanup before granting upload access. The 24-hour delay is well
      // beyond the two-hour ticket lifetime, so abandoned uploads cannot race a
      // still-authorized finalize. The worker rechecks published references too.
      if (prepared.files.length > 0) {
        const { error } = await admin.from("media_cleanup_jobs").insert(prepared.files.map((item) => ({
          bucket_id: "mint-media",
          storage_path: item.storagePath,
          due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })));
        if (error) throw error;
      }
      const destinations = await Promise.all(prepared.files.map(async (item) => {
        const { data, error } = await admin.storage.from("mint-media").createSignedUploadUrl(item.storagePath, { upsert: false });
        if (error || !data) throw error ?? new Error("Upload authorization failed");
        return { storagePath: item.storagePath, sortOrder: item.sortOrder, token: data.token };
      }));
      return json({ ok: true, upload: { ticket: prepared.ticket, files: destinations } });
    }

    const attemptId = crypto.randomUUID();
    const uploaded: UploadedMedia[] = [];
    let locationId: string | null = null;
    let eventDetailsId: string | null = null;
    let contentId: string | null = null;
    const rollbackDatabase = async () => {
      if (contentId) await admin.from("social_content").delete().eq("id", contentId);
      if (eventDetailsId) await admin.from("content_event_details").delete().eq("id", eventDetailsId);
      if (locationId) await admin.from("content_locations").delete().eq("id", locationId);
    };
    try {
      if (directMedia.length > 0) {
        // Signed paths bind the objects to this account and request. Re-check
        // stored bytes/MIME, rather than trusting the browser's claimed metadata.
        uploaded.push(...await Promise.all(directMedia.map((item) => verifyUploadedObject(admin, item))));
      }
      for (const [sortOrder, file] of files.entries()) {
        const accepted = mediaMimeTypes.get(file.type)!;
        if (!matchesMintMediaSignature(new Uint8Array(await file.slice(0, 512).arrayBuffer()), file.type)) {
          throw new Error("A selected file does not contain a supported photo or video.");
        }
        const storagePath = `${user.id}/${payload.requestId}/${attemptId}/${sortOrder}-${crypto.randomUUID()}.${accepted.extension}`;
        const { error: uploadError } = await admin.storage.from("mint-media").upload(storagePath, file, {
          contentType: file.type,
          cacheControl: "31536000",
          upsert: false,
        });
        if (uploadError) throw uploadError;
        uploaded.push({ storagePath, mediaType: accepted.type, mimeType: file.type, byteSize: file.size, sortOrder });
      }

      const location = payload.postType === "event" ? payload.eventData?.location ?? null : payload.location ?? payload.eventData?.location ?? null;
      if (location) {
        const { data, error } = await admin.from("content_locations").insert({
          source: location.source,
          campus_entity_id: location.source === "campus_entity" ? location.entityId : null,
          canonical_event_key: location.source === "event" ? location.entityId : null,
          label: location.label,
          details: location.details,
          created_by: user.id,
        }).select("id").single();
        if (error) throw error;
        locationId = data.id;
      }
      if (payload.eventData) {
        const { data, error } = await admin.from("content_event_details").insert({
          canonical_event_key: payload.eventData.eventId,
          title: payload.eventData.title,
          event_start_at: payload.eventData.eventStartAt,
          event_end_at: payload.eventData.eventEndAt,
          event_timezone: payload.eventData.timeZone,
          location_id: locationId,
          location_details: payload.eventData.locationDetails,
          description: payload.eventData.description,
          created_by: user.id,
        }).select("id").single();
        if (error) throw error;
        eventDetailsId = data.id;
      }
      const contentType = uploaded.length > 1 ? "carousel" : uploaded[0]?.mediaType ?? "text";
      const { data: content, error: contentError } = await admin.from("social_content").insert({
        kind: "mint",
        author_id: user.id,
        university_id: identity.university_id,
        campus_network_id: network?.campus_network_id ?? null,
        content_type: contentType,
        post_type: payload.postType,
        caption: payload.caption,
        poll_definition: payload.poll ? createPollDefinition(payload.poll) : null,
        location_id: locationId,
        event_details_id: eventDetailsId,
        music_provider: payload.music?.provider ?? null,
        music_track_id: payload.music?.trackId ?? null,
        music_track_title: payload.music?.trackTitle ?? null,
        music_artist: payload.music?.artist ?? null,
        music_artwork_url: payload.music?.artworkUrl ?? null,
        music_preview_url: payload.music?.previewUrl ?? null,
        comments_enabled: payload.commentsEnabled,
        likes_visible: false,
        expires_at: payload.expiresAt,
        organization_id: payload.organizationId,
        organization_audience: payload.organizationAudience,
        client_request_id: payload.requestId,
      }).select("id").single();
      if (contentError) throw contentError;
      contentId = content.id;
      const { error: mintError } = await admin.from("mints").insert({ content_id: contentId, privacy: payload.privacy });
      if (mintError) { await rollbackDatabase(); throw mintError; }
      if (uploaded.length > 0) {
        const { error: mediaError } = await admin.from("content_media").insert(uploaded.map((item) => ({
          content_id: contentId,
          media_type: item.mediaType,
          storage_path: item.storagePath,
          sort_order: item.sortOrder,
          mime_type: item.mimeType,
          byte_size: item.byteSize,
          width: payload.mediaMetadata[item.sortOrder]?.width ?? null,
          height: payload.mediaMetadata[item.sortOrder]?.height ?? null,
          duration_seconds: payload.mediaMetadata[item.sortOrder]?.durationSeconds ?? null,
        })));
        if (mediaError) { await rollbackDatabase(); throw mediaError; }
      }
      if (payload.hashtags.length > 0) {
        const { error: hashtagsError } = await admin.from("hashtags").upsert(payload.hashtags.map((tag) => ({ normalized_value: tag, display_value: tag })), { onConflict: "normalized_value" });
        if (hashtagsError) { await rollbackDatabase(); throw hashtagsError; }
        const { error: linksError } = await admin.from("content_hashtags").insert(payload.hashtags.map((tag) => ({ content_id: contentId, hashtag_normalized: tag })));
        if (linksError) { await rollbackDatabase(); throw linksError; }
      }
      if (payload.mentionedUserIds.length > 0) {
        const { error } = await admin.from("content_mentions").insert(payload.mentionedUserIds.map((mentionedUserId) => ({ content_id: contentId, mentioned_user_id: mentionedUserId })));
        if (error) { await rollbackDatabase(); throw error; }
      }
      if (payload.taggedUserIds.length > 0) {
        const { error } = await admin.from("content_tags").insert(payload.taggedUserIds.map((taggedUserId) => ({ content_id: contentId, tagged_user_id: taggedUserId })));
        if (error) { await rollbackDatabase(); throw error; }
      }
      if (payload.taggedOrganizationIds.length > 0) {
        const { error } = await admin.from("content_tagged_organizations").insert(payload.taggedOrganizationIds.map((organizationId) => ({ content_id: contentId, organization_id: organizationId })));
        if (error) { await rollbackDatabase(); throw error; }
      }
      const recipients = new Map<string, "mention" | "tag">();
      payload.mentionedUserIds.forEach((recipientId) => recipients.set(recipientId, "mention"));
      payload.taggedUserIds.forEach((recipientId) => recipients.set(recipientId, "tag"));
      if (recipients.size > 0) {
        const { error } = await admin.from("pending_content_notifications").insert([...recipients].map(([recipientId, reason]) => ({ recipient_id: recipientId, actor_id: user.id, content_id: contentId, reason })));
        if (error) { await rollbackDatabase(); throw error; }
      }
      const persisted = await loadMintFeed(admin, user.id, contentId);
      const mint = persisted.mintz[0];
      const author = persisted.authors.find((candidate) => candidate.account.id === user.id);
      if (!mint || !author) {
        await rollbackDatabase();
        throw new Error("The saved Mint could not be reloaded.");
      }
      if (directMedia.length > 0) {
        const { error } = await admin.from("media_cleanup_jobs").delete()
          .eq("bucket_id", "mint-media").is("content_id", null)
          .in("storage_path", directMedia.map((item) => item.storagePath));
        // The worker protects referenced objects if this best-effort removal fails.
        if (error) logFailure("staged media cleanup cancellation failed", error);
      }
      return json<MintPublishResponse>({ ok: true, mint, author, deduplicated: false }, 201);
    } catch (error) {
      await rollbackDatabase();
      // A simultaneous finalize/retry can share the same signed objects. Never
      // delete them here: another request may have just committed their Mint.
      // Failed direct uploads stay private for retry and later orphan cleanup.
      if (directMedia.length === 0) await removeUploadedMedia(admin, uploaded.map((item) => item.storagePath));
      throw error;
    }
  } catch (error) {
    logFailure("publish failed", error);
    const candidate = error && typeof error === "object" ? error as Record<string, unknown> : null;
    if (candidate?.code === "23505") {
      return json<MintPublishResponse>({ ok: false, message: "This Mint was already submitted. Refresh the feed before retrying.", retryable: true }, 409);
    }
    return json<MintPublishResponse>({ ok: false, message: "We couldn't publish your Mint. Your draft is still here—try again.", retryable: true }, 500);
  }
}
