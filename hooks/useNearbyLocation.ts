"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UniversityTheme } from "@/data/universities";
import { distanceMiles } from "@/lib/events/geography";
import type { Coordinates } from "@/lib/discovery/nearby";
/** Coordinates live in memory only. Stop the watch when the app is hidden. */
export function useNearbyLocation(theme: UniversityTheme) {
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const request = useCallback(() => { setError(""); setEnabled(true); setRevision(r => r + 1); }, []);
  useEffect(() => {
    let active = true;
    navigator.permissions?.query({ name: "geolocation" }).then(permission => {
      const change = () => { if (active) { setEnabled(permission.state === "granted"); if (permission.state !== "granted") setPosition(null); } };
      change(); permission.addEventListener("change", change);
      cleanup = () => permission.removeEventListener("change", change);
    }).catch(() => {});
    let cleanup = () => {};
    return () => { active = false; cleanup(); };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let watch: number | undefined;
    const stop = () => { if (watch !== undefined) navigator.geolocation?.clearWatch(watch); watch = undefined; };
    const start = () => {
      stop(); if (document.hidden) return;
      if (!navigator.geolocation) { setError("Location unavailable"); return; }
      watch = navigator.geolocation.watchPosition(result => {
        // An inaccurate fix must not pretend to enforce a ten-mile boundary.
        if (result.coords.accuracy > 1600) { setPosition(null); setError("Location is approximate"); return; }
        setError("");
        const next = { latitude: result.coords.latitude, longitude: result.coords.longitude };
        setPosition(old => !old || distanceMiles(old,next) > .1 ? next : old);
      }, () => { setPosition(null); setError("Location unavailable"); }, { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 });
    };
    start(); document.addEventListener("visibilitychange", start);
    return () => { stop(); document.removeEventListener("visibilitychange",start); };
  }, [enabled, revision]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setRevision(r => r + 1); };
    const interval = window.setInterval(refresh, 300_000);
    window.addEventListener("focus",refresh);
    return () => { clearInterval(interval); window.removeEventListener("focus",refresh); };
  }, []);
  const origin = useMemo(() => position ?? { latitude: theme.campusLatitude, longitude: theme.campusLongitude }, [position,theme.campusLatitude,theme.campusLongitude]);
  return { origin, isDeviceLocation: !!position, label: position ? "Within 10 miles" : "Near campus · 10 miles", error, request, revision };
}
