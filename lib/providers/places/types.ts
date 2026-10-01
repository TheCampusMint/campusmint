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
  googleMapsUri: string | null;
  attributions: ProviderAttribution[];
};

export type PlacesProvider = {
  name: string;
  search(request: PlaceSearchRequest): Promise<PlaceProviderResult[]>;
};
