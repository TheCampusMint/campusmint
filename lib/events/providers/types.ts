import type { DiscoveredEvent } from "../systemEventIngestion.ts";

export type EventSourceAdapter = {
  id: string;
  campusId: string;
  name: string;
  sourceUrl: string;
  refreshEveryMinutes: number;
  automation: "enabled" | "manual_review_required";
  fetchEvents: (window: { startsAt: Date; endsAt: Date }) => Promise<DiscoveredEvent[]>;
};
