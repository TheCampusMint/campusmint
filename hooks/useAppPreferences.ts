"use client";

import { useCallback, useEffect, useState } from "react";

import type { AppPreferences, AppearancePreferences, ContentPreferences, NotificationPreferences } from "@/types/preferences";

export const APP_PREFERENCES_STORAGE_KEY = "campusmint.preferences.v1";

export const defaultAppPreferences: AppPreferences = {
  appearance: { scheme: "light", accentSource: "campus", tint: "slate" },
  notifications: {
    sounds: true,
    messages: true,
    clubUpdates: true,
    eventReminders: true,
    mentions: true,
    marketplaceMessages: true,
  },
  content: {
    hideLikeCountsDefault: false,
    commentsDefault: true,
    autoplayVideo: true,
    highQualityUploads: false,
    reducedMotion: false,
    autoArchiveTemporaryMintz: true,
    saveCapturedMediaToDevice: false,
  },
};

export function normalizeAppPreferences(value: unknown): AppPreferences {
  if (!value || typeof value !== "object") return defaultAppPreferences;
  const parsed = value as Partial<AppPreferences> & {
    appearance?: Partial<AppearancePreferences> & {
      mode?: "light" | "dark" | "campus" | "curated";
    };
  };
  const { mode: legacyMode, scheme, accentSource, tint } = parsed.appearance ?? {};
  const migratedAppearance: AppearancePreferences = {
    scheme: scheme && ["light", "dark", "colorful"].includes(scheme)
      ? scheme : (legacyMode === "dark" ? "dark" : "light"),
    accentSource: accentSource && ["brand", "campus", "curated"].includes(accentSource)
      ? accentSource
      : legacyMode === "campus" ? "campus"
        : legacyMode === "curated" ? "curated"
          : legacyMode === "light" || legacyMode === "dark" ? "brand"
            : defaultAppPreferences.appearance.accentSource,
    tint: tint && ["slate", "warm-gray", "forest", "deep-navy", "muted-maroon"].includes(tint)
      ? tint : defaultAppPreferences.appearance.tint,
  };
  return {
    appearance: migratedAppearance,
    notifications: { ...defaultAppPreferences.notifications, ...parsed.notifications },
    content: {
      ...defaultAppPreferences.content,
      ...parsed.content,
      highQualityUploads: parsed.content?.highQualityUploads === true,
    },
  };
}

function loadPreferences() {
  try {
    const stored = window.localStorage.getItem(APP_PREFERENCES_STORAGE_KEY);
    return stored ? normalizeAppPreferences(JSON.parse(stored)) : defaultAppPreferences;
  } catch {
    return defaultAppPreferences;
  }
}

export function useAppPreferences() {
  const [preferences, setPreferences] = useState<AppPreferences>(defaultAppPreferences);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreferences(loadPreferences());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(APP_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Appearance still works for this session when browser storage is unavailable.
    }
  }, [hydrated, preferences]);

  const updateAppearance = useCallback((patch: Partial<AppearancePreferences>) => {
    setPreferences((current) => ({ ...current, appearance: { ...current.appearance, ...patch } }));
  }, []);

  const updateNotifications = useCallback((patch: Partial<NotificationPreferences>) => {
    setPreferences((current) => ({ ...current, notifications: { ...current.notifications, ...patch } }));
  }, []);

  const updateContent = useCallback((patch: Partial<ContentPreferences>) => {
    setPreferences((current) => ({ ...current, content: { ...current.content, ...patch } }));
  }, []);

  return { preferences, updateAppearance, updateNotifications, updateContent };
}

export type AppPreferencesState = ReturnType<typeof useAppPreferences>;
