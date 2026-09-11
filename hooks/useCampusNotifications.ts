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
import type { CampusNotification } from "@/types/notification";
import type { UserBlock } from "@/types/social";

function storageKey(userId: string) {
  return `campusmint:notifications:${userId}:v1`;
}

export function useCampusNotifications(
  currentUserId: string,
  blocks: readonly UserBlock[],
) {
  const [notifications, setNotifications] = useState<CampusNotification[]>(() =>
    areDevelopmentFixturesEnabled() ? createDevelopmentNotifications(Date.now()) : [],
  );
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
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
  }, [currentUserId]);

  useEffect(() => {
    if (!hydrated) return;
    const readAtById = Object.fromEntries(
      notifications.flatMap((notification) =>
        notification.readAt ? [[notification.id, notification.readAt]] : [],
      ),
    );
    window.localStorage.setItem(
      storageKey(currentUserId),
      JSON.stringify({ version: 1, readAtById }),
    );
  }, [currentUserId, hydrated, notifications]);

  const visibleNotifications = useMemo(
    () => getVisibleCampusNotifications({
      notifications,
      viewerId: currentUserId,
      blocks,
    }),
    [blocks, currentUserId, notifications],
  );

  return {
    notifications: visibleNotifications,
    unreadCount: getUnreadNotificationCount(visibleNotifications),
    markRead(notificationId: string) {
      setNotifications((current) =>
        markCampusNotificationRead(
          current,
          notificationId,
          new Date().toISOString(),
        ),
      );
    },
    markAllRead() {
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        markAllCampusNotificationsRead(current, readAt),
      );
    },
  };
}

export type CampusNotificationsState = ReturnType<typeof useCampusNotifications>;
