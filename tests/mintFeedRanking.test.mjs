import assert from "node:assert/strict";
import test from "node:test";

import {
  rankNormalMintFeed,
  rankNormalMintFeedWithMetadata,
} from "../lib/social/mintFeedRanking.ts";

const NOW = Date.parse("2026-08-22T18:00:00.000Z");

function user(id, universityId, options = {}) {
  const account = options.account ?? {};

  return {
    account: {
      id,
      universityId,
      role: "student",
      verifiedStudent: false,
      verifiedAlumni: false,
      isDevelopment: true,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      ...account,
    },
    profile: {
      id: `profile-${id}`,
      accountId: id,
      username: id,
      usernameNormalized: id,
      firstName: "Demo",
      lastName: "Student",
      displayName: id,
      photo: {
        kind: "development_placeholder",
        placeholderId: "DS",
        storagePath: null,
      },
      bio: null,
      major: null,
      graduationYear: null,
      classIds: [],
      clubIds: [],
      interests: [],
      hobbies: [],
      academicArea: null,
      hometown: null,
      instagram: null,
      linkedin: null,
      portfolioUrl: null,
      personalWebsite: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
    privacy: {},
    socialSettings: {
      accountType: options.accountType ?? "public",
      discoveryScope: options.discoveryScope ?? "community",
    },
  };
}

function provisionalUser(id, domain, legacyUniversityId = "tamu") {
  return user(id, legacyUniversityId, {
    account: {
      universityIdentityId: `edu:${domain}`,
      universityDomain: domain,
      universityName: "Development University",
      universityShortName: "Development U",
      knownUniversityId: null,
    },
  });
}

function mint(id, author, options = {}) {
  const createdAt =
    options.createdAt ??
    new Date(NOW - 2 * 60 * 60 * 1_000).toISOString();
  const eventData = options.eventData ?? null;

  return {
    id,
    publishFormat: "mint",
    authorId: author.account.id,
    universityId: author.account.universityId,
    universityIdentityId:
      author.account.universityIdentityId ?? null,
    knownUniversityId:
      author.account.knownUniversityId ??
      author.account.universityId,
    campusNetworkId: options.campusNetworkId ?? "universal",
    contentType: options.contentType ?? "image",
    postType: options.postType ?? "personal",
    media:
      options.contentType === "text"
        ? []
        : [
            {
              id: `${id}-media`,
              type: "image",
              url: null,
              thumbnailUrl: null,
              width: null,
              height: null,
              durationSeconds: null,
              order: 0,
              isDevelopmentPlaceholder: true,
            },
          ],
    caption: options.caption ?? "Development Mint",
    hashtags: [],
    mentions: [],
    taggedUserIds: [],
    location: null,
    music: null,
    createdAt,
    updatedAt: createdAt,
    expiresAt: options.expiresAt ?? null,
    commentsEnabled: true,
    likesVisible: true,
    eventData,
    organizationId: options.organizationId ?? null,
    taggedOrganizationIds:
      options.taggedOrganizationIds ?? [],
    organizationAudience:
      options.organizationAudience ?? "public",
    status: options.status ?? "active",
    privacy: options.privacy ?? "public",
    likeCount: options.likeCount ?? 0,
    commentCount: options.commentCount ?? 0,
    saveCount: options.saveCount ?? 0,
    shareCount: options.shareCount ?? 0,
    repostCount: options.repostCount ?? 0,
    archivedAt: options.archivedAt ?? null,
    isDevelopment: true,
  };
}

function state(viewer, users, options = {}) {
  return {
    viewer,
    users: [viewer, ...users.filter((candidate) => candidate !== viewer)],
    friendships: options.friendships ?? [],
    follows: options.follows ?? [],
    blocks: options.blocks ?? [],
    currentTime: options.currentTime ?? NOW,
    organizationMemberships:
      options.organizationMemberships ?? [],
    followedOrganizationIds:
      options.followedOrganizationIds ?? [],
    organizationDirectory:
      options.organizationDirectory ?? [],
    eventDirectory: options.eventDirectory ?? [],
    attendingEventIds: options.attendingEventIds ?? [],
  };
}

function ids(ranked) {
  return ranked.map((candidate) => candidate.id);
}

test("private and removed content are excluded before normal-feed ranking", () => {
  const viewer = user("viewer", "tamu");
  const author = user("author", "lsu");
  const ranked = rankNormalMintFeed(
    [
      mint("private", author, {
        privacy: "private",
        likeCount: 10_000,
      }),
      mint("removed", author, {
        status: "removed",
        likeCount: 10_000,
      }),
      mint("visible", author),
    ],
    state(viewer, [author]),
  );

  assert.deepEqual(ids(ranked), ["visible"]);
});

test("a blocked creator is excluded before ranking", () => {
  const viewer = user("viewer", "tamu");
  const blocked = user("blocked", "tamu");
  const visible = user("visible", "lsu");
  const ranked = rankNormalMintFeed(
    [
      mint("blocked-high", blocked, { likeCount: 10_000 }),
      mint("visible", visible),
    ],
    state(viewer, [blocked, visible], {
      blocks: [
        {
          id: "block",
          blockerId: viewer.account.id,
          blockedId: blocked.account.id,
          createdAt: new Date(NOW).toISOString(),
        },
      ],
    }),
  );

  assert.deepEqual(ids(ranked), ["visible"]);
});

test("same-university content outranks otherwise-equivalent broader content", () => {
  const viewer = user("viewer", "tamu");
  const local = user("local", "tamu");
  const broader = user("broader", "alabama");
  const ranked = rankNormalMintFeed(
    [mint("broader", broader), mint("local", local)],
    state(viewer, [local, broader]),
  );

  assert.deepEqual(ids(ranked), ["local", "broader"]);
});

test("following provides a strong deterministic social boost", () => {
  const viewer = user("viewer", "tamu");
  const followed = user("followed", "tamu");
  const random = user("random", "tamu");
  const ranked = rankNormalMintFeedWithMetadata(
    [mint("random", random), mint("followed", followed)],
    state(viewer, [followed, random], {
      follows: [
        {
          id: "follow",
          followerId: viewer.account.id,
          followingId: followed.account.id,
          createdAt: new Date(NOW).toISOString(),
        },
      ],
    }),
  );

  assert.equal(ranked[0].mint.id, "followed");
  assert.ok(ranked[0].metadata.followSignal >= 430);
});

test("a followed external creator outranks a random external creator", () => {
  const viewer = user("viewer", "tamu");
  const followed = user("followed", "lsu");
  const random = user("random", "alabama");
  const ranked = rankNormalMintFeed(
    [mint("random", random), mint("followed", followed)],
    state(viewer, [followed, random], {
      follows: [
        {
          id: "follow",
          followerId: viewer.account.id,
          followingId: followed.account.id,
          createdAt: new Date(NOW).toISOString(),
        },
      ],
    }),
  );

  assert.equal(ranked[0].id, "followed");
});

test("structured home-campus organization relevance boosts a Mint", () => {
  const viewer = user("viewer", "tamu");
  const firstAuthor = user("first", "tamu");
  const secondAuthor = user("second", "tamu");
  const organization = { id: "robotics", universityId: "tamu" };
  const ranked = rankNormalMintFeedWithMetadata(
    [
      mint("ordinary", firstAuthor),
      mint("club", secondAuthor, {
        postType: "club",
        organizationId: organization.id,
      }),
    ],
    state(viewer, [firstAuthor, secondAuthor], {
      organizationDirectory: [organization],
      organizationMemberships: [
        {
          id: "membership",
          organizationId: organization.id,
          userId: viewer.account.id,
          status: "member",
        },
      ],
    }),
  );

  assert.equal(ranked[0].mint.id, "club");
  assert.ok(ranked[0].metadata.organizationSignal >= 420);
});

test("home-campus event context contributes relevance without a separate feed", () => {
  const viewer = user("viewer", "tamu");
  const firstAuthor = user("first", "tamu");
  const secondAuthor = user("second", "tamu");
  const event = {
    id: "home-event",
    campus: "tamu",
    eventStartAt: new Date(NOW + 48 * 60 * 60 * 1_000).toISOString(),
    eventEndAt: new Date(NOW + 51 * 60 * 60 * 1_000).toISOString(),
  };
  const ranked = rankNormalMintFeedWithMetadata(
    [
      mint("ordinary", firstAuthor),
      mint("event", secondAuthor, {
        postType: "event",
        eventData: {
          eventId: event.id,
          eventStartAt: null,
          eventEndAt: null,
        },
      }),
    ],
    state(viewer, [firstAuthor, secondAuthor], {
      eventDirectory: [event],
    }),
  );

  assert.equal(ranked[0].mint.id, "event");
  assert.ok(ranked[0].metadata.eventSignal >= 150);
});

test("viewer RSVP adds a real event relationship signal", () => {
  const viewer = user("viewer", "tamu");
  const firstAuthor = user("first", "tamu");
  const secondAuthor = user("second", "tamu");
  const eventStartAt = new Date(NOW + 24 * 60 * 60 * 1_000).toISOString();
  const eventEndAt = new Date(NOW + 26 * 60 * 60 * 1_000).toISOString();
  const events = [
    { id: "random-event", campus: "tamu", eventStartAt, eventEndAt },
    { id: "rsvp-event", campus: "tamu", eventStartAt, eventEndAt },
  ];
  const ranked = rankNormalMintFeed(
    [
      mint("random-event-mint", firstAuthor, {
        postType: "event",
        eventData: { eventId: "random-event" },
      }),
      mint("rsvp-event-mint", secondAuthor, {
        postType: "event",
        eventData: { eventId: "rsvp-event" },
      }),
    ],
    state(viewer, [firstAuthor, secondAuthor], {
      eventDirectory: events,
      attendingEventIds: ["rsvp-event"],
    }),
  );

  assert.equal(ranked[0].id, "rsvp-event-mint");
});

test("a genuinely shared Campus Network receives a proximity benefit", () => {
  const viewer = user("viewer", "tamu");
  const nearby = user("nearby", "blinn");
  const broader = user("broader", "alabama");
  const ranked = rankNormalMintFeedWithMetadata(
    [mint("broader", broader), mint("nearby", nearby)],
    state(viewer, [nearby, broader]),
  );

  assert.equal(ranked[0].mint.id, "nearby");
  assert.equal(ranked[0].metadata.localityTier, "campus_network");
});

test("available Campus Network coordinates provide a modest regional signal", () => {
  const viewer = user("viewer", "tamu");
  const regional = user("regional", "texas");
  const broader = user("broader", "alabama");
  const ranked = rankNormalMintFeedWithMetadata(
    [mint("broader", broader), mint("regional", regional)],
    state(viewer, [regional, broader]),
  );

  assert.equal(ranked[0].mint.id, "regional");
  assert.equal(ranked[0].metadata.localityTier, "regional");
  assert.ok(ranked[0].metadata.regionalDistanceMiles > 0);
});

test("very stale local content can lose to sufficiently fresh broader content", () => {
  const viewer = user("viewer", "tamu");
  const local = user("local", "tamu");
  const broader = user("broader", "alabama");
  const ranked = rankNormalMintFeed(
    [
      mint("stale-local", local, {
        createdAt: new Date(NOW - 60 * 24 * 60 * 60 * 1_000).toISOString(),
      }),
      mint("fresh-broader", broader, {
        createdAt: new Date(NOW).toISOString(),
      }),
    ],
    state(viewer, [local, broader]),
  );

  assert.equal(ranked[0].id, "fresh-broader");
});

test("engagement is useful but capped below core locality", () => {
  const viewer = user("viewer", "tamu");
  const local = user("local", "tamu");
  const broaderPopular = user("popular", "alabama");
  const broaderQuiet = user("quiet", "alabama");
  const ranked = rankNormalMintFeedWithMetadata(
    [
      mint("broader-quiet", broaderQuiet),
      mint("broader-popular", broaderPopular, { likeCount: 50 }),
      mint("local", local),
    ],
    state(viewer, [local, broaderPopular, broaderQuiet]),
  );

  assert.equal(ranked[0].mint.id, "local");
  assert.ok(
    ranked.findIndex((candidate) => candidate.mint.id === "broader-popular") <
      ranked.findIndex((candidate) => candidate.mint.id === "broader-quiet"),
  );
  assert.ok(
    ranked.find((candidate) => candidate.mint.id === "broader-popular")
      .metadata.engagementSignal <= 150,
  );
});

test("duplicate Mint IDs appear only once", () => {
  const viewer = user("viewer", "tamu");
  const author = user("author", "tamu");
  const duplicate = mint("duplicate", author);
  const ranked = rankNormalMintFeed(
    [duplicate, duplicate, mint("other", author)],
    state(viewer, [author]),
  );

  assert.equal(ranked.filter((candidate) => candidate.id === "duplicate").length, 1);
});

test("diversity avoids an unnecessary same-author opening streak", () => {
  const viewer = user("viewer", "tamu");
  const repeated = user("repeated", "tamu");
  const alternative = user("alternative", "tamu");
  const ranked = rankNormalMintFeed(
    [
      mint("a-repeated", repeated),
      mint("b-repeated", repeated),
      mint("c-repeated", repeated),
      mint("z-alternative", alternative),
    ],
    state(viewer, [repeated, alternative]),
  );

  assert.deepEqual(
    ranked.slice(0, 2).map((candidate) => candidate.authorId),
    [repeated.account.id, alternative.account.id],
  );
});

test("a provisional viewer gets own-university locality by universal identity", () => {
  const viewer = provisionalUser("viewer", "newcollege.edu");
  const local = provisionalUser("local", "newcollege.edu", "lsu");
  const configured = user("configured", "tamu");
  const ranked = rankNormalMintFeedWithMetadata(
    [mint("configured", configured), mint("local", local)],
    state(viewer, [local, configured]),
  );

  assert.equal(ranked[0].mint.id, "local");
  assert.equal(ranked[0].metadata.localityTier, "home_university");
});

test("a provisional viewer does not inherit its legacy configured Campus Network", () => {
  const viewer = provisionalUser("viewer", "newcollege.edu", "tamu");
  const blinn = user("blinn", "blinn");
  const ranked = rankNormalMintFeedWithMetadata(
    [mint("blinn", blinn)],
    state(viewer, [blinn]),
  );

  assert.equal(ranked[0].metadata.localityTier, "broader");
  assert.equal(ranked[0].metadata.regionalDistanceMiles, null);
});

test("a thin local pool expands to all broader eligible content", () => {
  const viewer = user("viewer", "tamu");
  const local = user("local", "tamu");
  const lsu = user("lsu", "lsu");
  const alabama = user("alabama", "alabama");
  const ranked = rankNormalMintFeed(
    [mint("local", local), mint("lsu", lsu), mint("alabama", alabama)],
    state(viewer, [local, lsu, alabama]),
  );

  assert.deepEqual(new Set(ids(ranked)), new Set(["local", "lsu", "alabama"]));
});

test("identical ranking inputs always produce identical ordering and metadata", () => {
  const viewer = user("viewer", "tamu");
  const local = user("local", "tamu");
  const nearby = user("nearby", "blinn");
  const broader = user("broader", "alabama");
  const mintz = [
    mint("broader", broader),
    mint("nearby", nearby),
    mint("local", local),
  ];
  const rankingState = state(viewer, [local, nearby, broader]);

  assert.deepEqual(
    rankNormalMintFeedWithMetadata(mintz, rankingState),
    rankNormalMintFeedWithMetadata(mintz, rankingState),
  );
});

test("member-only organization content remains invisible to non-members", () => {
  const viewer = user("viewer", "tamu");
  const author = user("author", "tamu");
  const ranked = rankNormalMintFeed(
    [
      mint("members-only", author, {
        organizationId: "private-club",
        organizationAudience: "members",
        likeCount: 10_000,
      }),
      mint("public", author),
    ],
    state(viewer, [author], {
      organizationDirectory: [
        { id: "private-club", universityId: "tamu" },
      ],
    }),
  );

  assert.deepEqual(ids(ranked), ["public"]);
});

test("Event Mint slots retain centralized end-soonest urgency ordering", () => {
  const viewer = user("viewer", "tamu");
  const author = user("author", "tamu");
  const events = [
    {
      id: "late",
      campus: "tamu",
      eventStartAt: new Date(NOW - 60 * 60 * 1_000).toISOString(),
      eventEndAt: new Date(NOW + 3 * 60 * 60 * 1_000).toISOString(),
    },
    {
      id: "soon",
      campus: "tamu",
      eventStartAt: new Date(NOW - 60 * 60 * 1_000).toISOString(),
      eventEndAt: new Date(NOW + 20 * 60 * 1_000).toISOString(),
    },
  ];
  const ranked = rankNormalMintFeed(
    [
      mint("late", author, {
        postType: "event",
        eventData: { eventId: "late" },
      }),
      mint("personal", author),
      mint("soon", author, {
        postType: "event",
        eventData: { eventId: "soon" },
      }),
    ],
    state(viewer, [author], { eventDirectory: events }),
  );
  const eventIds = ranked
    .filter((candidate) => candidate.postType === "event")
    .map((candidate) => candidate.id);

  assert.deepEqual(eventIds, ["soon", "late"]);
  assert.ok(ranked.some((candidate) => candidate.id === "personal"));
});
