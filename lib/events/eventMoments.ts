import type {
  EventMoment,
  EventMomentAttendanceEvidence,
  EventMomentPrompt,
  EventMomentPromptStatus,
} from "../../types/eventMoment";
import type { Follow, UserBlock } from "../../types/social";

export const EVENT_MOMENT_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const QUALIFYING_LOCATION_DWELL_MS = 30 * 60 * 1000;

export type EventMomentEligibility = {
  eligible: boolean;
  basis: "rsvp" | "simulated_location" | "both" | null;
  qualifyingEvidence: EventMomentAttendanceEvidence[];
};

export type EventMomentWindow = {
  id: string;
  eventStartAt: string;
  eventEndAt?: string;
};

export type EventMomentVisibilityContext = {
  viewerUserId: string;
  follows: Pick<Follow, "followerId" | "followingId">[];
  blocks: Pick<UserBlock, "blockerId" | "blockedId">[];
  currentTime?: number;
};

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function evidenceRecordedAt(evidence: EventMomentAttendanceEvidence) {
  return timestamp(evidence.recordedAt) ?? 0;
}

export function mergeEventMomentEvidence(
  ...collections: EventMomentAttendanceEvidence[][]
) {
  const latestByKind = new Map<
    string,
    EventMomentAttendanceEvidence
  >();

  for (const evidence of collections.flat()) {
    const key = `${evidence.eventId}:${evidence.userId}:${evidence.kind}`;
    const current = latestByKind.get(key);

    if (!current || evidenceRecordedAt(evidence) >= evidenceRecordedAt(current)) {
      latestByKind.set(key, evidence);
    }
  }

  return Array.from(latestByKind.values()).sort((first, second) =>
    first.eventId.localeCompare(second.eventId) ||
    first.userId.localeCompare(second.userId) ||
    first.kind.localeCompare(second.kind),
  );
}

export function getEventMomentEligibility(
  event: EventMomentWindow,
  userId: string,
  evidence: EventMomentAttendanceEvidence[],
): EventMomentEligibility {
  const matchingEvidence = evidence.filter(
    (item) => item.eventId === event.id && item.userId === userId,
  );

  const rsvpEvidence = matchingEvidence.find(
    (item) => item.kind === "rsvp_attending",
  );

  const eventStart = timestamp(event.eventStartAt);
  const eventEnd = timestamp(event.eventEndAt);

  const locationEvidence = matchingEvidence
    .filter(
      (item): item is Extract<
        EventMomentAttendanceEvidence,
        { kind: "development_location_dwell" }
      > => item.kind === "development_location_dwell",
    )
    .find((item) => {
      if (!item.optedIn || eventStart === null || eventEnd === null) {
        return false;
      }

      const nearbyStart = timestamp(item.nearbyStartedAt);
      const nearbyEnd = timestamp(item.nearbyEndedAt);
      if (nearbyStart === null || nearbyEnd === null || nearbyEnd <= nearbyStart) {
        return false;
      }

      const overlap =
        Math.min(eventEnd, nearbyEnd) - Math.max(eventStart, nearbyStart);

      return overlap >= QUALIFYING_LOCATION_DWELL_MS;
    });

  const qualifyingEvidence = mergeEventMomentEvidence(
    rsvpEvidence ? [rsvpEvidence] : [],
    locationEvidence ? [locationEvidence] : [],
  );

  return {
    eligible: qualifyingEvidence.length > 0,
    basis:
      rsvpEvidence && locationEvidence
        ? "both"
        : rsvpEvidence
          ? "rsvp"
          : locationEvidence
            ? "simulated_location"
            : null,
    qualifyingEvidence,
  };
}

