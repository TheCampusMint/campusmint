import assert from "node:assert/strict";
import test from "node:test";

import {
  EVENT_MOMENT_LIFETIME_MS,
  canViewEventMoment,
  getEventMomentEligibility,
  isEventMomentActive,
  keepEventMoment,
  updateEventMomentPromptStatus,
  upsertEventMomentPrompt,
} from "../lib/events/eventMoments.ts";

const event = {
  id: "event-1",
  eventStartAt: "2026-09-05T16:00:00.000Z",
  eventEndAt: "2026-09-05T19:00:00.000Z",
};

const rsvpEvidence = {
  id: "rsvp-1",
  kind: "rsvp_attending",
  attendanceClassification: "planned_attendance",
  eventId: event.id,
  userId: "author",
  recordedAt: "2026-09-01T12:00:00.000Z",
};

function locationEvidence(minutes) {
  return {
    id: `location-${minutes}`,
    kind: "development_location_dwell",
    attendanceClassification: "likely_attendance",
    eventId: event.id,
    userId: "author",
    optedIn: true,
    nearbyStartedAt: event.eventStartAt,
    nearbyEndedAt: new Date(
      new Date(event.eventStartAt).getTime() + minutes * 60 * 1000,
    ).toISOString(),
    recordedAt: "2026-09-05T20:00:00.000Z",
    isDevelopmentSimulation: true,
  };
}

function moment(overrides = {}) {
  const createdAt = "2026-09-05T20:00:00.000Z";
  return {
    id: "moment-1",
    eventId: event.id,
    authorUserId: "author",
    authorUniversityId: "tamu",
    authorUniversityIdentityId: null,
    eventCampusId: "tamu",
    media: {
      id: "media-1",
      type: "image",
      url: null,
      thumbnailUrl: null,
      placeholderId: "event-photo",
      isDevelopmentPlaceholder: true,
    },
    caption: null,
    privacy: "public",
    createdAt,
    expiresAt: new Date(
      new Date(createdAt).getTime() + EVENT_MOMENT_LIFETIME_MS,
    ).toISOString(),
    kept: false,
    keptAt: null,
    attendanceEvidence: [rsvpEvidence],
    isDevelopmentLocal: true,
    ...overrides,
  };
}

const baseVisibility = {
  viewerUserId: "viewer",
  follows: [],
  blocks: [],
  currentTime: new Date("2026-09-05T21:00:00.000Z").getTime(),
};

test("RSVP attending produces Event Moment eligibility", () => {
  const result = getEventMomentEligibility(event, "author", [rsvpEvidence]);
  assert.equal(result.eligible, true);
  assert.equal(result.basis, "rsvp");
  assert.equal(result.qualifyingEvidence[0].attendanceClassification, "planned_attendance");
});

test("neither RSVP nor location evidence produces no eligibility", () => {
  assert.deepEqual(getEventMomentEligibility(event, "author", []), {
    eligible: false,
    basis: null,
    qualifyingEvidence: [],
  });
});

test("qualifying simulated location evidence produces eligibility", () => {
  const result = getEventMomentEligibility(event, "author", [
    locationEvidence(30),
  ]);
  assert.equal(result.eligible, true);
  assert.equal(result.basis, "simulated_location");
  assert.equal(result.qualifyingEvidence[0].attendanceClassification, "likely_attendance");
});

test("location evidence shorter than thirty minutes does not qualify", () => {
  const result = getEventMomentEligibility(event, "author", [
    locationEvidence(29),
  ]);
  assert.equal(result.eligible, false);
});

test("location dwell must overlap the scheduled event window", () => {
  const outsideWindow = {
    ...locationEvidence(30),
    nearbyStartedAt: "2026-09-05T19:30:00.000Z",
    nearbyEndedAt: "2026-09-05T20:00:00.000Z",
  };
  assert.equal(
    getEventMomentEligibility(event, "author", [outsideWindow]).eligible,
    false,
  );
});

