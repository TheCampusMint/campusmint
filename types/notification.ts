import type { UniversityId } from "@/data/universities";
import type { NotificationEventType } from "@/lib/notifications/notificationSounds";

export const campusNotificationTypes = [
  "person_follow",
  "follow_request",
  "follow_request_accepted",
  "follow_request_declined",
  "private_message",
  "club_announcement",
  "club_invite",
  "group_request_accepted",
  "group_request_denied",
  "event_invite",
  "event_update",
  "sports_start",
  "sports_score",
  "sports_final",
] as const;

export type CampusNotificationType = (typeof campusNotificationTypes)[number];

export type NotificationActor = {
  kind: "person" | "organization" | "team" | "system";
  id: string;
  displayName: string;
  userId: string | null;
};

export type NotificationDestination =
  | { scene: "profile"; userId: string }
  | { scene: "message"; userId: string }
  | { scene: "organization"; organizationId: string }
  | { scene: "event"; eventId: string }
  | {
      scene: "sports";
      universityId: UniversityId;
      sport: "football" | "basketball" | "baseball";
      gameId: string | null;
    };

export type CampusNotification = {
  id: string;
  recipientId: string;
  type: CampusNotificationType;
  actor: NotificationActor;
  body: string;
  preview: string | null;
  createdAt: string;
  readAt: string | null;
  destination: NotificationDestination;
  soundEvent: NotificationEventType;
  metadata: Record<string, string | number | boolean | null>;
  isDevelopment: boolean;
};
