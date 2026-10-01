import { distanceMiles } from "../events/geography.ts";
export const NEARBY_RADIUS_MILES = 10;
export type Coordinates = { latitude: number; longitude: number };
export function coordinates(value: unknown): Coordinates | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Coordinates;
  return typeof p.latitude === "number" && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && typeof p.longitude === "number" && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180 ? { latitude: p.latitude, longitude: p.longitude } : null;
}
export function insideNearby(origin: Coordinates, point: unknown) {
  const p = coordinates(point);
  return !!p && distanceMiles(origin, p) <= NEARBY_RADIUS_MILES;
}
export const cuisines = ["All", "Asian", "Fast food", "Indian", "Mexican", "Italian", "American", "Cafes"] as const;
export type Cuisine = typeof cuisines[number];
export type NearbyItem = {
  googlePlaceId?: string; campusMintPlaceId?: string;
  id: string; title: string; description: string; address: string; latitude: number; longitude: number;
  website?: string | null; image?: string | null; imageCredit?: string; imageCreditUrl?: string | null; imageSourceUrl?: string | null; attributions?: {name:string;url:string|null}[];
  source: string; sourceUrl: string; startsAt?: string; endsAt?: string; timeZone?: string; rating?: number | null; ratingCount?: number | null;
  reviews?: { author: string; authorUrl?: string; avatar?: string; text: string; rating: number; url?: string }[];
};
export function safeWebUrl(value: unknown, base?: string): string | null {
  if (typeof value !== "string" || !value) return null;
  try { const url = new URL(value, base); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function rankNearbyFood(items: NearbyItem[], origin: Coordinates) {
  return items.filter(item => insideNearby(origin, item)).sort((a,b) => (b.rating ?? -1) - (a.rating ?? -1) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0) || a.title.localeCompare(b.title));
}
