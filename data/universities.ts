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
  accessibleCampuses: string[];
  campusNetworkId: CampusNetworkId;
  marketplace: {
    ticketMarketplaceEnabled: boolean;
    ticketResaleAllowed: boolean | null;
    ticketTransferMethod: string;
    ticketPolicyUrl: string | null;
  };
};

export const universities = {
  tamu: {
    name: "Texas A&M University",
    shortName: "Texas A&M",
    emailDomains: ["tamu.edu"],
    primary: "#500000",
    secondary: "#ffffff",
    accent: "#D6D3C4",
    timeZone: "America/Chicago",
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
    accessibleCampuses: ["alabama"],
    campusNetworkId: "tuscaloosa",
    marketplace: {
      ticketMarketplaceEnabled: false, ticketResaleAllowed: null,
      ticketTransferMethod: "Ticket activity is unavailable until a current official university policy is configured.", ticketPolicyUrl: null,
    },
  },
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
    primary: "#0f172a",
    secondary: "#ffffff",
    accent: "#e2e8f0",
    timeZone: "UTC",
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
