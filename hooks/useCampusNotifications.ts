"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { createDevelopmentNotifications } from "@/data/development/notifications";
import { areDevelopmentFixturesEnabled } from "@/lib/runtime/fixturePolicy";
import {
  getUnreadNotificationCount,
  getVisibleCampusNotifications,
  markAllCampusNotificationsRead,
  markCampusNotificationRead,
} from "@/lib/notifications/campusNotifications";
import { useSocialSync } from "@/hooks/useSocialSync";
import { socialWrite } from "@/lib/social/syncClient";
import { mapServerNotification, type ServerNotification } from "@/lib/notifications/serverNotifications";
import type { CampusNotification } from "@/types/notification";
import type { UserBlock } from "@/types/social";

function storageKey(userId: string) {
  return `campusmint:notifications:${userId}:v1`;
}

export function useCampusNotifications(
  currentUserId: string,
  blocks: readonly UserBlock[],
) {
  const production = !areDevelopmentFixturesEnabled();
  const remote = useSocialSync<{items: ServerNotification[]; hasMore: boolean}>(currentUserId, "notifications", undefined, production);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<CampusNotification[]>(() =>
    areDevelopmentFixturesEnabled() ? createDevelopmentNotifications(Date.now()) : [],
  );
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    if (production) return;
    try {
      const stored = window.localStorage.getItem(storageKey(currentUserId));
      if (!stored) return;
      const parsed = JSON.parse(stored) as { readAtById?: Record<string, string> };
      if (!parsed.readAtById || typeof parsed.readAtById !== "object") return;
      // Only read state is persisted; fixture content remains authoritative.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: parsed.readAtById?.[notification.id] ?? notification.readAt,
        })),
      );
    } catch {
      // Ignore malformed local state without clearing unrelated storage.
    } finally {
      setHydrated(true);
    }
  }, [currentUserId, production]);

  useEffect(() => {
    if (production || !hydrated) return;
    const readAtById = Object.fromEntries(
      notifications.flatMap((notification) =>
        notification.readAt ? [[notification.id, notification.readAt]] : [],
      ),
    );
    window.localStorage.setItem(
      storageKey(currentUserId),
      JSON.stringify({ version: 1, readAtById }),
    );
  }, [currentUserId, hydrated, notifications, production]);

  const visibleNotifications = useMemo(
    () => getVisibleCampusNotifications({
      notifications: production ? (remote.data?.items ?? []).flatMap(row => { const item = mapServerNotification(row, currentUserId); return item ? [item] : []; }) : notifications,
      viewerId: currentUserId,
      blocks,
    }),
    [blocks, currentUserId, notifications, production, remote.data],
  );

  function persistRead(id?: string) {
    setWriteError(null);
    void socialWrite("notification_read", id).then(() => remote.refresh()).catch(error => {
      setWriteError(error instanceof Error ? error.message : "Could not mark as read.");
    });
  }

  return {
    error: production ? writeError ?? remote.error : null,
    loading: production && !remote.data && !remote.error,
    retry: remote.refresh,
    hasMore: remote.data?.hasMore ?? false,
    loadMore: remote.loadMore,
    notifications: visibleNotifications,
    unreadCount: getUnreadNotificationCount(visibleNotifications),
    markRead(notificationId: string) {
      if (production) { persistRead(notificationId); return; }
      setNotifications((current) =>
        markCampusNotificationRead(
          current,
          notificationId,
          new Date().toISOString(),
        ),
      );
    },
    markAllRead() {
      if (production) { persistRead(); return; }
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        markAllCampusNotificationsRead(current, readAt),
      );
    },
  };
}

export type CampusNotificationsState = ReturnType<typeof useCampusNotifications>;
