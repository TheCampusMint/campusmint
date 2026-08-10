import type { UniversityId } from "@/data/universities";

export type PlaceSearchRequest = {
  query: string;
  universityId: UniversityId;
  maximumResults?: number;
};

export type ProviderAttribution = {
  provider: string;
  providerUri: string | null;
};

export type PlaceProviderResult = {
  placeId: string;
  name: string;
  address: string | null;
  coordinates: { latitude: number; longitude: number } | null;
  phone: string | null;
  website: string | null;
  openingHours: string[];
  openNow: boolean | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  googleMapsUri: string | null;
  photoReferences: Array<{
    name: string;
    widthPx: number | null;
    heightPx: number | null;
    authorAttributions: Array<{ displayName: string; uri: string | null }>;
  }>;
  attributions: ProviderAttribution[];
};

export type PlacesProvider = {
  name: string;
  search(request: PlaceSearchRequest): Promise<PlaceProviderResult[]>;
};
