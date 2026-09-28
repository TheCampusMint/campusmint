import type { CampusNetworkId } from "@/data/campusNetworks";
import type { UniversityId } from "@/types/campus";

export type { UniversityId } from "@/types/campus";

export type UniversityTheme = {
  name: string;
  shortName: string;
  emailDomains?: readonly string[];
  primary: string;
  secondary: string;
  accent: string;
  timeZone: string;
  campusLatitude: number;
  campusLongitude: number;
  eventDiscoveryRadiusMiles: number;
  accessibleCampuses: string[];
  campusNetworkId: CampusNetworkId;
  marketplace: {
    ticketMarketplaceEnabled: boolean;
    ticketResaleAllowed: boolean | null;
    ticketTransferMethod: string;
    ticketPolicyUrl: string | null;
  };
};

// Newly configured campuses have identity/display metadata, not seeded campus
// content or permission to run ticket exchanges. Each feed stays campus-scoped.
function additionalCampus(
  id: UniversityId,
  details: Omit<UniversityTheme, "accessibleCampuses" | "eventDiscoveryRadiusMiles" | "marketplace">,
): UniversityTheme {
  return {
    ...details,
    accessibleCampuses: [id],
    eventDiscoveryRadiusMiles: 10,
    marketplace: {
      ticketMarketplaceEnabled: false,
      ticketResaleAllowed: null,
      ticketTransferMethod: "Ticket activity is unavailable until a current official university policy is configured.",
      ticketPolicyUrl: null,
    },
  };
}

