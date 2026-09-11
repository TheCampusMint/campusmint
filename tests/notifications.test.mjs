import assert from "node:assert/strict";
import test from "node:test";

import {
  createDevelopmentNotifications,
  DEVELOPMENT_NOTIFICATION_REFERENCE_TIME,
} from "../data/development/notifications.ts";
import {
  getUnreadNotificationCount,
  getVisibleCampusNotifications,
  markAllCampusNotificationsRead,
  markCampusNotificationRead,
  resolveNotificationDeepLink,
} from "../lib/notifications/campusNotifications.ts";
import { campusNotificationTypes } from "../types/notification.ts";

test("typed notification model supports the required people, message, club, group, and sports events", () => {
  for (const type of [
    "person_follow",
    "follow_request",
    "follow_request_accepted",
    "follow_request_declined",
    "private_message",
    "club_invite",
    "group_request_accepted",
    "group_request_denied",
    "sports_score",
    "sports_final",
  ]) {
    assert.equal(campusNotificationTypes.includes(type), true, type);
  }
});

test("read state and unread helpers preserve existing timestamps", () => {
  const fixtures = createDevelopmentNotifications();
  const unread = getUnreadNotificationCount(fixtures);
  const readAt = "2026-08-29T19:00:00.000Z";
  const oneRead = markCampusNotificationRead(fixtures, fixtures[0].id, readAt);
  const allRead = markAllCampusNotificationsRead(oneRead, readAt);

  assert.equal(getUnreadNotificationCount(oneRead), unread - 1);
  assert.equal(oneRead[0].readAt, readAt);
  assert.equal(getUnreadNotificationCount(allRead), 0);
  assert.equal(allRead.find((item) => item.id === "dev-notification-group-accepted").readAt, fixtures.find((item) => item.id === "dev-notification-group-accepted").readAt);
});

test("notification destinations deep-link to dedicated message, profile, organization, and sports scenes", () => {
  const fixtures = createDevelopmentNotifications();
  const destinationFor = (id) => resolveNotificationDeepLink(fixtures.find((item) => item.id === id));

  assert.deepEqual(destinationFor("dev-notification-message-maya"), { scene: "message", userId: "demo-seller-tamu" });
  assert.deepEqual(destinationFor("dev-notification-follow-noah"), { scene: "profile", userId: "demo-tamu-noah" });
  assert.deepEqual(destinationFor("dev-notification-club-invite"), { scene: "organization", organizationId: "dev-tamu-robotics" });
  assert.deepEqual(destinationFor("dev-notification-sports-final"), { scene: "sports", universityId: "tamu", sport: "football", gameId: "dev-tamu-lsu-final" });
});

test("development notification fixtures are deterministic", () => {
  assert.deepEqual(
    createDevelopmentNotifications(DEVELOPMENT_NOTIFICATION_REFERENCE_TIME),
    createDevelopmentNotifications(DEVELOPMENT_NOTIFICATION_REFERENCE_TIME),
  );
});

test("blocked actors and notifications for another recipient do not leak", () => {
  const fixtures = createDevelopmentNotifications();
  const visible = getVisibleCampusNotifications({
    notifications: [
      ...fixtures,
      { ...fixtures[0], id: "other-recipient", recipientId: "someone-else" },
    ],
    viewerId: fixtures[0].recipientId,
    blocks: [{ id: "block-maya", blockerId: fixtures[0].recipientId, blockedId: "demo-seller-tamu", createdAt: "2026-08-29T10:00:00.000Z" }],
  });

  assert.equal(visible.some((item) => item.id === "dev-notification-message-maya"), false);
  assert.equal(visible.some((item) => item.id === "other-recipient"), false);
  assert.equal(visible.some((item) => item.id === "dev-notification-follow-noah"), true);
});
