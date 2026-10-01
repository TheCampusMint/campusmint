"use client";
import { useCallback, useMemo, useState } from "react";
import type { UniversityTheme } from "@/data/universities";
import { distanceMiles } from "@/lib/events/geography";
import { nearbyLocationGeneration, readNearbyLocationSession, writeNearbyLocationSession } from "@/lib/providers/places/locationSession";
/** One-shot, explicit location requests only. No watch, interval, focus, or app-open query. */
export function useNearbyLocation(theme: UniversityTheme, userId = "session") {
  const [snapshot, setSnapshot] = useState(() => readNearbyLocationSession(userId));
  const [error, setError] = useState("");
  const request = useCallback(() => {
    setError("");
    if (!navigator.geolocation) { setError("Location unavailable"); return; }
    const generation = nearbyLocationGeneration();
    navigator.geolocation.getCurrentPosition(result => {
      if (generation !== nearbyLocationGeneration()) return;
      if (result.coords.accuracy > 1600) { setError("Location is approximate"); return; }
      const next = { latitude: result.coords.latitude, longitude: result.coords.longitude };
      setSnapshot(old => {
        const previous = old.userId === userId ? old.position : null;
        // Small location jitter doesn't change the search area or cause a paid search.
        const position = !previous || distanceMiles(previous, next) >= .5 ? next : previous;
        const value = { userId, position, revision: position !== previous ? old.revision + 1 : old.revision };
        return writeNearbyLocationSession(value, generation) ? value : old;
      });
    }, () => setError("Location unavailable"), { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 });
  }, [userId]);
  const position = snapshot.userId === userId ? snapshot.position : null;
  const origin = useMemo(() => position ?? { latitude: theme.campusLatitude, longitude: theme.campusLongitude }, [position, theme.campusLatitude, theme.campusLongitude]);
  return { origin, isDeviceLocation: !!position, label: position ? "Within 10 miles" : "Near campus · 10 miles", error, request, revision: snapshot.revision };
}
