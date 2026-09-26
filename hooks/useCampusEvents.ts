"use client";

import { useEffect, useState } from "react";
import { campusEvents as lastVerifiedEvents } from "@/data/events";
import type { UniversityId } from "@/data/universities";
import type { Event } from "@/types/event";

export function useCampusEvents(requestedUniversityId?: UniversityId | null) {
  const [events, setEvents] = useState<Event[]>(lastVerifiedEvents);
  const [loading, setLoading] = useState(true);
  const [usingLastVerifiedSnapshot, setUsingLastVerifiedSnapshot] = useState(true);
  useEffect(() => {
    let active = true;
    const query = requestedUniversityId
      ? `?universityId=${encodeURIComponent(requestedUniversityId)}`
      : "";
    fetch(`/api/events${query}`, { cache: "no-store" })
      .then(async (response) => ({ response, payload: await response.json() as { ok?: boolean; events?: Event[] } }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (response.ok && payload.ok && payload.events) {
          setEvents(payload.events); setUsingLastVerifiedSnapshot(false);
        }
      })
      .catch(() => null)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestedUniversityId]);
  return { events, loading, usingLastVerifiedSnapshot };
}

export type CampusEventsState = ReturnType<typeof useCampusEvents>;
