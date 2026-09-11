import "server-only";

import type { EventCategory } from "../../../types/event.ts";
import type { DiscoveredEvent } from "../systemEventIngestion.ts";
import type { EventSourceAdapter } from "./types.ts";

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): UnknownRecord | null => typeof value === "object" && value !== null ? value as UnknownRecord : null;
const string = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && Number.isFinite(Number(value)) ? Number(value) : null;

function plainText(value: unknown, maximum = 360) {
  const text = string(value)?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ?? "";
  return text.slice(0, maximum);
}

function categoryFor(title: string, description: string): EventCategory {
  const value = `${title} ${description}`.toLocaleLowerCase();
  if (/volunteer|service|charity|donation/.test(value)) return "Volunteer";
  if (/career|employer|internship|job fair/.test(value)) return "Career";
  if (/football|game day|athletic|sport/.test(value)) return "Sports";
  if (/student org|organization|club/.test(value)) return "Clubs";
  return "Social";
}

export function normalizeTexasAmCalendarPayload(payload: unknown, verifiedAt = new Date().toISOString()): DiscoveredEvent[] {
  const root = record(payload); const rows = Array.isArray(root?.events) ? root.events : [];
  return rows.flatMap((row): DiscoveredEvent[] => {
    const event = record(record(row)?.event); if (!event) return [];
    const title = string(event.title); const sourceId = string(event.id); const url = string(event.localist_url) ?? string(event.url);
    const instances = Array.isArray(event.event_instances) ? event.event_instances : [];
    const instance = record(record(instances[0])?.event_instance);
    const startsAt = string(instance?.start) ?? string(event.start);
    const endsAt = string(instance?.end) ?? string(event.end);
    const location = string(event.location_name) ?? string(event.address);
    if (!title || !sourceId || !url || !startsAt || !location) return [];
    const start = new Date(startsAt); if (!Number.isFinite(start.getTime())) return [];
    const end = endsAt ? new Date(endsAt) : null;
    const description = plainText(event.description_text ?? event.description);
    const geo = record(event.geo);
    const latitude = number(geo?.latitude); const longitude = number(geo?.longitude);
    return [{
      id: `tamu-calendar-${sourceId}`,
      title,
      description,
      campus: "tamu",
      category: categoryFor(title, description),
      date: new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(start),
      time: new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }).format(start),
      eventStartAt: start.toISOString(),
      ...(end && Number.isFinite(end.getTime()) && end > start ? { eventEndAt: end.toISOString() } : {}),
      timeZone: "America/Chicago",
      location,
      address: string(event.address),
      city: "College Station",
      latitude,
      longitude,
      organizer: string(record(event.department)?.name) ?? "Texas A&M University",
      audience: "Campus community",
      rsvpCount: 0,
      status: string(event.status) === "cancelled" ? "cancelled" : "scheduled",
      systemGenerated: true,
      sourceTrust: "verified_source",
      source: { sourceTitle: "Texas A&M University Events Calendar", sourceUrl: url, sourceType: "university", sourceEventId: sourceId, sourceUpdatedAt: string(event.updated_at), ingestedAt: verifiedAt, verifiedAt },
    }];
  });
}

export const texasAmCalendarAdapter: EventSourceAdapter = {
  id: "tamu-localist-v2",
  campusId: "tamu",
  name: "Texas A&M University Events Calendar",
  sourceUrl: "https://calendar.tamu.edu/",
  refreshEveryMinutes: 360,
  automation: "enabled",
  async fetchEvents({ startsAt, endsAt }) {
    const params = new URLSearchParams({ start: startsAt.toISOString().slice(0, 10), end: endsAt.toISOString().slice(0, 10), pp: "100" });
    const response = await fetch(`https://calendar.tamu.edu/api/2/events?${params}`, { headers: { Accept: "application/json", "User-Agent": "CampusMintEventIndexer/1.0" }, next: { revalidate: 21_600 } });
    if (!response.ok) throw new Error(`Texas A&M calendar returned ${response.status}.`);
    return normalizeTexasAmCalendarPayload(await response.json());
  },
};
