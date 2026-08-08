export type UniversityTheme = {
  name: string;
  shortName: string;
  primary: string;
  secondary: string;
  accent: string;
  accessibleCampuses: string[];
};

export const universities = {
  tamu: {
    name: "Texas A&M University",
    shortName: "Texas A&M",
    primary: "#500000",
    secondary: "#ffffff",
    accent: "#D6D3C4",
    accessibleCampuses: ["tamu"],
  },
  blinn: {
    name: "Blinn College",
    shortName: "Blinn",
    primary: "#003366",
    secondary: "#ffffff",
    accent: "#EAF2F8",
    accessibleCampuses: ["blinn", "tamu"],
  },
  texas: {
    name: "The University of Texas at Austin",
    shortName: "Texas",
    primary: "#BF5700",
    secondary: "#ffffff",
    accent: "#F2EDE7",
    accessibleCampuses: ["texas"],
  },
  lsu: {
    name: "Louisiana State University",
    shortName: "LSU",
    primary: "#461D7C",
    secondary: "#FDD023",
    accent: "#F5F1FA",
    accessibleCampuses: ["lsu"],
  },
  alabama: {
    name: "The University of Alabama",
    shortName: "Alabama",
    primary: "#9E1B32",
    secondary: "#ffffff",
    accent: "#F5E9EC",
    accessibleCampuses: ["alabama"],
  },
} satisfies Record<string, UniversityTheme>;

export type UniversityId = keyof typeof universities;

export function getCampusName(campusId: string) {
  return universities[campusId as UniversityId]?.shortName ?? campusId;
}
