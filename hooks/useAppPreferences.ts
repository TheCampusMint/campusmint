"use client";

import { useCallback, useEffect, useState } from "react";

import type { AppPreferences, AppearancePreferences, ContentPreferences, NotificationPreferences } from "@/types/preferences";

export const APP_PREFERENCES_STORAGE_KEY = "campusmint.preferences.v1";

export const defaultAppPreferences: AppPreferences = {
  appearance: { mode: "campus", tint: "slate" },
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
    reducedMotion: false,
  },
};

function loadPreferences() {
  try {
    const stored = window.localStorage.getItem(APP_PREFERENCES_STORAGE_KEY);
    if (!stored) return defaultAppPreferences;
    const parsed = JSON.parse(stored) as Partial<AppPreferences>;
    return {
      appearance: { ...defaultAppPreferences.appearance, ...parsed.appearance },
      notifications: { ...defaultAppPreferences.notifications, ...parsed.notifications },
      content: { ...defaultAppPreferences.content, ...parsed.content },
    };
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
    window.localStorage.setItem(APP_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
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
