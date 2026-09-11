import { eventCategories, type EventCategory } from "../../types/event.ts";

export type BrandEventSubmission = {
  title: string;
  description: string;
  campusId: string;
  category: EventCategory;
  startsAt: string;
  endsAt: string | null;
  location: string;
  address: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
};

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

const coordinate = (value: unknown) => {
  if (typeof value === "string" && !value.trim()) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

export function normalizeBrandEventTitle(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function parseBrandEventSubmission(value: unknown):
  | { ok: true; value: BrandEventSubmission }
  | { ok: false; message: string } {
  if (!value || typeof value !== "object") return { ok: false, message: "Enter the event details." };
  const input = value as Record<string, unknown>;
  const title = clean(input.title, 240);
  const description = clean(input.description, 600);
  const campusId = clean(input.campusId, 80).toLocaleLowerCase();
  const location = clean(input.location, 240);
  const address = clean(input.address, 300) || null;
  const city = clean(input.city, 120) || null;
  const startsAt = clean(input.startsAt, 80);
  const endsAt = clean(input.endsAt, 80) || null;
  const latitude = coordinate(input.latitude);
  const longitude = coordinate(input.longitude);
  const category = eventCategories.includes(input.category as EventCategory)
    ? input.category as EventCategory
    : null;
  if (!title || !description || !campusId || !location || !startsAt || !category) {
    return { ok: false, message: "Add a title, description, campus, category, time, and location." };
  }
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  if (!Number.isFinite(start.getTime()) || (end && (!Number.isFinite(end.getTime()) || end <= start))) {
    return { ok: false, message: "Enter a valid event window. The end must be after the start." };
  }
  if (start.getTime() <= Date.now() - 5 * 60_000) {
    return { ok: false, message: "Brand events must have a current or future start time." };
  }
  if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { ok: false, message: "Add valid venue coordinates so Campus Mint can verify the campus radius." };
  }
  return { ok: true, value: { title, description, campusId, category, startsAt: start.toISOString(), endsAt: end?.toISOString() ?? null, location, address, city, latitude, longitude } };
}
