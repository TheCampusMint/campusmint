"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import {
  EVENT_MOMENT_LIFETIME_MS,
  QUALIFYING_LOCATION_DWELL_MS,
  getEventMomentEligibility,
  keepEventMoment as preserveEventMoment,
  mergeEventMomentEvidence,
  updateEventMomentPromptStatus,
  upsertEventMomentPrompt,
} from "@/lib/events/eventMoments";
import type { Event } from "@/types/event";
import type {
  EventMomentDevelopmentStore,
  EventMomentPrivacy,
} from "@/types/eventMoment";
import type { CampusMintUser } from "@/types/profile";

export const EVENT_MOMENTS_STORAGE_KEY =
  "campusmint:development-event-moments:v1";

function emptyStore(): EventMomentDevelopmentStore {
  return {
    version: 1,
    rsvps: [],
    attendanceEvidence: [],
    prompts: [],
    moments: [],
  };
}

function localId(prefix: string) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function accountUniversityId(user: CampusMintUser) {
  if (user.account.universityIdentityId) {
    return user.account.knownUniversityId ?? null;
  }

  return user.account.universityId ?? null;
}

export function useEventMoments() {
  const [store, setStore] = useState<EventMomentDevelopmentStore>(emptyStore);
  const [hydrated, setHydrated] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem(EVENT_MOMENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as EventMomentDevelopmentStore;
        if (parsed?.version === 1) {
          // This layout effect intentionally hydrates client-only prototype state.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setStore(parsed);
        }
      }
    } catch {
      window.localStorage.removeItem(EVENT_MOMENTS_STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(EVENT_MOMENTS_STORAGE_KEY, JSON.stringify(store));
  }, [hydrated, store]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function isAttending(eventId: string, userId: string) {
    return store.rsvps.some(
      (rsvp) =>
        rsvp.eventId === eventId &&
        rsvp.userId === userId &&
        rsvp.status === "attending",
    );
  }

  function getEligibility(event: Event, userId: string) {
    return getEventMomentEligibility(event, userId, store.attendanceEvidence);
  }

  function getPrompt(eventId: string, userId: string) {
    return (
      store.prompts.find(
        (prompt) => prompt.eventId === eventId && prompt.userId === userId,
      ) ?? null
    );
  }

  function toggleRsvp(event: Event, userId: string) {
    const now = new Date().toISOString();

    setStore((current) => {
      const currentRsvp = current.rsvps.find(
        (rsvp) => rsvp.eventId === event.id && rsvp.userId === userId,
      );
      const attending = currentRsvp?.status !== "attending";

      const rsvps = [
        ...current.rsvps.filter(
          (rsvp) => !(rsvp.eventId === event.id && rsvp.userId === userId),
        ),
        {
          eventId: event.id,
          userId,
          status: attending ? ("attending" as const) : ("cancelled" as const),
          respondedAt: now,
        },
      ];

      const withoutRsvpEvidence = current.attendanceEvidence.filter(
        (evidence) =>
          !(
            evidence.eventId === event.id &&
            evidence.userId === userId &&
            evidence.kind === "rsvp_attending"
          ),
      );

      const attendanceEvidence = attending
        ? mergeEventMomentEvidence(withoutRsvpEvidence, [
            {
              id: localId("event-rsvp-evidence"),
              kind: "rsvp_attending" as const,
              attendanceClassification: "planned_attendance" as const,
              eventId: event.id,
              userId,
              recordedAt: now,
            },
          ])
        : withoutRsvpEvidence;

      const eligibility = getEventMomentEligibility(
        event,
        userId,
        attendanceEvidence,
      );

      return {
        ...current,
        rsvps,
        attendanceEvidence,
        prompts: upsertEventMomentPrompt(current.prompts, {
          promptId: localId("event-moment-prompt"),
          eventId: event.id,
          userId,
          eligibility,
          now,
          initialStatus: "shown",
        }),
      };
    });
  }

  function simulateQualifyingLocationAttendance(event: Event, userId: string) {
    const eventStart = new Date(event.eventStartAt).getTime();
    const eventEnd = event.eventEndAt
      ? new Date(event.eventEndAt).getTime()
      : Number.NaN;

    if (
      !Number.isFinite(eventStart) ||
      !Number.isFinite(eventEnd) ||
      eventEnd - eventStart < QUALIFYING_LOCATION_DWELL_MS
    ) {
      return false;
    }

    const now = new Date().toISOString();
    const evidence = {
      id: localId("event-location-evidence"),
      kind: "development_location_dwell" as const,
      attendanceClassification: "likely_attendance" as const,
      eventId: event.id,
      userId,
      optedIn: true as const,
      nearbyStartedAt: new Date(eventStart).toISOString(),
      nearbyEndedAt: new Date(
        eventStart + QUALIFYING_LOCATION_DWELL_MS,
      ).toISOString(),
      recordedAt: now,
      isDevelopmentSimulation: true as const,
    };

    setStore((current) => {
      const attendanceEvidence = mergeEventMomentEvidence(
        current.attendanceEvidence.filter(
          (item) =>
            !(
              item.eventId === event.id &&
              item.userId === userId &&
              item.kind === "development_location_dwell"
            ),
        ),
        [evidence],
      );
      const eligibility = getEventMomentEligibility(
        event,
        userId,
        attendanceEvidence,
      );

      return {
        ...current,
        attendanceEvidence,
        prompts: upsertEventMomentPrompt(current.prompts, {
          promptId: localId("event-moment-prompt"),
          eventId: event.id,
          userId,
          eligibility,
          now,
          initialStatus: "shown",
        }),
      };
    });

    return true;
  }

  function dismissPrompt(eventId: string, userId: string) {
    const now = new Date().toISOString();
    setStore((current) => ({
      ...current,
      prompts: updateEventMomentPromptStatus(current.prompts, {
        eventId,
        userId,
        status: "dismissed",
        now,
      }),
    }));
  }

  function captureMoment(input: {
    event: Event;
    author: CampusMintUser;
    mediaType: "image" | "video";
    caption: string;
    privacy: EventMomentPrivacy;
  }) {
    const eligibility = getEligibility(input.event, input.author.account.id);
    if (!eligibility.eligible) return null;

    const now = new Date();
    const createdAt = now.toISOString();
    const momentId = localId("event-moment");
    const moment = {
      id: momentId,
      eventId: input.event.id,
      authorUserId: input.author.account.id,
      authorUniversityId: accountUniversityId(input.author),
      authorUniversityIdentityId:
        input.author.account.universityIdentityId ?? null,
      eventCampusId: input.event.campus,
      media: {
        id: localId("event-moment-media"),
        type: input.mediaType,
        url: null,
        thumbnailUrl: null,
        placeholderId:
          input.mediaType === "image" ? ("event-photo" as const) : ("event-video" as const),
        isDevelopmentPlaceholder: true as const,
      },
      caption: input.caption.trim() || null,
      privacy: input.privacy,
      createdAt,
      expiresAt: new Date(now.getTime() + EVENT_MOMENT_LIFETIME_MS).toISOString(),
      kept: false,
      keptAt: null,
      attendanceEvidence: eligibility.qualifyingEvidence,
      isDevelopmentLocal: true as const,
    };

    setStore((current) => ({
      ...current,
      moments: [...current.moments, moment],
      prompts: updateEventMomentPromptStatus(current.prompts, {
        eventId: input.event.id,
        userId: input.author.account.id,
        status: "captured",
        now: createdAt,
        capturedMomentId: momentId,
      }),
    }));

    return moment;
  }

  function keepMoment(momentId: string, actorUserId: string) {
    const now = new Date().toISOString();
    setStore((current) => ({
      ...current,
      moments: current.moments.map((moment) =>
        moment.id === momentId
          ? preserveEventMoment(moment, actorUserId, now)
          : moment,
      ),
    }));
  }

  return {
    ...store,
    hydrated,
    currentTime,
    isAttending,
    getEligibility,
    getPrompt,
    toggleRsvp,
    simulateQualifyingLocationAttendance,
    dismissPrompt,
    captureMoment,
    keepMoment,
  };
}

export type EventMomentsState = ReturnType<typeof useEventMoments>;
