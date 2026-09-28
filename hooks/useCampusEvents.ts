"use client";

import { useEffect, useState } from "react";
import { campusEvents as lastVerifiedEvents } from "@/data/events";
import { universities, type UniversityId } from "@/data/universities";
import { campusReadScope } from "@/lib/runtime/campusPreview";
import type { Event } from "@/types/event";

export function useCampusEvents(requestedUniversityId?: UniversityId | null, accountId = "") {
  const scope = campusReadScope(accountId, requestedUniversityId);
  const [state, setState] = useState<{ scope: string; events: Event[]; loading: boolean; usingLastVerifiedSnapshot: boolean }>({ scope: "", events: [], loading: true, usingLastVerifiedSnapshot: true });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const query = requestedUniversityId
      ? `?universityId=${encodeURIComponent(requestedUniversityId)}`
      : "";
    fetch(`/api/events${query}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json() as { ok?: boolean; events?: Event[] } }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok || !payload.ok || !payload.events) throw new Error("Events unavailable");
        setState({ scope, events: payload.events, loading: false, usingLastVerifiedSnapshot: false });
      })
      .catch(() => {
        if (active) setState({ scope, events: requestedUniversityId ? lastVerifiedEvents.filter((event) => universities[requestedUniversityId].accessibleCampuses.includes(event.campus)) : [], loading: false, usingLastVerifiedSnapshot: true });
      });
    return () => { active = false; controller.abort(); };
  }, [requestedUniversityId, scope]);
  // Hide the previous campus during render, before the next effect runs.
  return state.scope === scope ? state : { scope, events: [], loading: true, usingLastVerifiedSnapshot: false };
}

export type CampusEventsState = ReturnType<typeof useCampusEvents>;
