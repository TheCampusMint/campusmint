import type { SocialMedia } from "@/types/content";

export const eventMomentPrivacyOptions = [
  { id: "private", label: "Private" },
  { id: "followers", label: "Followers" },
  { id: "public", label: "Public" },
] as const;

export type EventMomentPrivacy =
  (typeof eventMomentPrivacyOptions)[number]["id"];

export type EventMomentMedia = Pick<
  SocialMedia,
  "id" | "type" | "url" | "thumbnailUrl" | "isDevelopmentPlaceholder"
> & {
  placeholderId: "event-photo" | "event-video";
};

export type RsvpAttendanceEvidence = {
  id: string;
  kind: "rsvp_attending";
  attendanceClassification: "planned_attendance";
  eventId: string;
  userId: string;
  recordedAt: string;
};

export type DevelopmentLocationAttendanceEvidence = {
  id: string;
  kind: "development_location_dwell";
  attendanceClassification: "likely_attendance";
  eventId: string;
  userId: string;
  optedIn: true;
  nearbyStartedAt: string;
  nearbyEndedAt: string;
  recordedAt: string;
  isDevelopmentSimulation: true;
};

export type EventMomentAttendanceEvidence =
  | RsvpAttendanceEvidence
  | DevelopmentLocationAttendanceEvidence;

export type EventMomentPromptStatus =
  | "pending"
  | "shown"
  | "dismissed"
  | "captured";

export type EventMomentPrompt = {
  id: string;
  eventId: string;
  userId: string;
  status: EventMomentPromptStatus;
  attendanceEvidence: EventMomentAttendanceEvidence[];
  createdAt: string;
  updatedAt: string;
  shownAt: string | null;
  dismissedAt: string | null;
  capturedMomentId: string | null;
};

export type EventMoment = {
  id: string;
  eventId: string;
  authorUserId: string;
  authorUniversityId: string | null;
  authorUniversityIdentityId: string | null;
  eventCampusId: string;
  media: EventMomentMedia;
  caption: string | null;
  privacy: EventMomentPrivacy;
  createdAt: string;
  expiresAt: string;
  kept: boolean;
  keptAt: string | null;
  attendanceEvidence: EventMomentAttendanceEvidence[];
  isDevelopmentLocal: true;
};

export type EventRsvpState = {
  eventId: string;
  userId: string;
  status: "attending" | "cancelled";
  respondedAt: string;
};

export type EventMomentDevelopmentStore = {
  version: 1;
  rsvps: EventRsvpState[];
  attendanceEvidence: EventMomentAttendanceEvidence[];
  prompts: EventMomentPrompt[];
  moments: EventMoment[];
};
