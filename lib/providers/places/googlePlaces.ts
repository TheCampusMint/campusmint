import "server-only";

import type { PlaceProviderResult, PlacesProvider } from "./types";

const campusSearchAreas = {
  tamu: "College Station, Texas",
  blinn: "Bryan, Texas",
  texas: "Austin, Texas",
  lsu: "Baton Rouge, Louisiana",
  alabama: "Tuscaloosa, Alabama",
} as const;

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  currentOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  googleMapsUri?: string;
  photos?: Array<{
    name?: string;
    widthPx?: number;
    heightPx?: number;
    authorAttributions?: Array<{ displayName?: string; uri?: string }>;
  }>;
  attributions?: Array<{ provider?: string; providerUri?: string }>;
};

function normalizePlace(place: GooglePlace): PlaceProviderResult | null {
  if (!place.id || !place.displayName?.text) return null;
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  return {
    placeId: place.id,
    name: place.displayName.text,
    address: place.formattedAddress ?? null,
    coordinates: typeof latitude === "number" && typeof longitude === "number" ? { latitude, longitude } : null,
    phone: place.nationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    openingHours: place.currentOpeningHours?.weekdayDescriptions ?? [],
    openNow: place.currentOpeningHours?.openNow ?? null,
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    priceLevel: place.priceLevel ?? null,
    googleMapsUri: place.googleMapsUri ?? null,
    photoReferences: (place.photos ?? []).map((photo) => ({
      name: photo.name ?? "",
      widthPx: photo.widthPx ?? null,
      heightPx: photo.heightPx ?? null,
      authorAttributions: (photo.authorAttributions ?? []).map((author) => ({
        displayName: author.displayName ?? "Google Maps contributor",
        uri: author.uri ?? null,
      })),
    })).filter((photo) => photo.name),
    attributions: (place.attributions ?? []).map((attribution) => ({
      provider: attribution.provider ?? "Google Maps",
      providerUri: attribution.providerUri ?? null,
    })),
  };
}

export function createGooglePlacesProvider(apiKey: string): PlacesProvider {
  return {
    name: "Google Places API (New)",
    async search(request) {
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": [
            "places.id", "places.displayName", "places.formattedAddress", "places.location",
            "places.nationalPhoneNumber", "places.websiteUri", "places.currentOpeningHours",
            "places.rating", "places.userRatingCount", "places.priceLevel", "places.googleMapsUri",
            "places.photos", "places.attributions",
          ].join(","),
        },
        body: JSON.stringify({
          textQuery: `${request.query} near ${campusSearchAreas[request.universityId]}`,
          maxResultCount: Math.min(Math.max(request.maximumResults ?? 10, 1), 20),
        }),
      });
      if (!response.ok) throw new Error(`Google Places request failed with status ${response.status}.`);
      const body = await response.json() as { places?: GooglePlace[] };
      return (body.places ?? []).map(normalizePlace).filter((place): place is PlaceProviderResult => Boolean(place));
    },
  };
}
