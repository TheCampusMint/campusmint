import type { Coordinates } from "../../discovery/nearby";
export const validPlaceId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,255}$/.test(value);
export function distinctPlaceIds(ids: unknown[]): string[] { return [...new Set(ids.filter(validPlaceId))]; }
/** Coarse search-area bookkeeping, never a user's precise coordinate or Google address. */
export function placeAreaKey(origin: Coordinates) {
  return `area:${Math.round(origin.latitude * 10) / 10}:${Math.round(origin.longitude * 10) / 10}`;
}
export function identityRows(ids: unknown[]) { return distinctPlaceIds(ids).map(google_place_id => ({ google_place_id })); }
