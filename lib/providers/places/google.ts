import "server-only";
import { rankNearbyFood, safeWebUrl, type Coordinates, type Cuisine, type NearbyItem } from "@/lib/discovery/nearby";
import { createSingleFlight } from "./requestStore";
import { validPlaceId } from "./identity";
import { consumeRateLimit } from "@/lib/security/server";

const singleFlight = createSingleFlight();
const types: Record<Cuisine, string[]> = { All: ["restaurant", "cafe"], Asian: ["chinese_restaurant", "japanese_restaurant", "korean_restaurant", "thai_restaurant", "vietnamese_restaurant"], "Fast food": ["fast_food_restaurant"], Indian: ["indian_restaurant"], Mexican: ["mexican_restaurant"], Italian: ["italian_restaurant"], American: ["american_restaurant"], Cafes: ["cafe"] };
// Ratings are deliberately retained for the requested ranking (Enterprise tier).
// Reviews/editorial summaries (Atmosphere tier) are absent from list and details.
export const SEARCH_FIELDS = "places.id,places.displayName,places.location,places.formattedAddress,places.googleMapsUri,places.rating,places.userRatingCount,places.attributions";
export const DETAIL_FIELDS = "id,websiteUri,nationalPhoneNumber,currentOpeningHours,attributions";
export const REVIEW_FIELDS = "id,reviews,attributions";
const providerUrl = "https://places.googleapis.com/v1";

type Attribution = { provider: string; providerUri?: string };
type Author = { displayName: string; uri?: string; photoUri?: string };
type GooglePlace = {
  id?: string; displayName?: { text?: string }; location?: Coordinates; formattedAddress?: string;
  googleMapsUri?: string; websiteUri?: string; nationalPhoneNumber?: string; rating?: number; userRatingCount?: number;
  currentOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
  attributions?: Attribution[];
  photos?: { name: string; googleMapsUri?: string; authorAttributions?: Author[] }[];
  reviews?: { authorAttribution: Author; text?: { text: string }; rating: number; googleMapsUri?: string }[];
};
export type PlaceDetails = { website: string | null; phone?: string; hours: string[]; openNow?: boolean; attributions: { name: string; url: string | null }[] };
export type PlaceReviews = { reviews: NonNullable<NearbyItem["reviews"]>; attributions: { name: string; url: string | null }[] };
export type PlacePhoto = { url: string; authors: { name: string; url: string | null; avatar: string | null }[]; sourceUrl: string | null };
const attributions = (place: GooglePlace) => (place.attributions ?? []).map(a => ({ name: a.provider, url: safeWebUrl(a.providerUri, "https://maps.google.com") }));

