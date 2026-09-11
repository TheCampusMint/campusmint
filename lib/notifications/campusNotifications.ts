import type {
  CampusNotification,
  NotificationDestination,
} from "../../types/notification.ts";
import type { UserBlock } from "../../types/social.ts";

export function sortCampusNotifications(
  notifications: readonly CampusNotification[],
) {
  return [...notifications].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime() ||
      first.id.localeCompare(second.id),
  );
}

export function getVisibleCampusNotifications(input: {
  notifications: readonly CampusNotification[];
  viewerId: string;
  blocks: readonly UserBlock[];
}) {
  const blockedIds = new Set(
    input.blocks.flatMap((block) =>
      block.blockerId === input.viewerId
        ? [block.blockedId]
        : block.blockedId === input.viewerId
          ? [block.blockerId]
          : [],
    ),
  );
  return sortCampusNotifications(
    input.notifications.filter(
      (notification) =>
        notification.recipientId === input.viewerId &&
        (!notification.actor.userId ||
          !blockedIds.has(notification.actor.userId)),
    ),
  );
}

export function getUnreadNotificationCount(
  notifications: readonly CampusNotification[],
) {
  return notifications.filter((notification) => !notification.readAt).length;
}

export function markCampusNotificationRead(
  notifications: readonly CampusNotification[],
  notificationId: string,
  readAt: string,
) {
  return notifications.map((notification) =>
    notification.id === notificationId && !notification.readAt
      ? { ...notification, readAt }
      : notification,
  );
}

export function markAllCampusNotificationsRead(
  notifications: readonly CampusNotification[],
  readAt: string,
) {
  return notifications.map((notification) =>
    notification.readAt ? notification : { ...notification, readAt },
  );
}

export function resolveNotificationDeepLink(
  notification: CampusNotification,
): NotificationDestination {
  return notification.destination;
}
