import type { UniversityId } from "@/data/universities";
import { footballConferences } from "./conferences.ts";
import type { SportsTeamIdentity } from "@/data/sports/types";

const teamNameOverrides: Readonly<Record<string, string>> = {
  alabama: "Alabama Crimson Tide",
  byu: "BYU",
  fiu: "FIU",
  georgia: "Georgia Bulldogs",
  hawaii: "Hawai‘i",
  indiana: "Indiana Hoosiers",
  lsu: "LSU Tigers",
  miami: "Miami Hurricanes",
  "miami-oh": "Miami (Ohio)",
  "nc-state": "NC State",
  "notre-dame": "Notre Dame Fighting Irish",
  "ohio-state": "Ohio State Buckeyes",
  oklahoma: "Oklahoma Sooners",
  "ole-miss": "Ole Miss Rebels",
  oregon: "Oregon Ducks",
  smu: "SMU",
  tcu: "TCU",
  texas: "Texas Longhorns",
  "texas-am": "Texas A&M Aggies",
  uab: "UAB",
  ucf: "UCF",
  ucla: "UCLA",
  uconn: "UConn",
  "ul-monroe": "ULM",
  umass: "UMass",
  unlv: "UNLV",
  usc: "USC",
  utep: "UTEP",
  utsa: "UTSA",
};

const abbreviations: Readonly<Record<string, string>> = {
  "air-force": "AF", akron: "AKR", alabama: "ALA", "appalachian-state": "APP", arizona: "ARIZ", "arizona-state": "ASU", arkansas: "ARK", "arkansas-state": "ARST", army: "ARMY", auburn: "AUB", "ball-state": "BALL", baylor: "BAY", "boise-state": "BSU", "boston-college": "BC", "bowling-green": "BGSU", buffalo: "BUF", california: "CAL", "central-michigan": "CMU", charlotte: "CLT", cincinnati: "CIN", clemson: "CLEM", "coastal-carolina": "CCU", colorado: "COLO", "colorado-state": "CSU", delaware: "DEL", duke: "DUKE", "east-carolina": "ECU", "eastern-michigan": "EMU", fiu: "FIU", florida: "FLA", "florida-atlantic": "FAU", "florida-state": "FSU", "fresno-state": "FRES", georgia: "UGA", "georgia-southern": "GASO", "georgia-state": "GAST", "georgia-tech": "GT", hawaii: "HAW", houston: "HOU", illinois: "ILL", indiana: "IU", iowa: "IOWA", "iowa-state": "ISU", "jacksonville-state": "JAX", "james-madison": "JMU", kansas: "KU", "kansas-state": "KSU", "kennesaw-state": "KSU", "kent-state": "KENT", kentucky: "UK", liberty: "LIB", louisiana: "LA", "louisiana-tech": "LT", louisville: "LOU", lsu: "LSU", marshall: "MRSH", maryland: "UMD", memphis: "MEM", miami: "MIA", "miami-oh": "M-OH", michigan: "MICH", "michigan-state": "MSU", "middle-tennessee": "MTSU", minnesota: "MINN", "mississippi-state": "MSST", missouri: "MIZ", "missouri-state": "MOST", navy: "NAVY", nebraska: "NEB", nevada: "NEV", "new-mexico": "UNM", "new-mexico-state": "NMSU", "north-carolina": "UNC", "north-dakota-state": "NDSU", "north-texas": "UNT", "northern-illinois": "NIU", northwestern: "NU", "notre-dame": "ND", "nc-state": "NCSU", ohio: "OHIO", "ohio-state": "OSU", oklahoma: "OU", "oklahoma-state": "OKST", "old-dominion": "ODU", "ole-miss": "MISS", oregon: "ORE", "oregon-state": "ORST", "penn-state": "PSU", pittsburgh: "PITT", purdue: "PUR", rice: "RICE", rutgers: "RUT", "sacramento-state": "SAC", "sam-houston": "SHSU", "san-diego-state": "SDSU", "san-jose-state": "SJSU", "south-alabama": "USA", "south-carolina": "SC", "south-florida": "USF", "southern-miss": "USM", stanford: "STAN", syracuse: "SYR", temple: "TEM", tennessee: "TENN", texas: "TEX", "texas-am": "TAMU", "texas-state": "TXST", "texas-tech": "TTU", toledo: "TOL", troy: "TROY", tulane: "TUL", tulsa: "TLSA", "ul-monroe": "ULM", umass: "UMASS", unlv: "UNLV", usc: "USC", utah: "UTAH", "utah-state": "USU", utep: "UTEP", utsa: "UTSA", vanderbilt: "VAN", virginia: "UVA", "wake-forest": "WAKE", washington: "WASH", "washington-state": "WSU", "western-kentucky": "WKU", "western-michigan": "WMU", "west-virginia": "WVU", wisconsin: "WIS", wyoming: "WYO",
};

