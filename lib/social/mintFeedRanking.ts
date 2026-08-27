import { getCampusNetworkForUniversity } from "../../data/campusNetworks.ts";
import {
  getAccountConfiguredUniversityId,
  getAccountUniversityIdentityKey,
} from "../../data/universities.ts";
import {
  isEventContentEnded,
  rankEventContentInMixedFeed,
  type EventWindow,
} from "../content/eventRanking.ts";
import {
  getVisibleMintz,
  type MintVisibilityState,
} from "./mintVisibility.ts";
import type { Event } from "../../types/event.ts";
import type { Mint } from "../../types/mint.ts";
import type {
  Organization,
  OrganizationMembership,
} from "../../types/organization.ts";
import type { CampusMintUser } from "../../types/profile.ts";

const HOUR_MS = 60 * 60 * 1_000;
const EARTH_RADIUS_MILES = 3_958.8;
const REGIONAL_RADIUS_MILES = 400;
const ACTIVE_MEMBERSHIP_STATUSES = new Set<
  OrganizationMembership["status"]
>(["member", "officer", "leader"]);

export type NormalMintLocalityTier =
  | "home_university"
  | "campus_network"
  | "regional"
  | "broader";

export type NormalMintRankingState = MintVisibilityState & {
  organizationDirectory?: readonly Organization[];
  eventDirectory?: readonly Event[];
  followedOrganizationIds?: readonly string[];
  attendingEventIds?: readonly string[];
};

export type NormalMintRankingMetadata = {
  localityTier: NormalMintLocalityTier;
  regionalDistanceMiles: number | null;
  localitySignal: number;
  followSignal: number;
  organizationSignal: number;
  eventSignal: number;
  engagementSignal: number;
  recencySignal: number;
  diversityAdjustment: number;
  baseScore: number;
  finalScore: number;
  reasons: string[];
};

export type RankedNormalMint = {
  mint: Mint;
  metadata: NormalMintRankingMetadata;
};

