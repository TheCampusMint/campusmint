import type { Event, EventSourceProvenance } from "../../types/event.ts";
import { universities } from "../../data/universities.ts";
import { getEventDistanceFromCampus, isEventInsideCampusRadius } from "./geography.ts";

export type DiscoveredEvent = Omit<Event, "id" | "source"> & {
  id?: string;
  source: EventSourceProvenance;
  organizer?: string | null;
};

export type EventIngestionResult =
  | { status: "published"; event: Event }
  | { status: "duplicate"; existingEvent: Event; preferredOrganic: boolean; preferredAuthenticatedBrand: boolean }
  | { status: "rejected"; reason: "unreliable_source" | "past_or_cancelled" | "outside_campus_radius" | "unknown_location" | "unknown_campus" };

export function normalizeEventIdentity(event: Pick<Event, "title" | "campus" | "eventStartAt" | "location">) {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return [normalize(event.campus), normalize(event.title), event.eventStartAt.slice(0, 16), normalize(event.location)].join("|");
}

export function findEquivalentEvent(candidate: DiscoveredEvent, existing: readonly Event[]) {
  const identity = normalizeEventIdentity(candidate);
  const normalized = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const tokens = (value: string) => new Set(normalized(value).split(" ").filter(Boolean));
  const similar = (left: string, right: string) => {
    const a = tokens(left); const b = tokens(right);
    const intersection = [...a].filter((token) => b.has(token)).length;
    const union = new Set([...a, ...b]).size;
    return union > 0 && intersection / union >= 0.8;
  };
  return existing.find((event) => {
    const sameWindow = Math.abs(new Date(event.eventStartAt).getTime() - new Date(candidate.eventStartAt).getTime()) <= 30 * 60 * 1000;
    const sameLocation = normalized(event.location) === normalized(candidate.location);
    const sameOrganizer = Boolean(event.organizer && candidate.organizer && normalized(event.organizer) === normalized(candidate.organizer));
    return normalizeEventIdentity(event) === identity || Boolean(event.source?.sourceUrl && event.source.sourceUrl === candidate.source.sourceUrl) || (sameWindow && similar(event.title, candidate.title) && (sameLocation || sameOrganizer));
  }) ?? null;
}

export function resolveEventMediaStrategy(source: EventSourceProvenance) {
  if (source.officialImageUrl && source.imageDisplayPermitted) return "official" as const;
  return "generated_poster" as const;
}

export function buildEventPosterData(event: Pick<Event, "title" | "date" | "time" | "location" | "campus"> & { organizer?: string | null }) {
  return {
    brand: "Campus Mint",
    title: event.title,
    when: `${event.date} · ${event.time}`,
    location: event.location,
    campus: event.campus,
    organizer: event.organizer ?? null,
  };
}

export function ingestSystemEvent(input: {
  candidate: DiscoveredEvent;
  existingEvents: readonly Event[];
  currentTime: number;
  id: string;
}): EventIngestionResult {
  const { candidate } = input;
  const authenticatedOrganizer = Boolean(candidate.authorBrandId || candidate.authorUserId);
  const trustedExternalSource = candidate.sourceTrust === "verified_source" && Boolean(candidate.source.sourceUrl);
  if ((!trustedExternalSource && !authenticatedOrganizer) || !candidate.source.verifiedAt) {
    return { status: "rejected", reason: "unreliable_source" };
  }
  const end = new Date(candidate.eventEndAt ?? candidate.eventStartAt).getTime();
  if (candidate.status === "cancelled" || !Number.isFinite(end) || end <= input.currentTime) {
    return { status: "rejected", reason: "past_or_cancelled" };
  }
  const campus = universities[candidate.campus as keyof typeof universities];
  if (!campus) return { status: "rejected", reason: "unknown_campus" };
  const distance = getEventDistanceFromCampus(candidate, campus);
  if (distance === null && candidate.source.sourceType !== "university") return { status: "rejected", reason: "unknown_location" };
  if (!isEventInsideCampusRadius(candidate, campus)) return { status: "rejected", reason: "outside_campus_radius" };
  const duplicate = findEquivalentEvent(candidate, input.existingEvents);
  if (duplicate) {
    const preferredAuthenticatedBrand = Boolean(duplicate.authorBrandId);
    return { status: "duplicate", existingEvent: duplicate, preferredOrganic: !duplicate.systemGenerated, preferredAuthenticatedBrand };
  }
  return {
    status: "published",
    event: {
      ...candidate,
      id: input.id,
      source: candidate.source,
      systemGenerated: true,
      status: candidate.status ?? "scheduled",
      mediaStrategy: resolveEventMediaStrategy(candidate.source),
      distanceFromCampusMiles: distance,
    },
  };
}

export function applySystemEventUpdate(event: Event, patch: Partial<Pick<Event, "status" | "date" | "time" | "eventStartAt" | "eventEndAt" | "location">>) {
  return { ...event, ...patch };
}

export function isUpcomingDiscoverableEvent(event: Event, currentTime: number) {
  if (event.status === "cancelled") return false;
  const end = new Date(event.eventEndAt ?? event.eventStartAt).getTime();
  return Number.isFinite(end) && end > currentTime;
}
