import { CURRENT_DEVELOPMENT_USER_ID } from "./users.ts";
import type { CampusNotification } from "../../types/notification.ts";

export const DEVELOPMENT_NOTIFICATION_REFERENCE_TIME =
  Date.parse("2026-08-29T18:00:00.000Z");

export function createDevelopmentNotifications(
  referenceTime = DEVELOPMENT_NOTIFICATION_REFERENCE_TIME,
): CampusNotification[] {
  const minutesAgo = (minutes: number) =>
    new Date(referenceTime - minutes * 60_000).toISOString();

  return [
    {
      id: "dev-notification-message-maya",
      recipientId: CURRENT_DEVELOPMENT_USER_ID,
      type: "private_message",
      actor: { kind: "person", id: "demo-seller-tamu", displayName: "Maya", userId: "demo-seller-tamu" },
      body: "Maya sent you a message",
      preview: "hi",
      createdAt: minutesAgo(2),
      readAt: null,
      destination: { scene: "message", userId: "demo-seller-tamu" },
      soundEvent: "direct_message_received",
      metadata: { conversationPreview: "hi" },
      isDevelopment: true,
    },
    {
      id: "dev-notification-follow-noah",
      recipientId: CURRENT_DEVELOPMENT_USER_ID,
      type: "person_follow",
      actor: { kind: "person", id: "demo-tamu-noah", displayName: "Noah Williams", userId: "demo-tamu-noah" },
      body: "Noah Williams followed you",
      preview: null,
      createdAt: minutesAgo(8),
      readAt: null,
      destination: { scene: "profile", userId: "demo-tamu-noah" },
      soundEvent: "standard_notification",
      metadata: {},
      isDevelopment: true,
    },
    {
      id: "dev-notification-club-invite",
      recipientId: CURRENT_DEVELOPMENT_USER_ID,
      type: "club_invite",
      actor: { kind: "organization", id: "dev-tamu-robotics", displayName: "Robotics Collective", userId: null },
      body: "Robotics Collective invited you",
      preview: "Open build night community",
      createdAt: minutesAgo(24),
      readAt: null,
      destination: { scene: "organization", organizationId: "dev-tamu-robotics" },
      soundEvent: "standard_notification",
      metadata: { organizationId: "dev-tamu-robotics" },
      isDevelopment: true,
    },
    {
      id: "dev-notification-group-accepted",
      recipientId: CURRENT_DEVELOPMENT_USER_ID,
      type: "group_request_accepted",
      actor: { kind: "organization", id: "dev-tamu-product-builders", displayName: "Product Builders", userId: null },
      body: "Your group request was accepted",
      preview: "Product Builders",
      createdAt: minutesAgo(47),
      readAt: minutesAgo(39),
      destination: { scene: "organization", organizationId: "dev-tamu-product-builders" },
      soundEvent: "standard_notification",
      metadata: { decision: "accepted" },
      isDevelopment: true,
    },
    {
      id: "dev-notification-sports-final",
      recipientId: CURRENT_DEVELOPMENT_USER_ID,
      type: "sports_final",
      actor: { kind: "team", id: "tamu-football", displayName: "Texas A&M Football", userId: null },
      body: "Texas A&M 24 — LSU 17",
      preview: "Final",
      createdAt: minutesAgo(75),
      readAt: null,
      destination: { scene: "sports", universityId: "tamu", sport: "football", gameId: "dev-tamu-lsu-final" },
      soundEvent: "standard_notification",
      metadata: { homeScore: 24, awayScore: 17, status: "final" },
      isDevelopment: true,
    },
    {
      id: "dev-notification-event-update",
      recipientId: CURRENT_DEVELOPMENT_USER_ID,
      type: "event_update",
      actor: { kind: "system", id: "campus-mint-events", displayName: "Campus Mint Events", userId: null },
      body: "12th Man Kickoff Tailgate was updated",
      preview: "New location details are available",
      createdAt: minutesAgo(110),
      readAt: null,
      destination: { scene: "event", eventId: "aggie-kickoff-tailgate" },
      soundEvent: "urgent_event_reminder",
      metadata: { eventId: "aggie-kickoff-tailgate" },
      isDevelopment: true,
    },
  ];
}
