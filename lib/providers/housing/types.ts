import type { UniversityId } from "@/data/universities";

export type HousingProviderRequest = {
  universityId: UniversityId;
  query?: string;
};

export type HousingProviderListing = {
  externalId: string;
  name: string;
  address: string | null;
  sourceUrl: string;
  sourceLabel: string;
  fetchedAt: string;
};

export type AuthorizedHousingProvider = {
  name: string;
  authorizationStatus: "authorized" | "not_configured";
  search(request: HousingProviderRequest): Promise<HousingProviderListing[]>;
};

export const unconfiguredHousingProvider: AuthorizedHousingProvider = {
  name: "Authorized off-campus housing feed",
  authorizationStatus: "not_configured",
  async search() {
    return [];
  },
};
