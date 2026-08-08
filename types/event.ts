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
  location: string;
  audience: string;
  rsvpCount: number;
};