/** No payloads, user IDs, location, resource names, or API keys enter usage logs. */
export async function googleRequest<T>(operation: "search" | "details" | "photo", variant: string, path: string, key: string, fields?: string, body?: unknown): Promise<T> {
  const started = Date.now();
  let status = 0;
  try {
    const defaults = { search: 100, details: 1000, photo: 400 };
    const configured = Number(process.env[`GOOGLE_PLACES_${operation.toUpperCase()}_DAILY_LIMIT`] ?? defaults[operation]);
    if (!Number.isInteger(configured) || configured < 1 || configured > 1_000_000) throw new Error("Places budget is not configured");
    const budget = await consumeRateLimit(`places.provider.${operation}`, "global-daily", configured, 86_400);
    if (!budget.allowed) { status = 429; throw new Error("Places daily budget reached"); }
    const response = await fetch(`${providerUrl}/${path}`, {
      method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(12_000),
      headers: { "X-Goog-Api-Key": key, ...(fields ? { "X-Goog-FieldMask": fields } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    status = response.status;
    if (!response.ok) throw new Error("Places provider unavailable");
    return await response.json() as T;
  } finally {
    console.info(JSON.stringify({ event: "places.provider.request", operation, variant, status, durationMs: Date.now() - started }));
  }
}
export function placesConfigured() { return process.env.GOOGLE_PLACES_ENABLED === "true" && !!process.env.GOOGLE_PLACES_API_KEY; }
export function googleNearby(origin: Coordinates, cuisine: Cuisine, key: string): Promise<NearbyItem[]> {
  const requestKey = `search:${origin.latitude}:${origin.longitude}:${cuisine}`;
  return singleFlight(requestKey, async () => {
    const data = await googleRequest<{ places?: GooglePlace[] }>("search", "list", "places:searchNearby", key, SEARCH_FIELDS, {
      includedTypes: types[cuisine], maxResultCount: 20,
      locationRestriction: { circle: { center: origin, radius: 16093.44 } }, rankPreference: "POPULARITY",
    });
    const seen = new Set<string>();
    const items: NearbyItem[] = (data.places ?? []).flatMap(p => {
      if (!validPlaceId(p.id) || !p.displayName?.text || !p.location || seen.has(p.id)) return [];
      seen.add(p.id);
      return [{ id: `google:${p.id}`, googlePlaceId: p.id, title: p.displayName.text, description: "", address: p.formattedAddress ?? "", ...p.location,
        source: "Google Maps", sourceUrl: safeWebUrl(p.googleMapsUri) ?? `https://www.google.com/maps/search/?api=1&query=place&query_place_id=${encodeURIComponent(p.id)}`,
        rating: p.rating, ratingCount: p.userRatingCount, attributions: attributions(p) }];
    });
    return rankNearbyFood(items, origin);
  });
}
export function googleDetails(placeId: string, key: string): Promise<PlaceDetails> {
  return singleFlight(`details:${placeId}`, async () => {
    const p = await googleRequest<GooglePlace>("details", "contact-hours", `places/${encodeURIComponent(placeId)}`, key, DETAIL_FIELDS);
    return { website: safeWebUrl(p.websiteUri), phone: p.nationalPhoneNumber, hours: p.currentOpeningHours?.weekdayDescriptions ?? [], openNow: p.currentOpeningHours?.openNow, attributions: attributions(p) };
  });
}
export function googleReviews(placeId: string, key: string): Promise<PlaceReviews> {
  return singleFlight(`reviews:${placeId}`, async () => {
    const p = await googleRequest<GooglePlace>("details", "reviews", `places/${encodeURIComponent(placeId)}`, key, REVIEW_FIELDS);
    return { attributions: attributions(p), reviews: (p.reviews ?? []).slice(0, 5).map(r => ({ author: r.authorAttribution.displayName,
      authorUrl: safeWebUrl(r.authorAttribution.uri, "https://maps.google.com") ?? undefined,
      avatar: safeWebUrl(r.authorAttribution.photoUri, "https://maps.google.com") ?? undefined,
      text: r.text?.text ?? "", rating: r.rating, url: safeWebUrl(r.googleMapsUri) ?? undefined })) };
  });
}
export function googlePhoto(placeId: string, index: number, key: string): Promise<PlacePhoto | null> {
  return singleFlight(`photo:${placeId}:${index}`, async () => {
    // Resource names are used only within this request; never cached or persisted.
    const p = await googleRequest<GooglePlace>("details", "photo-reference", `places/${encodeURIComponent(placeId)}`, key, "id,photos");
    const photo = p.photos?.[index];
    if (!photo || !photo.name.startsWith(`places/${placeId}/photos/`) || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photo.name) || photo.name.length > 2000) return null;
    const result = await googleRequest<{ photoUri: string }>("photo", "image", `${photo.name}/media?maxWidthPx=800&skipHttpRedirect=true`, key);
    const url = new URL(result.photoUri);
    if (url.protocol !== "https:" || !/(^|\.)(googleusercontent\.com|ggpht\.com)$/.test(url.hostname)) throw new Error("Invalid provider photo");
    return { url: url.href, authors: (photo.authorAttributions ?? []).map(a => ({ name: a.displayName, url: safeWebUrl(a.uri, "https://maps.google.com"), avatar: safeWebUrl(a.photoUri, "https://maps.google.com") })), sourceUrl: safeWebUrl(photo.googleMapsUri) };
  });
}
