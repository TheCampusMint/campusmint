import type { DiscoveredEvent } from "../../lib/events/systemEventIngestion.ts";

export const developmentSystemEventCandidates: DiscoveredEvent[] = [
  {
    title: "Open Mic Night — Development Source Fixture",
    description: "A source-bound development event used to test Campus Mint event discovery without claiming live ingestion.",
    campus: "tamu", category: "Social", date: "Friday, September 18, 2026",
    time: "7:00 PM – 9:00 PM", eventStartAt: "2026-09-18T19:00:00-05:00",
    eventEndAt: "2026-09-18T21:00:00-05:00", timeZone: "America/Chicago",
    location: "MSC Courtyard", audience: "Campus community", rsvpCount: 24,
    status: "scheduled", organizer: null,
    sourceTrust: "verified_source",
    source: {
      sourceTitle: "Texas A&M Events Calendar — development fixture",
      sourceUrl: "https://events.tamu.edu/",
      sourceType: "university", verifiedAt: "2026-09-10T14:00:00.000Z",
      officialImageUrl: null, imageDisplayPermitted: false,
    },
  },
  {
    title: "12th Man Kickoff Tailgate", description: "Duplicate suppression fixture.",
    campus: "tamu", category: "Sports", date: "Saturday, September 5, 2026",
    time: "11:00 AM – 2:00 PM", eventStartAt: "2026-09-05T11:00:00-05:00",
    eventEndAt: "2026-09-05T14:00:00-05:00", timeZone: "America/Chicago",
    location: "Aggie Park", audience: "Campus community", rsvpCount: 0,
    sourceTrust: "verified_source",
    source: { sourceTitle: "Development duplicate source", sourceUrl: "https://events.tamu.edu/duplicate-development", sourceType: "university", verifiedAt: "2026-09-01T12:00:00.000Z" },
  },
];