export const universities = {
  tamu: {
    name: "Texas A&M University",
    shortName: "Texas A&M",
    emailDomains: ["tamu.edu"],
    primary: "#500000",
    secondary: "#ffffff",
    accent: "#D6D3C4",
    timeZone: "America/Chicago",
    campusLatitude: 30.6187,
    campusLongitude: -96.3365,
    eventDiscoveryRadiusMiles: 10,
    accessibleCampuses: ["tamu"],
    campusNetworkId: "bryan-college-station",
    marketplace: {
      ticketMarketplaceEnabled: true,
      ticketResaleAllowed: null,
      ticketTransferMethod: "Use the university-approved transfer process and confirm current ticketing rules before any exchange.",
      ticketPolicyUrl: null,
    },
  },
  blinn: {
    name: "Blinn College",
    shortName: "Blinn",
    emailDomains: ["blinn.edu"],
    primary: "#003366",
    secondary: "#ffffff",
    accent: "#EAF2F8",
    timeZone: "America/Chicago",
    campusLatitude: 30.6601,
    campusLongitude: -96.3908,
    eventDiscoveryRadiusMiles: 10,
    accessibleCampuses: ["blinn", "tamu"],
    campusNetworkId: "bryan-college-station",
    marketplace: {
      ticketMarketplaceEnabled: true,
      ticketResaleAllowed: null,
      ticketTransferMethod: "Use an appropriate outside transfer method and confirm current university and ticketing rules before any exchange.",
      ticketPolicyUrl: null,
    },
  },
  texas: {
    name: "The University of Texas at Austin",
    shortName: "Texas",
    emailDomains: ["utexas.edu"],
    primary: "#BF5700",
    secondary: "#ffffff",
    accent: "#F2EDE7",
    timeZone: "America/Chicago",
    campusLatitude: 30.2849,
    campusLongitude: -97.7341,
    eventDiscoveryRadiusMiles: 10,
    accessibleCampuses: ["texas"],
    campusNetworkId: "austin",
    marketplace: {
      ticketMarketplaceEnabled: false, ticketResaleAllowed: null,
      ticketTransferMethod: "Ticket activity is unavailable until a current official university policy is configured.", ticketPolicyUrl: null,
    },
  },
  lsu: {
    name: "Louisiana State University",
    shortName: "LSU",
    emailDomains: ["lsu.edu"],
    primary: "#35145F",
    secondary: "#F4D35E",
    accent: "#EEE9F4",
    timeZone: "America/Chicago",
    campusLatitude: 30.412,
    campusLongitude: -91.1838,
    eventDiscoveryRadiusMiles: 10,
    accessibleCampuses: ["lsu"],
    campusNetworkId: "baton-rouge",
    marketplace: {
      ticketMarketplaceEnabled: false, ticketResaleAllowed: null,
      ticketTransferMethod: "Ticket activity is unavailable until a current official university policy is configured.", ticketPolicyUrl: null,
    },
  },
  alabama: {
    name: "The University of Alabama",
    shortName: "Alabama",
    emailDomains: ["ua.edu"],
    primary: "#7A1426",
    secondary: "#F8F8F8",
    accent: "#EFE7E9",
    timeZone: "America/Chicago",
    campusLatitude: 33.214,
    campusLongitude: -87.5391,
    eventDiscoveryRadiusMiles: 10,
    accessibleCampuses: ["alabama"],
    campusNetworkId: "tuscaloosa",
    marketplace: {
      ticketMarketplaceEnabled: false, ticketResaleAllowed: null,
      ticketTransferMethod: "Ticket activity is unavailable until a current official university policy is configured.", ticketPolicyUrl: null,
    },
  },
  oregon: {
    name: "University of Oregon",
    shortName: "Oregon",
    emailDomains: ["uoregon.edu"],
    primary: "#007030",
    secondary: "#FEE11A",
    accent: "#E4F0E9",
    timeZone: "America/Los_Angeles",
    campusLatitude: 44.0448,
    campusLongitude: -123.0726,
    eventDiscoveryRadiusMiles: 10,
    accessibleCampuses: ["oregon"],
    campusNetworkId: "eugene",
    marketplace: {
      ticketMarketplaceEnabled: false, ticketResaleAllowed: null,
      ticketTransferMethod: "Ticket activity is unavailable until a current official university policy is configured.", ticketPolicyUrl: null,
    },
  },
  harvard: {
    name: "Harvard University",
    shortName: "Harvard",
    emailDomains: ["harvard.edu"],
    primary: "#A51C30",
    secondary: "#FFFFFF",
    accent: "#F3E4E7",
    timeZone: "America/New_York",
    campusLatitude: 42.377,
    campusLongitude: -71.1167,
    eventDiscoveryRadiusMiles: 10,
    accessibleCampuses: ["harvard"],
    campusNetworkId: "cambridge",
    marketplace: {
      ticketMarketplaceEnabled: false, ticketResaleAllowed: null,
      ticketTransferMethod: "Ticket activity is unavailable until a current official university policy is configured.", ticketPolicyUrl: null,
    },
  },
  michigan: {
    name: "University of Michigan",
    shortName: "Michigan",
    emailDomains: ["umich.edu"],
    primary: "#00274C",
    secondary: "#FFCB05",
    accent: "#E5EAF0",
    timeZone: "America/Detroit",
    campusLatitude: 42.278,
    campusLongitude: -83.7382,
    eventDiscoveryRadiusMiles: 10,
    accessibleCampuses: ["michigan"],
    campusNetworkId: "ann-arbor",
    marketplace: {
      ticketMarketplaceEnabled: false, ticketResaleAllowed: null,
      ticketTransferMethod: "Ticket activity is unavailable until a current official university policy is configured.", ticketPolicyUrl: null,
    },
  },
  miami: {
    name: "University of Miami",
    shortName: "Miami",
    emailDomains: ["miami.edu"],
    primary: "#005030",
    secondary: "#F47321",
    accent: "#E4EFEA",
    timeZone: "America/New_York",
    campusLatitude: 25.7174,
    campusLongitude: -80.2789,
    eventDiscoveryRadiusMiles: 10,
    accessibleCampuses: ["miami"],
    campusNetworkId: "coral-gables",
    marketplace: {
      ticketMarketplaceEnabled: false, ticketResaleAllowed: null,
      ticketTransferMethod: "Ticket activity is unavailable until a current official university policy is configured.", ticketPolicyUrl: null,
    },
  },
  // Official campus location references are recorded alongside the new entries.
  // Coordinates represent campus centers for discovery, not venue entrances.
  ucla: additionalCampus("ucla", {
    // https://newsroom.ucla.edu/ucla-fast-facts
    name: "University of California, Los Angeles", shortName: "UCLA",
    emailDomains: ["ucla.edu"],
    primary: "#2774AE", secondary: "#FFD100", accent: "#E6F0F8",
    timeZone: "America/Los_Angeles",
    campusLatitude: 34.0689, campusLongitude: -118.4452,
    campusNetworkId: "los-angeles",
  }),
  stanford: additionalCampus("stanford", {
    // https://visit.stanford.edu/contact
    name: "Stanford University", shortName: "Stanford",
    emailDomains: ["stanford.edu"],
    primary: "#8C1515", secondary: "#FFFFFF", accent: "#F1E4E4",
    timeZone: "America/Los_Angeles",
    campusLatitude: 37.4275, campusLongitude: -122.1697,
    campusNetworkId: "stanford-palo-alto",
  }),
  usc: additionalCampus("usc", {
    // https://www.usc.edu/visit-usc/
    name: "University of Southern California", shortName: "USC",
    emailDomains: ["usc.edu"],
    primary: "#990000", secondary: "#FFCC00", accent: "#F3E3E3",
    timeZone: "America/Los_Angeles",
    campusLatitude: 34.0224, campusLongitude: -118.2851,
    campusNetworkId: "los-angeles",
  }),
  washington: additionalCampus("washington", {
    // https://www.washington.edu/contact/
    name: "University of Washington", shortName: "Washington",
    emailDomains: ["uw.edu", "washington.edu"],
    primary: "#4B2E83", secondary: "#B7A57A", accent: "#ECE7F3",
    timeZone: "America/Los_Angeles",
    campusLatitude: 47.6553, campusLongitude: -122.3035,
    campusNetworkId: "seattle",
  }),
  "ohio-state": additionalCampus("ohio-state", {
    // https://www.osu.edu/about/columbus/visits
    name: "The Ohio State University", shortName: "Ohio State",
    emailDomains: ["osu.edu"],
    primary: "#BA0C2F", secondary: "#A7B1B7", accent: "#F5E3E7",
    timeZone: "America/New_York",
    campusLatitude: 40.0067, campusLongitude: -83.0305,
    campusNetworkId: "columbus",
  }),
  "penn-state": additionalCampus("penn-state", {
    // https://www.psu.edu/academics/campuses/university-park
    name: "The Pennsylvania State University", shortName: "Penn State",
    emailDomains: ["psu.edu"],
    primary: "#001E44", secondary: "#FFFFFF", accent: "#E4E9F0",
    timeZone: "America/New_York",
    campusLatitude: 40.7982, campusLongitude: -77.8599,
    campusNetworkId: "state-college",
  }),
  duke: additionalCampus("duke", {
    // https://www.duke.edu/visit/
    name: "Duke University", shortName: "Duke",
    emailDomains: ["duke.edu"],
    primary: "#012169", secondary: "#FFFFFF", accent: "#E5EAF4",
    timeZone: "America/New_York",
    campusLatitude: 36.0014, campusLongitude: -78.9382,
    campusNetworkId: "durham",
  }),
  uconn: additionalCampus("uconn", {
    // https://uconn.edu/maps/
    name: "University of Connecticut", shortName: "UConn",
    emailDomains: ["uconn.edu"],
    primary: "#000E2F", secondary: "#FFFFFF", accent: "#E4E8EE",
    timeZone: "America/New_York",
    campusLatitude: 41.8077, campusLongitude: -72.2540,
    campusNetworkId: "storrs",
  }),
  wisconsin: additionalCampus("wisconsin", {
    // https://www.wisc.edu/visit/
    name: "University of Wisconsin–Madison", shortName: "Wisconsin",
    emailDomains: ["wisc.edu"],
    primary: "#C5050C", secondary: "#FFFFFF", accent: "#F5E3E3",
    timeZone: "America/Chicago",
    campusLatitude: 43.0766, campusLongitude: -89.4125,
    campusNetworkId: "madison",
  }),
  mines: additionalCampus("mines", {
    // https://www.mines.edu/about/
    name: "Colorado School of Mines", shortName: "Colorado Mines",
    emailDomains: ["mines.edu"],
    primary: "#21314D", secondary: "#92A2BD", accent: "#E6EAF0",
    timeZone: "America/Denver",
    campusLatitude: 39.7512, campusLongitude: -105.2226,
    campusNetworkId: "golden",
  }),
  williams: additionalCampus("williams", {
    // https://www.williams.edu/about/fast-facts/
    name: "Williams College", shortName: "Williams",
    emailDomains: ["williams.edu"],
    primary: "#500082", secondary: "#FFBE0A", accent: "#EEE4F4",
    timeZone: "America/New_York",
    campusLatitude: 42.7128, campusLongitude: -73.2030,
    campusNetworkId: "williamstown",
  }),
} satisfies Record<UniversityId, UniversityTheme>;