type RankingContext = {
  state: NormalMintRankingState;
  usersById: Map<string, CampusMintUser>;
  organizationsById: Map<string, Organization>;
  eventsById: Map<string, Event>;
  followedAuthorIds: Set<string>;
  memberOrganizationIds: Set<string>;
  followedOrganizationIds: Set<string>;
  attendingEventIds: Set<string>;
};

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function distanceMiles(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
  const latitudeDelta = toRadians(
    second.latitude - first.latitude,
  );
  const longitudeDelta = toRadians(
    second.longitude - first.longitude,
  );
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_MILES *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function localityFor(
  viewer: CampusMintUser,
  author: CampusMintUser,
) {
  if (
    getAccountUniversityIdentityKey(viewer.account) ===
    getAccountUniversityIdentityKey(author.account)
  ) {
    return {
      tier: "home_university" as const,
      score: 560,
      distance: null,
    };
  }

  const viewerUniversityId = getAccountConfiguredUniversityId(
    viewer.account,
  );
  const authorUniversityId = getAccountConfiguredUniversityId(
    author.account,
  );

  if (!viewerUniversityId || !authorUniversityId) {
    return {
      tier: "broader" as const,
      score: 0,
      distance: null,
    };
  }

  const viewerNetwork = getCampusNetworkForUniversity(
    viewerUniversityId,
  );
  const authorNetwork = getCampusNetworkForUniversity(
    authorUniversityId,
  );

  if (!viewerNetwork || !authorNetwork) {
    return {
      tier: "broader" as const,
      score: 0,
      distance: null,
    };
  }

  if (viewerNetwork.id === authorNetwork.id) {
    return {
      tier: "campus_network" as const,
      score: 260,
      distance: 0,
    };
  }

  const distance = distanceMiles(viewerNetwork, authorNetwork);

  if (distance <= REGIONAL_RADIUS_MILES) {
    return {
      tier: "regional" as const,
      score: Math.round(
        40 +
          100 *
            (1 - distance / REGIONAL_RADIUS_MILES),
      ),
      distance,
    };
  }

  return {
    tier: "broader" as const,
    score: 0,
    distance,
  };
}

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function eventForMint(mint: Mint, context: RankingContext) {
  const eventId = mint.eventData?.eventId;
  return eventId ? context.eventsById.get(eventId) ?? null : null;
}

function eventWindowForMint(
  mint: Mint,
  context: RankingContext,
): EventWindow | null {
  if (mint.postType !== "event") return null;

  const event = eventForMint(mint, context);

  return {
    eventStartAt:
      event?.eventStartAt ?? mint.eventData?.eventStartAt,
    eventEndAt:
      event?.eventEndAt ?? mint.eventData?.eventEndAt,
  };
}

function recencyScore(mint: Mint, currentTime: number) {
  const createdAt = timestamp(mint.createdAt);
  if (createdAt === null) return 0;

  const ageHours = Math.max(
    0,
    (currentTime - createdAt) / HOUR_MS,
  );

  // A 36-hour half-life keeps the feed fresh while still allowing genuinely
  // relevant local and social signals to compensate for some age.
  return 620 * 2 ** (-ageHours / 36);
}

function engagementScore(mint: Mint) {
  const weightedEngagement =
    Math.max(0, mint.likeCount) +
    Math.max(0, mint.commentCount) * 2 +
    Math.max(0, mint.saveCount) * 2.5 +
    Math.max(0, mint.shareCount) * 1.5 +
    Math.max(0, mint.repostCount ?? 0) * 1.5;

  // Logarithmic and capped so genuine activity helps without turning the
  // community feed into a generic popularity chart.
  return Math.min(
    150,
    Math.log2(weightedEngagement + 1) * 22,
  );
}

function associatedOrganizationIds(
  mint: Mint,
  context: RankingContext,
) {
  const eventOrganizationId = eventForMint(mint, context)?.organizationId;

  return [
    mint.organizationId,
    ...(mint.taggedOrganizationIds ?? []),
    eventOrganizationId,
  ].filter(
    (organizationId): organizationId is string =>
      Boolean(organizationId),
  );
}

function organizationScore(
  mint: Mint,
  context: RankingContext,
) {
  const organizationIds = new Set(
    associatedOrganizationIds(mint, context),
  );
  const viewerUniversityId = getAccountConfiguredUniversityId(
    context.state.viewer.account,
  );
  const isMember = [...organizationIds].some((organizationId) =>
    context.memberOrganizationIds.has(organizationId),
  );
  const isFollowed = [...organizationIds].some((organizationId) =>
    context.followedOrganizationIds.has(organizationId),
  );
  const isHomeCampus = Boolean(
    viewerUniversityId &&
      [...organizationIds].some(
        (organizationId) =>
          context.organizationsById.get(organizationId)?.universityId ===
          viewerUniversityId,
      ),
  );

  return {
    score:
      (isMember ? 260 : 0) +
      (isHomeCampus ? 160 : 0) +
      (isFollowed ? 140 : 0),
    isMember,
    isHomeCampus,
    isFollowed,
  };
}

function eventScore(mint: Mint, context: RankingContext) {
  if (mint.postType !== "event") {
    return {
      score: 0,
      isHomeCampus: false,
      isAttending: false,
      timingScore: 0,
    };
  }

  const event = eventForMint(mint, context);
  const eventId = event?.id ?? mint.eventData?.eventId ?? null;
  const viewerUniversityId = getAccountConfiguredUniversityId(
    context.state.viewer.account,
  );
  const isHomeCampus = Boolean(
    event &&
      viewerUniversityId &&
      event.campus === viewerUniversityId,
  );
  const isAttending = Boolean(
    eventId && context.attendingEventIds.has(eventId),
  );
  const eventWindow = eventWindowForMint(mint, context);
  const start = timestamp(eventWindow?.eventStartAt);
  const end = timestamp(eventWindow?.eventEndAt);
  let timingScore = 0;

  if (
    start !== null &&
    start <= context.state.currentTime &&
    (end === null || end > context.state.currentTime)
  ) {
    timingScore = 160;
  } else if (start !== null && start > context.state.currentTime) {
    const hoursUntilStart =
      (start - context.state.currentTime) / HOUR_MS;

    if (hoursUntilStart <= 1) timingScore = 140;
    else if (hoursUntilStart <= 6) timingScore = 105;
    else if (hoursUntilStart <= 24) timingScore = 75;
    else if (hoursUntilStart <= 72) timingScore = 40;
    else if (hoursUntilStart <= 168) timingScore = 20;
  }

  return {
    score:
      (isHomeCampus ? 150 : 0) +
      (isAttending ? 240 : 0) +
      timingScore,
    isHomeCampus,
    isAttending,
    timingScore,
  };
}

function scoreMint(mint: Mint, context: RankingContext): RankedNormalMint {
  const author = context.usersById.get(mint.authorId);

  if (!author) {
    return {
      mint,
      metadata: {
        localityTier: "broader",
        regionalDistanceMiles: null,
        localitySignal: 0,
        followSignal: 0,
        organizationSignal: 0,
        eventSignal: 0,
        engagementSignal: 0,
        recencySignal: 0,
        diversityAdjustment: 0,
        baseScore: 0,
        finalScore: 0,
        reasons: [],
      },
    };
  }

  const locality = localityFor(context.state.viewer, author);
  const followsAuthor = context.followedAuthorIds.has(author.account.id);
  const followSignal =
    (followsAuthor ? 430 : 0) +
    (followsAuthor && locality.tier === "home_university" ? 90 : 0) +
    (author.account.id === context.state.viewer.account.id ? 180 : 0);
  const organization = organizationScore(mint, context);
  const event = eventScore(mint, context);
  const engagementSignal = engagementScore(mint);
  const recencySignal = recencyScore(
    mint,
    context.state.currentTime,
  );
  const baseScore =
    locality.score +
    followSignal +
    organization.score +
    event.score +
    engagementSignal +
    recencySignal;
  const reasons: string[] = [];

  if (locality.tier === "home_university") {
    reasons.push("Home university");
  } else if (locality.tier === "campus_network") {
    reasons.push("Campus network");
  } else if (locality.tier === "regional") {
    reasons.push("Regional");
  }
  if (followsAuthor) reasons.push("Following");
  if (organization.isMember) reasons.push("Your organization");
  else if (organization.isHomeCampus) {
    reasons.push("Home-campus organization");
  }
  if (organization.isFollowed) reasons.push("Followed organization");
  if (event.isAttending) reasons.push("RSVP");
  else if (event.isHomeCampus) reasons.push("Home-campus event");
  if (recencySignal >= 390) reasons.push("Recent");
  if (engagementSignal >= 50) reasons.push("Engaged");

  return {
    mint,
    metadata: {
      localityTier: locality.tier,
      regionalDistanceMiles: locality.distance,
      localitySignal: locality.score,
      followSignal,
      organizationSignal: organization.score,
      eventSignal: event.score,
      engagementSignal,
      recencySignal,
      diversityAdjustment: 0,
      baseScore,
      finalScore: baseScore,
      reasons,
    },
  };
}

function diversityAdjustment(
  candidate: RankedNormalMint,
  ranked: readonly RankedNormalMint[],
) {
  const previous = ranked.at(-1);
  const beforePrevious = ranked.at(-2);
  let adjustment = 0;

  if (previous?.mint.authorId === candidate.mint.authorId) {
    adjustment -= 100;
  }

  if (
    previous?.mint.authorId === candidate.mint.authorId &&
    beforePrevious?.mint.authorId === candidate.mint.authorId
  ) {
    adjustment -= 300;
  }

  if (
    previous?.mint.contentType === candidate.mint.contentType &&
    beforePrevious?.mint.contentType === candidate.mint.contentType
  ) {
    adjustment -= 30;
  }

  return adjustment;
}

function compareRankedMintz(
  first: RankedNormalMint,
  second: RankedNormalMint,
) {
  const scoreDifference =
    second.metadata.finalScore - first.metadata.finalScore;
  if (scoreDifference !== 0) return scoreDifference;

  const recencyDifference =
    (timestamp(second.mint.createdAt) ?? 0) -
    (timestamp(first.mint.createdAt) ?? 0);

  return recencyDifference || first.mint.id.localeCompare(second.mint.id);
}

function rankVisibleMintz(
  visibleMintz: readonly Mint[],
  context: RankingContext,
) {
  const unique = new Map<string, Mint>();

  for (const mint of visibleMintz) {
    if (!unique.has(mint.id)) unique.set(mint.id, mint);
  }

  const remaining = [...unique.values()]
    .filter((mint) => {
      const eventWindow = eventWindowForMint(mint, context);
      return (
        !eventWindow ||
        !isEventContentEnded(
          eventWindow,
          context.state.currentTime,
        )
      );
    })
    .map((mint) => scoreMint(mint, context));
  const ranked: RankedNormalMint[] = [];

  while (remaining.length > 0) {
    const candidates = remaining
      .map((candidate) => {
        const adjustment = diversityAdjustment(candidate, ranked);
        return {
          ...candidate,
          metadata: {
            ...candidate.metadata,
            diversityAdjustment: adjustment,
            finalScore: candidate.metadata.baseScore + adjustment,
          },
        };
      })
      .sort(compareRankedMintz);
    const selected = candidates[0];

    ranked.push(selected);
    remaining.splice(
      remaining.findIndex(
        (candidate) => candidate.mint.id === selected.mint.id,
      ),
      1,
    );
  }

  // Preserve the centralized end-soonest ordering inside the event slots
  // without forcing every Event Mint above ordinary social content.
  return rankEventContentInMixedFeed(
    ranked,
    (candidate) => eventWindowForMint(candidate.mint, context),
    context.state.currentTime,
  );
}

function createRankingContext(
  state: NormalMintRankingState,
): RankingContext {
  const viewerId = state.viewer.account.id;

  return {
    state,
    usersById: new Map(
      state.users.map((user) => [user.account.id, user]),
    ),
    organizationsById: new Map(
      (state.organizationDirectory ?? []).map((organization) => [
        organization.id,
        organization,
      ]),
    ),
    eventsById: new Map(
      (state.eventDirectory ?? []).map((event) => [event.id, event]),
    ),
    followedAuthorIds: new Set(
      state.follows
        .filter((follow) => follow.followerId === viewerId)
        .map((follow) => follow.followingId),
    ),
    memberOrganizationIds: new Set(
      (state.organizationMemberships ?? [])
        .filter(
          (membership) =>
            membership.userId === viewerId &&
            ACTIVE_MEMBERSHIP_STATUSES.has(membership.status),
        )
        .map((membership) => membership.organizationId),
    ),
    followedOrganizationIds: new Set(
      state.followedOrganizationIds ?? [],
    ),
    attendingEventIds: new Set(state.attendingEventIds ?? []),
  };
}

export function rankVisibleNormalMintzWithMetadata(
  visibleMintz: readonly Mint[],
  state: NormalMintRankingState,
) {
  return rankVisibleMintz(visibleMintz, createRankingContext(state));
}

export function rankNormalMintFeedWithMetadata(
  mintz: readonly Mint[],
  state: NormalMintRankingState,
) {
  // Visibility, block, moderation, expiration, and organization-audience
  // checks happen before any recommendation signal is calculated.
  const visibleMintz = getVisibleMintz(mintz, state);
  return rankVisibleNormalMintzWithMetadata(visibleMintz, state);
}

export function rankNormalMintFeed(
  mintz: readonly Mint[],
  state: NormalMintRankingState,
) {
  return rankNormalMintFeedWithMetadata(mintz, state).map(
    (candidate) => candidate.mint,
  );
}
