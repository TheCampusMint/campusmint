import type { UniversityId } from "@/types/campus";

export type CampusNetworkFeature =
  | "marketplace"
  | "off_campus_housing"
  | "local_dining"
  | "roommates"
  | "transportation"
  | "community_content";

export type CampusNetwork = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  universityIds: readonly UniversityId[];
  enabledFeatures: readonly CampusNetworkFeature[];
};

export const campusNetworks = {
  bryanCollegeStation: {
    id: "bryan-college-station",
    name: "Bryan / College Station",
    latitude: 30.6280,
    longitude: -96.3344,
    universityIds: ["tamu", "blinn"],
    enabledFeatures: ["marketplace"],
  },
  austin: {
    id: "austin",
    name: "Austin",
    latitude: 30.2672,
    longitude: -97.7431,
    universityIds: ["texas"],
    enabledFeatures: ["marketplace"],
  },
  batonRouge: {
    id: "baton-rouge",
    name: "Baton Rouge",
    latitude: 30.4515,
    longitude: -91.1871,
    universityIds: ["lsu"],
    enabledFeatures: ["marketplace"],
  },
  tuscaloosa: {
    id: "tuscaloosa",
    name: "Tuscaloosa",
    latitude: 33.2098,
    longitude: -87.5692,
    universityIds: ["alabama"],
    enabledFeatures: ["marketplace"],
  },
} as const satisfies Record<string, CampusNetwork>;

export type CampusNetworkId =
  | (typeof campusNetworks)[keyof typeof campusNetworks]["id"]
  | "universal";

export function getCampusNetwork(campusNetworkId: string) {
  return Object.values(campusNetworks).find((network) => network.id === campusNetworkId) ?? null;
}

export function getCampusNetworkForUniversity(universityId: UniversityId) {
  return Object.values(campusNetworks).find((network) =>
    (network.universityIds as readonly UniversityId[]).includes(universityId)
  ) ?? null;
}

export function isUniversityInCampusNetwork(universityId: UniversityId, campusNetworkId: string) {
  const network = getCampusNetwork(campusNetworkId);
  return network ? (network.universityIds as readonly UniversityId[]).includes(universityId) : false;
}
