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
  // Geography alone does not enable a marketplace or other regional service.
  losAngeles: {
    id: "los-angeles", name: "Los Angeles",
    latitude: 34.0522, longitude: -118.2437,
    universityIds: ["ucla", "usc"], enabledFeatures: [],
  },
  stanfordPaloAlto: {
    id: "stanford-palo-alto", name: "Stanford / Palo Alto",
    latitude: 37.4275, longitude: -122.1697,
    universityIds: ["stanford"], enabledFeatures: [],
  },
  seattle: {
    id: "seattle", name: "Seattle",
    latitude: 47.6553, longitude: -122.3035,
    universityIds: ["washington"], enabledFeatures: [],
  },
  columbus: {
    id: "columbus", name: "Columbus",
    latitude: 40.0067, longitude: -83.0305,
    universityIds: ["ohio-state"], enabledFeatures: [],
  },
  stateCollege: {
    id: "state-college", name: "State College / University Park",
    latitude: 40.7982, longitude: -77.8599,
    universityIds: ["penn-state"], enabledFeatures: [],
  },
  durham: {
    id: "durham", name: "Durham",
    latitude: 36.0014, longitude: -78.9382,
    universityIds: ["duke"], enabledFeatures: [],
  },
  storrs: {
    id: "storrs", name: "Storrs",
    latitude: 41.8077, longitude: -72.2540,
    universityIds: ["uconn"], enabledFeatures: [],
  },
  madison: {
    id: "madison", name: "Madison",
    latitude: 43.0766, longitude: -89.4125,
    universityIds: ["wisconsin"], enabledFeatures: [],
  },
  golden: {
    id: "golden", name: "Golden",
    latitude: 39.7512, longitude: -105.2226,
    universityIds: ["mines"], enabledFeatures: [],
  },
  williamstown: {
    id: "williamstown", name: "Williamstown",
    latitude: 42.7128, longitude: -73.2030,
    universityIds: ["williams"], enabledFeatures: [],
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
