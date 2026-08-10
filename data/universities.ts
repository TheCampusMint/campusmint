import type { CampusNetworkId } from "@/data/campusNetworks";
import type { UniversityId } from "@/types/campus";

export type { UniversityId } from "@/types/campus";

export type UniversityTheme = {
  name: string;
  shortName: string;
  primary: string;
  secondary: string;
  accent: string;
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
    primary: "#500000",
    secondary: "#ffffff",
    accent: "#D6D3C4",
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
    primary: "#003366",
    secondary: "#ffffff",
    accent: "#EAF2F8",
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
    primary: "#BF5700",
    secondary: "#ffffff",
    accent: "#F2EDE7",
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
    primary: "#35145F",
    secondary: "#F4D35E",
    accent: "#EEE9F4",
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
    primary: "#7A1426",
    secondary: "#F8F8F8",
    accent: "#EFE7E9",
    accessibleCampuses: ["alabama"],
    campusNetworkId: "tuscaloosa",
    marketplace: {
      ticketMarketplaceEnabled: false, ticketResaleAllowed: null,
      ticketTransferMethod: "Ticket activity is unavailable until a current official university policy is configured.", ticketPolicyUrl: null,
    },
  },
} satisfies Record<UniversityId, UniversityTheme>;

export function getCampusName(campusId: string) {
  return universities[campusId as UniversityId]?.shortName ?? campusId;
}