export function upsertEventMomentPrompt(
  prompts: EventMomentPrompt[],
  input: {
    promptId: string;
    eventId: string;
    userId: string;
    eligibility: EventMomentEligibility;
    now: string;
    initialStatus?: Extract<EventMomentPromptStatus, "pending" | "shown">;
  },
) {
  if (!input.eligibility.eligible) return prompts;

  const index = prompts.findIndex(
    (prompt) =>
      prompt.eventId === input.eventId && prompt.userId === input.userId,
  );

  if (index < 0) {
    const status = input.initialStatus ?? "pending";
    return [
      ...prompts,
      {
        id: input.promptId,
        eventId: input.eventId,
        userId: input.userId,
        status,
        attendanceEvidence: input.eligibility.qualifyingEvidence,
        createdAt: input.now,
        updatedAt: input.now,
        shownAt: status === "shown" ? input.now : null,
        dismissedAt: null,
        capturedMomentId: null,
      },
    ];
  }

  const existing = prompts[index];
  const updated: EventMomentPrompt = {
    ...existing,
    attendanceEvidence: mergeEventMomentEvidence(
      existing.attendanceEvidence,
      input.eligibility.qualifyingEvidence,
    ),
    updatedAt: input.now,
  };

  return prompts.map((prompt, promptIndex) =>
    promptIndex === index ? updated : prompt,
  );
}

export function updateEventMomentPromptStatus(
  prompts: EventMomentPrompt[],
  input: {
    eventId: string;
    userId: string;
    status: EventMomentPromptStatus;
    now: string;
    capturedMomentId?: string;
  },
) {
  return prompts.map((prompt) => {
    if (prompt.eventId !== input.eventId || prompt.userId !== input.userId) {
      return prompt;
    }

    if (
      (prompt.status === "dismissed" || prompt.status === "captured") &&
      input.status !== prompt.status
    ) {
      return prompt;
    }

    return {
      ...prompt,
      status: input.status,
      updatedAt: input.now,
      shownAt:
        input.status === "shown" ? prompt.shownAt ?? input.now : prompt.shownAt,
      dismissedAt:
        input.status === "dismissed" ? input.now : prompt.dismissedAt,
      capturedMomentId:
        input.status === "captured"
          ? input.capturedMomentId ?? prompt.capturedMomentId
          : prompt.capturedMomentId,
    };
  });
}

export function isEventMomentActive(
  moment: EventMoment,
  currentTime = Date.now(),
) {
  if (moment.kept) return true;
  const expiresAt = timestamp(moment.expiresAt);
  return expiresAt !== null && expiresAt > currentTime;
}

function hasBlockedRelationship(
  viewerUserId: string,
  authorUserId: string,
  blocks: EventMomentVisibilityContext["blocks"],
) {
  return blocks.some(
    (block) =>
      (block.blockerId === viewerUserId &&
        block.blockedId === authorUserId) ||
      (block.blockerId === authorUserId &&
        block.blockedId === viewerUserId),
  );
}

export function canViewEventMoment(
  moment: EventMoment,
  context: EventMomentVisibilityContext,
) {
  if (!isEventMomentActive(moment, context.currentTime)) return false;
  if (context.viewerUserId === moment.authorUserId) return true;
  if (
    hasBlockedRelationship(
      context.viewerUserId,
      moment.authorUserId,
      context.blocks,
    )
  ) {
    return false;
  }

  if (moment.privacy === "private") return false;
  if (moment.privacy === "public") return true;

  return context.follows.some(
    (follow) =>
      follow.followerId === context.viewerUserId &&
      follow.followingId === moment.authorUserId,
  );
}

export function getVisibleEventMoments(
  moments: EventMoment[],
  context: EventMomentVisibilityContext,
) {
  return moments.filter((moment) => canViewEventMoment(moment, context));
}

export function keepEventMoment(
  moment: EventMoment,
  actorUserId: string,
  keptAt: string,
) {
  if (moment.authorUserId !== actorUserId || moment.kept) return moment;

  return {
    ...moment,
    kept: true,
    keptAt,
  };
}

export function getEventMomentExpirationLabel(
  moment: EventMoment,
  currentTime = Date.now(),
) {
  if (moment.kept) return "Kept";

  const expiresAt = timestamp(moment.expiresAt);
  if (expiresAt === null || expiresAt <= currentTime) return "Expired";

  const remainingMinutes = Math.ceil((expiresAt - currentTime) / (60 * 1000));
  if (remainingMinutes < 60) return `${remainingMinutes}m left`;
  return `${Math.ceil(remainingMinutes / 60)}h left`;
}
