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
  eugene: {
    id: "eugene",
    name: "Eugene",
    latitude: 44.0448,
    longitude: -123.0726,
    universityIds: ["oregon"],
    enabledFeatures: ["marketplace"],
  },
  cambridge: {
    id: "cambridge",
    name: "Cambridge",
    latitude: 42.377,
    longitude: -71.1167,
    universityIds: ["harvard"],
    enabledFeatures: ["marketplace"],
  },
  annArbor: {
    id: "ann-arbor",
    name: "Ann Arbor",
    latitude: 42.278,
    longitude: -83.7382,
    universityIds: ["michigan"],
    enabledFeatures: ["marketplace"],
  },
  coralGables: {
    id: "coral-gables",
    name: "Coral Gables",
    latitude: 25.7174,
    longitude: -80.2789,
    universityIds: ["miami"],
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