test("RSVP and location evidence merge into one prompt", () => {
  const eligibility = getEventMomentEligibility(event, "author", [
    rsvpEvidence,
    locationEvidence(30),
  ]);
  const once = upsertEventMomentPrompt([], {
    promptId: "prompt-1",
    eventId: event.id,
    userId: "author",
    eligibility,
    now: "2026-09-05T20:00:00.000Z",
  });
  const twice = upsertEventMomentPrompt(once, {
    promptId: "prompt-2",
    eventId: event.id,
    userId: "author",
    eligibility,
    now: "2026-09-05T20:01:00.000Z",
  });

  assert.equal(twice.length, 1);
  assert.equal(twice[0].id, "prompt-1");
  assert.equal(twice[0].attendanceEvidence.length, 2);
});

test("dismissed prompt stays dismissed when eligibility is evaluated again", () => {
  const eligibility = getEventMomentEligibility(event, "author", [rsvpEvidence]);
  const created = upsertEventMomentPrompt([], {
    promptId: "prompt-1",
    eventId: event.id,
    userId: "author",
    eligibility,
    now: "2026-09-05T20:00:00.000Z",
    initialStatus: "shown",
  });
  const dismissed = updateEventMomentPromptStatus(created, {
    eventId: event.id,
    userId: "author",
    status: "dismissed",
    now: "2026-09-05T20:01:00.000Z",
  });
  const evaluatedAgain = upsertEventMomentPrompt(dismissed, {
    promptId: "prompt-2",
    eventId: event.id,
    userId: "author",
    eligibility,
    now: "2026-09-05T20:02:00.000Z",
    initialStatus: "shown",
  });

  assert.equal(evaluatedAgain.length, 1);
  assert.equal(evaluatedAgain[0].status, "dismissed");
});

test("non-kept Moment expires after twenty-four hours", () => {
  const value = moment();
  assert.equal(
    isEventMomentActive(value, new Date(value.expiresAt).getTime() - 1),
    true,
  );
  assert.equal(
    isEventMomentActive(value, new Date(value.expiresAt).getTime()),
    false,
  );
});

test("kept Moment remains active and Keep is author-only", () => {
  const value = moment();
  const unauthorized = keepEventMoment(
    value,
    "not-author",
    "2026-09-05T21:00:00.000Z",
  );
  assert.equal(unauthorized.kept, false);

  const kept = keepEventMoment(
    value,
    "author",
    "2026-09-05T21:00:00.000Z",
  );
  assert.equal(kept.kept, true);
  assert.equal(kept.keptAt, "2026-09-05T21:00:00.000Z");
  assert.equal(
    isEventMomentActive(kept, new Date("2030-01-01T00:00:00.000Z").getTime()),
    true,
  );
});

test("private Moment is visible only to its author", () => {
  const value = moment({ privacy: "private" });
  assert.equal(canViewEventMoment(value, baseVisibility), false);
  assert.equal(
    canViewEventMoment(value, {
      ...baseVisibility,
      viewerUserId: "author",
    }),
    true,
  );
});

test("followers Moment requires a follow and respects either-direction blocks", () => {
  const value = moment({ privacy: "followers" });
  const followingContext = {
    ...baseVisibility,
    follows: [{ followerId: "viewer", followingId: "author" }],
  };
  assert.equal(canViewEventMoment(value, followingContext), true);
  assert.equal(
    canViewEventMoment(value, {
      ...followingContext,
      blocks: [{ blockerId: "author", blockedId: "viewer" }],
    }),
    false,
  );
});

test("public Moment visibility still respects blocks and ignores campus as an override", () => {
  const value = moment({
    privacy: "public",
    authorUniversityId: null,
    authorUniversityIdentityId: "provisional-university",
    eventCampusId: "unknown-campus",
  });
  assert.equal(canViewEventMoment(value, baseVisibility), true);
  assert.equal(
    canViewEventMoment(value, {
      ...baseVisibility,
      blocks: [{ blockerId: "viewer", blockedId: "author" }],
    }),
    false,
  );
});
