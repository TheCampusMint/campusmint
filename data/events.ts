import type { Event, EventSourceProvenance } from "../types/event.ts";

const verifiedAt = "2026-09-10T12:00:00-05:00";
const tamuSource = (sourceEventId: string): EventSourceProvenance => ({
  sourceTitle: "Texas A&M University Events Calendar",
  sourceUrl: "https://calendar.tamu.edu/",
  sourceType: "university",
  sourceEventId,
  sourceUpdatedAt: verifiedAt,
  ingestedAt: verifiedAt,
  verifiedAt,
});
const visitCollegeStationSource = (sourceEventId: string, sourceUrl: string): EventSourceProvenance => ({
  sourceTitle: "Visit College Station",
  sourceUrl,
  sourceType: "tourism",
  sourceEventId,
  sourceUpdatedAt: verifiedAt,
  ingestedAt: verifiedAt,
  verifiedAt,
});

/**
 * Last-known verified source snapshot. Production refresh writes the same
 * normalized shape to Supabase; this file is never a demo/synthetic feed.
 */
export const campusEvents: Event[] = [
  {
    id: "tamu-volunteer-opportunities-fair-2026-09-10",
    title: "Volunteer Opportunities Fair",
    description: "Meet organizations offering volunteer opportunities and learn how to get involved.",
    campus: "tamu", category: "Volunteer", date: "Thursday, September 10, 2026", time: "1:30 PM–5:30 PM",
    eventStartAt: "2026-09-10T13:30:00-05:00", eventEndAt: "2026-09-10T17:30:00-05:00", timeZone: "America/Chicago",
    location: "Memorial Student Center", city: "College Station", latitude: 30.6123, longitude: -96.3415,
    organizer: "Texas A&M University", audience: "Students and campus community", rsvpCount: 0, status: "scheduled",
    source: tamuSource("volunteer-opportunities-fair-2026"), sourceTrust: "verified_source", systemGenerated: true,
  },
  {
    id: "tamu-murderbot-panel-2026-09-10",
    title: "Free Panel Event for ‘Murderbot’ TV Series",
    description: "A free public panel event connected to the television series at Rudder Theater.",
    campus: "tamu", category: "Social", date: "Thursday, September 10, 2026", time: "7:00 PM",
    eventStartAt: "2026-09-10T19:00:00-05:00", timeZone: "America/Chicago", location: "Rudder Theater",
    city: "College Station", latitude: 30.6131, longitude: -96.3395, organizer: "Texas A&M University",
    audience: "Open to the public", rsvpCount: 0, status: "scheduled", source: tamuSource("murderbot-panel-2026"), sourceTrust: "verified_source", systemGenerated: true,
  },
  {
    id: "tamu-911-remembrance-2026-09-11",
    title: "25th Anniversary 9/11 Remembrance",
    description: "A remembrance honoring lives lost and acts of resilience and bravery on September 11.",
    campus: "tamu", category: "Social", date: "Friday, September 11, 2026", time: "9:00 AM",
    eventStartAt: "2026-09-11T09:00:00-05:00", timeZone: "America/Chicago", location: "Annenberg Presidential Conference Center",
    city: "College Station", latitude: 30.5965, longitude: -96.3535, organizer: "Bush School of Government & Public Service",
    audience: "Open to the public", rsvpCount: 0, status: "scheduled", source: tamuSource("911-remembrance-2026"), sourceTrust: "verified_source", systemGenerated: true,
  },
  {
    id: "tamu-inherited-landscapes-2026-09-12",
    title: "Inherited Landscapes",
    description: "A public gallery exhibition at the J. Wayne Stark Galleries.",
    campus: "tamu", category: "Social", date: "Saturday, September 12, 2026", time: "12:00 PM–6:00 PM",
    eventStartAt: "2026-09-12T12:00:00-05:00", eventEndAt: "2026-09-12T18:00:00-05:00", timeZone: "America/Chicago",
    location: "J. Wayne Stark Galleries", city: "College Station", latitude: 30.6124, longitude: -96.3416,
    organizer: "Texas A&M University", audience: "Open to the public", rsvpCount: 0, status: "scheduled",
    source: tamuSource("inherited-landscapes-2026"), sourceTrust: "verified_source", systemGenerated: true,
  },
  {
    id: "tamu-aiden-ross-homecoming-2026-09-18",
    title: "OPAS presents Aiden Ross: Homecoming",
    description: "A public evening performance presented by OPAS at Rudder Auditorium.",
    campus: "tamu", category: "Social", date: "Friday, September 18, 2026", time: "7:30 PM",
    eventStartAt: "2026-09-18T19:30:00-05:00", timeZone: "America/Chicago", location: "Rudder Auditorium",
    city: "College Station", latitude: 30.6131, longitude: -96.3395, organizer: "OPAS",
    audience: "Ticketed public event", rsvpCount: 0, status: "scheduled", source: tamuSource("aiden-ross-homecoming-2026"), sourceTrust: "verified_source", systemGenerated: true,
  },
  {
    id: "tamu-game-day-physics-2026-09-19",
    title: "Game Day Physics",
    description: "A campus physics program held before the Texas A&M home football game.",
    campus: "tamu", category: "Sports", date: "Saturday, September 19, 2026", time: "12:30 PM–1:30 PM",
    eventStartAt: "2026-09-19T12:30:00-05:00", eventEndAt: "2026-09-19T13:30:00-05:00", timeZone: "America/Chicago",
    location: "Mitchell Physics Building", city: "College Station", latitude: 30.6191, longitude: -96.3417,
    organizer: "Texas A&M University", audience: "Students, families, and visitors", rsvpCount: 0, status: "scheduled",
    source: tamuSource("game-day-physics-2026"), sourceTrust: "verified_source", systemGenerated: true,
  },
  {
    id: "tamu-global-welcome-party-2026-09-25",
    title: "Global Welcome Party",
    description: "A campus welcome gathering at the Aggie Park Amphitheater.",
    campus: "tamu", category: "Social", date: "Friday, September 25, 2026", time: "6:00 PM–10:00 PM",
    eventStartAt: "2026-09-25T18:00:00-05:00", eventEndAt: "2026-09-25T22:00:00-05:00", timeZone: "America/Chicago",
    location: "Aggie Park Amphitheater", address: "756 Houston St", city: "College Station", latitude: 30.6082, longitude: -96.3414,
    organizer: "Texas A&M University", audience: "Campus community", rsvpCount: 0, status: "scheduled",
    source: tamuSource("global-welcome-party-2026"), sourceTrust: "verified_source", systemGenerated: true,
  },
  {
    id: "tamu-jazz-ensembles-2026-09-25",
    title: "University Jazz Ensembles in Concert",
    description: "Texas A&M university jazz ensembles perform at Rudder Theater.",
    campus: "tamu", category: "Social", date: "Friday, September 25, 2026", time: "7:00 PM",
    eventStartAt: "2026-09-25T19:00:00-05:00", timeZone: "America/Chicago", location: "Rudder Theater",
    city: "College Station", latitude: 30.6131, longitude: -96.3395, organizer: "Texas A&M University",
    audience: "Open to the public", rsvpCount: 0, status: "scheduled", source: tamuSource("university-jazz-ensembles-2026"), sourceTrust: "verified_source", systemGenerated: true,
  },
  {
    id: "cstx-century-square-spooky-cinema-2026-10-23",
    title: "Century Square’s Spooky Cinema",
    description: "An outdoor screening of Practical Magic on The Green; blankets and lawn chairs are welcome.",
    campus: "tamu", category: "Social", date: "Friday, October 23, 2026", time: "7:00 PM–9:00 PM",
    eventStartAt: "2026-10-23T19:00:00-05:00", eventEndAt: "2026-10-23T21:00:00-05:00", timeZone: "America/Chicago",
    location: "The Green at Century Square", address: "175 Century Square Dr", city: "College Station", latitude: 30.622, longitude: -96.34,
    organizer: "Century Square", audience: "Free and open to the public", rsvpCount: 0, status: "scheduled",
    source: visitCollegeStationSource("century-square-spooky-cinema-2026", "https://visit.cstx.gov/events/century-squares-spooky-cinema/"), sourceTrust: "verified_source", systemGenerated: true,
  },
];

// Compatibility name while existing non-Search consumers migrate to the DB repository.
export const sampleEvents = campusEvents;
