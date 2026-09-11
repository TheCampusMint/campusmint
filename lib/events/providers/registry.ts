import "server-only";

import { texasAmCalendarAdapter } from "./texasAmCalendar.ts";
import type { EventSourceAdapter } from "./types.ts";

const manualAdapter = (id: string, name: string, sourceUrl: string): EventSourceAdapter => ({
  id, campusId: "tamu", name, sourceUrl, refreshEveryMinutes: 720,
  automation: "manual_review_required",
  async fetchEvents() { return []; },
});

export const eventSourceAdapters: readonly EventSourceAdapter[] = [
  texasAmCalendarAdapter,
  manualAdapter("visit-college-station", "Visit College Station", "https://visit.cstx.gov/events/"),
  manualAdapter("destination-bryan", "Destination Bryan", "https://www.destinationbryan.com/events/"),
];

export function getAutomatedEventSourceAdapters(campusId?: string) {
  return eventSourceAdapters.filter((adapter) => adapter.automation === "enabled" && (!campusId || adapter.campusId === campusId));
}