const universityIds: Partial<Record<string, UniversityId>> = {
  "texas-am": "tamu",
  texas: "texas",
  lsu: "lsu",
  alabama: "alabama",
};

const espnIds: Readonly<Record<string, number>> = {
  alabama: 333, byu: 252, georgia: 61, houston: 248, indiana: 84, iowa: 2294, louisville: 97, lsu: 99, miami: 2390, michigan: 130, missouri: 142, "notre-dame": 87, "ohio-state": 194, oklahoma: 201, "ole-miss": 145, oregon: 2483, "penn-state": 213, smu: 2567, tennessee: 2633, texas: 251, "texas-am": 245, "texas-tech": 2641, usc: 30, utah: 254, washington: 264,
};

const colorOverrides: Readonly<Record<string, { primary: string; secondary: string }>> = {
  "ohio-state": { primary: "#BA0C2F", secondary: "#FFFFFF" },
  oregon: { primary: "#154733", secondary: "#FEE123" },
  georgia: { primary: "#BA0C2F", secondary: "#FFFFFF" },
  "notre-dame": { primary: "#0C2340", secondary: "#C99700" },
  indiana: { primary: "#990000", secondary: "#FFFFFF" },
  miami: { primary: "#005030", secondary: "#F47321" },
  "ole-miss": { primary: "#CE1126", secondary: "#FFFFFF" },
  oklahoma: { primary: "#841617", secondary: "#FDF9D8" },
};

function displayName(teamId: string) {
  return teamNameOverrides[teamId] ?? teamId
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function fallbackAbbreviation(teamId: string) {
  return abbreviations[teamId] ?? teamId
    .split("-")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 5);
}

export const sportsTeams: readonly SportsTeamIdentity[] = footballConferences.flatMap((conference) =>
  conference.teamIds.map((id) => ({
    id,
    name: displayName(id),
    shortName: displayName(id),
    abbreviation: fallbackAbbreviation(id),
    footballConferenceId: conference.id,
    universityId: universityIds[id],
    logoUrl: espnIds[id]
      ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnIds[id]}.png`
      : undefined,
    colors: colorOverrides[id],
  })),
);

const supplementalTeams: readonly SportsTeamIdentity[] = [
  { id: "blinn", name: "Blinn Buccaneers", shortName: "Blinn", abbreviation: "BLINN", universityId: "blinn", colors: { primary: "#003366", secondary: "#FFFFFF" } },
  { id: "the-citadel", name: "The Citadel Bulldogs", shortName: "The Citadel", abbreviation: "CIT", colors: { primary: "#3975B7", secondary: "#FFFFFF" } },
  { id: "kilgore", name: "Kilgore Rangers", shortName: "Kilgore", abbreviation: "KC" },
  { id: "tyler-jc", name: "Tyler Junior College Apaches", shortName: "Tyler JC", abbreviation: "TJC" },
  { id: "snow-college", name: "Snow College Badgers", shortName: "Snow", abbreviation: "SNOW" },
  { id: "saint-marys", name: "Saint Mary’s Gaels", shortName: "Saint Mary’s", abbreviation: "SMC" },
  { id: "tamu-houston", name: "Houston Cougars", shortName: "Houston", abbreviation: "HOU", logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/248.png" },
  { id: "lamar", name: "Lamar Cardinals", shortName: "Lamar", abbreviation: "LAM" },
  { id: "usc-baseball", name: "USC Trojans", shortName: "USC", abbreviation: "USC", logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/30.png" },
  { id: "rice", name: "Rice Owls", shortName: "Rice", abbreviation: "RICE" },
  { id: "baylor", name: "Baylor Bears", shortName: "Baylor", abbreviation: "BAY" },
  { id: "sam-houston", name: "Sam Houston Bearkats", shortName: "Sam Houston", abbreviation: "SHSU" },
];

const allSportsTeams = [...sportsTeams];
for (const supplemental of supplementalTeams) {
  const index = allSportsTeams.findIndex((team) => team.id === supplemental.id);
  if (index >= 0) allSportsTeams[index] = { ...allSportsTeams[index], ...supplemental };
  else allSportsTeams.push(supplemental);
}

export const allTeamIdentities: readonly SportsTeamIdentity[] = allSportsTeams;

export function getSportsTeam(teamId: string) {
  return allTeamIdentities.find((team) => team.id === teamId) ?? null;
}