export const configuredUniversityIds = Object.keys(
  universities,
) as UniversityId[];

export function getCampusName(campusId: string) {
  return universities[campusId as UniversityId]?.shortName ?? campusId;
}

type UniversityIdentityAccount = {
  universityId: string;
  universityIdentityId?: string | null;
  universityDomain?: string | null;
  knownUniversityId?: string | null;
  universityName?: string | null;
  universityShortName?: string | null;
};

export function getAccountUniversityName(
  account: UniversityIdentityAccount,
) {
  return (
    account.universityName ??
    universities[account.universityId as UniversityId]?.name ??
    account.universityId
  );
}

export function getAccountUniversityShortName(
  account: UniversityIdentityAccount,
) {
  return (
    account.universityShortName ??
    universities[account.universityId as UniversityId]?.shortName ??
    account.universityName ??
    account.universityId
  );
}

export function getAccountConfiguredUniversityId(
  account: UniversityIdentityAccount,
): UniversityId | null {
  const candidate =
    account.knownUniversityId ??
    (!account.universityIdentityId
      ? account.universityId
      : null);

  if (
    !candidate ||
    !universities[candidate as UniversityId]
  ) {
    return null;
  }

  return candidate as UniversityId;
}

export function getAccountUniversityIdentityKey(
  account: UniversityIdentityAccount,
) {
  const configuredUniversityId =
    getAccountConfiguredUniversityId(account);

  if (configuredUniversityId) {
    return `configured:${configuredUniversityId}`;
  }

  if (account.universityIdentityId) {
    return account.universityIdentityId;
  }

  if (account.universityDomain) {
    return `edu:${account.universityDomain.toLowerCase()}`;
  }

  return `legacy:${account.universityId}`;
}

