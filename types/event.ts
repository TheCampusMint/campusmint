export const eventCategories = [
  "Sports",
  "Clubs",
  "Career",
  "Social",
  "Volunteer",
] as const;

export type EventCategory = (typeof eventCategories)[number];

export type Event = {
  id: string;
  title: string;
  description: string;
  campus: string;
  category: EventCategory;
  date: string;
  time: string;
  eventStartAt: string;
  eventEndAt?: string;
  timeZone: string;
  location: string;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  organizer?: string | null;
  audience: string;
  rsvpCount: number;
  organizationId?: string;
  crossCampus?: boolean;
  status?: "scheduled" | "updated" | "cancelled" | "completed";
  source?: EventSourceProvenance | null;
  systemGenerated?: boolean;
  authorBrandId?: string | null;
  authorUserId?: string | null;
  sourceTrust?: "verified_source" | "verified_brand" | "authenticated_organizer";
  distanceFromCampusMiles?: number | null;
  mediaStrategy?: "official" | "generated_poster" | "text_card" | "text_only";
};

export type EventSourceProvenance = {
  sourceTitle: string;
  sourceUrl: string;
  sourceType:
    | "university"
    | "student_organization"
    | "department"
    | "city"
    | "tourism"
    | "venue"
    | "brand"
    | "student"
    | "trusted_public";
  sourceEventId?: string | null;
  sourceUpdatedAt?: string | null;
  ingestedAt?: string;
  verifiedAt: string;
  officialImageUrl?: string | null;
  imageDisplayPermitted?: boolean;
};
