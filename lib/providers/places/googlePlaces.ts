import "server-only";

import type { UniversityId } from "@/types/campus";
import type { PlaceProviderResult, PlacesProvider } from "./types";
import { googleRequest, placesConfigured } from "./google";
import { createSingleFlight } from "./requestStore";
import { validPlaceId } from "./identity";
import { coordinates, safeWebUrl } from "@/lib/discovery/nearby";

const singleFlight = createSingleFlight();
export const TEXT_SEARCH_FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.attributions";

const campusSearchAreas = {
  tamu: "College Station, Texas",
  blinn: "Bryan, Texas",
  texas: "Austin, Texas",
  lsu: "Baton Rouge, Louisiana",
  alabama: "Tuscaloosa, Alabama",
  oregon: "Eugene, Oregon",
  harvard: "Cambridge, Massachusetts",
  michigan: "Ann Arbor, Michigan",
  miami: "Coral Gables, Florida",
  ucla: "Westwood, Los Angeles, California",
  stanford: "Stanford, California",
  usc: "University Park, Los Angeles, California",
  washington: "University District, Seattle, Washington",
  "ohio-state": "Columbus, Ohio",
  "penn-state": "University Park, Pennsylvania",
  duke: "Durham, North Carolina",
  uconn: "Storrs, Connecticut",
  wisconsin: "Madison, Wisconsin",
  mines: "Golden, Colorado",
  williams: "Williamstown, Massachusetts",
} as const satisfies Record<UniversityId, string>;

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  attributions?: Array<{ provider?: string; providerUri?: string }>;
};

function normalizePlace(place: GooglePlace): PlaceProviderResult | null {
  if (!validPlaceId(place.id) || !place.displayName?.text) return null;
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  return {
    placeId: place.id,
    name: place.displayName.text,
    address: place.formattedAddress ?? null,
    coordinates: typeof latitude === "number" && typeof longitude === "number" ? coordinates({ latitude, longitude }) : null,
    googleMapsUri: safeWebUrl(place.googleMapsUri),
    attributions: (place.attributions ?? []).map((attribution) => ({
      provider: attribution.provider ?? "Google Maps",
      providerUri: safeWebUrl(attribution.providerUri),
    })),
  };
}

export function createGooglePlacesProvider(apiKey: string): PlacesProvider {
  return {
    name: "Google Places API (New)",
    async search(request) {
      if (!placesConfigured()) throw new Error("Places unavailable");
      const query = request.query.trim().replace(/\s+/g, " ");
      if (query.length < 3 || query.length > 200 || !Object.hasOwn(campusSearchAreas, request.universityId)) throw new Error("Invalid place search");
      const maximumResults = Number.isInteger(request.maximumResults) ? Math.min(Math.max(request.maximumResults!, 1), 20) : 10;
      return singleFlight(`text:${request.universityId}:${query.toLowerCase()}:${maximumResults}`, async () => {
        const body = await googleRequest<{ places?: GooglePlace[] }>("search", "text-location", "places:searchText", apiKey, TEXT_SEARCH_FIELDS, {
          textQuery: `${query} near ${campusSearchAreas[request.universityId]}`, maxResultCount: maximumResults,
        });
        const seen = new Set<string>();
        return (body.places ?? []).map(normalizePlace).filter((place): place is PlaceProviderResult => {
          if (!place || seen.has(place.placeId)) return false;
          seen.add(place.placeId); return true;
        });
      });
    },
  };
}