export function getAccountUniversityTheme(
  account: UniversityIdentityAccount,
): UniversityTheme | null {
  const configuredUniversityId =
    getAccountConfiguredUniversityId(account);

  return configuredUniversityId
    ? universities[configuredUniversityId]
    : null;
}

export function getAccountUniversityDisplayTheme(
  account: UniversityIdentityAccount,
): UniversityTheme {
  const configuredTheme =
    getAccountUniversityTheme(account);

  if (configuredTheme) {
    return configuredTheme;
  }

  const name =
    account.universityName ??
    account.universityShortName ??
    "Campus Mint";

  const shortName =
    account.universityShortName ??
    account.universityName ??
    "Campus Mint";

  return {
    name,
    shortName,
    primary: "#6f1d2c",
    secondary: "#fffaf9",
    accent: "#f0dfe3",
    timeZone: "UTC",
    campusLatitude: 0,
    campusLongitude: 0,
    eventDiscoveryRadiusMiles: 10,
    accessibleCampuses: [],
    campusNetworkId: "universal",
    marketplace: {
      ticketMarketplaceEnabled: false,
      ticketResaleAllowed: null,
      ticketTransferMethod:
        "Marketplace ticket activity is unavailable until this university is fully configured.",
      ticketPolicyUrl: null,
    },
  };
}
