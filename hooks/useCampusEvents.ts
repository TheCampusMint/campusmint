"use client";

import { useEffect, useState } from "react";
import { campusEvents as lastVerifiedEvents } from "@/data/events";
import type { Event } from "@/types/event";

export function useCampusEvents() {
  const [events, setEvents] = useState<Event[]>(lastVerifiedEvents);
  const [loading, setLoading] = useState(true);
  const [usingLastVerifiedSnapshot, setUsingLastVerifiedSnapshot] = useState(true);
  useEffect(() => {
    let active = true;
    fetch("/api/events", { cache: "no-store" })
      .then(async (response) => ({ response, payload: await response.json() as { ok?: boolean; events?: Event[] } }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (response.ok && payload.ok && payload.events?.length) {
          setEvents(payload.events); setUsingLastVerifiedSnapshot(false);
        }
      })
      .catch(() => null)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { events, loading, usingLastVerifiedSnapshot };
}

export type CampusEventsState = ReturnType<typeof useCampusEvents>;
