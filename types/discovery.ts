import type { UniversityId } from "@/data/universities";

export type DiscoverySourceType =
  | "university_official"
  | "google_places"
  | "authorized_partner"
  | "community_verified"
  | "pending"
  | "campus_mint_user"
  | "business_owner"
  | "development";

export type DiscoverySource = {
  type: DiscoverySourceType;
  label: string;
  url: string | null;
  lastVerifiedAt: string | null;
  isDevelopment: boolean;
};

export type EntityPhoto = {
  id: string;
  sourceType: "university_official" | "google_places" | "campus_mint_user" | "business_owner" | "development";
  url: string | null;
  externalReference: string | null;
  alt: string;
  attribution: string | null;
};

export type ExternalReviewSummary = {
  provider: "google_maps" | "authorized_partner";
  providerLabel: string;
  rating: number | null;
  reviewCount: number;
  providerUri: string | null;
};

export type CampusMintReviewSummary = {
  rating: number | null;
  reviewCount: number;
};

export const restaurantReviewCategories = [
  "Food quality", "Value", "Service", "Atmosphere", "Wait time",
] as const;

export const diningHallReviewCategories = [
  "Food quality", "Variety", "Cleanliness", "Wait time", "Value",
] as const;

export const housingReviewCategories = [
  "Room quality", "Bathrooms", "Laundry", "Internet", "Noise",
  "Location", "Security", "Community", "Value",
] as const;

export type DiningCategory =
  | "On-campus dining"
  | "Restaurant"
  | "Coffee shop"
  | "Fast food"
  | "Dining hall";

export type DiningLocation = {
  id: string;
  entityId: string;
  universityId: UniversityId | null;
  accessibleUniversityIds: UniversityId[];
  campusId: string;
  area: string;
  name: string;
  address: string | null;
  description: string;
  scope: "on_campus" | "off_campus";
  categories: DiningCategory[];
  regularHours: string[];
  specialHours: string | null;
  openNow: boolean | null;
  temporarilyClosed: boolean;
  todayMenuUrl: string | null;
  waitTimeMinutes: number | null;
  dailyRecommendation: string | null;
  phone: string | null;
  website: string | null;
  distanceMiles: number | null;
  priceLevel: 1 | 2 | 3 | 4 | null;
  coordinates: { latitude: number; longitude: number } | null;
  photos: EntityPhoto[];
  externalReviews: ExternalReviewSummary | null;
  campusMintReviews: CampusMintReviewSummary;
  source: DiscoverySource;
  status: "open" | "temporarily_closed" | "closed";
};

export type HousingRate = {
  id: string;
  unitType: string;
  termLabel: string;
  amount: number;
  currency: "USD";
  cadence: "semester" | "month" | "year";
  sourceUrl: string;
};

export type HousingUnit = {
  id: string;
  name: string;
  bedroomCount: number | null;
  bathroomCount: number | null;
  occupantsPerBedroom: number | null;
  furnished: boolean | null;
};

export type HousingEntity = {
  id: string;
  entityId: string;
  universityId: UniversityId | null;
  accessibleUniversityIds: UniversityId[];
  campusId: string;
  campusName: string;
  name: string;
  address: string | null;
  description: string;
  scope: "on_campus" | "off_campus";
  housingType: "residence_hall" | "university_apartment" | "apartment" | "shared_housing";
  website: string | null;
  phone: string | null;
  distanceMiles: number | null;
  coordinates: { latitude: number; longitude: number } | null;
  units: HousingUnit[];
  rates: HousingRate[];
  amenities: string[];
  capacity: number | null;
  restrictions: string[];
  petPolicy: string | null;
  parking: string | null;
  furnished: boolean | null;
  photos: EntityPhoto[];
  externalReviews: ExternalReviewSummary | null;
  campusMintReviews: CampusMintReviewSummary;
  source: DiscoverySource;
  status: "planned" | "under_construction" | "open" | "temporarily_closed" | "closed";
};
