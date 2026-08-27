import type { SportsDataSource } from "@/data/sports/types";

export const FBS_STRUCTURE_SOURCE: SportsDataSource = {
  sourceName: "NCAA and official 2026 conference announcements",
  sourceUrl: "https://www.ncaa.com/news/football/article/2026-02-03/how-college-football-playoff-works-schedule-selections-rankings-byes-and-more",
  season: "2026 football",
  verifiedAt: "2026-08-24",
};

export type FootballConference = {
  id: string;
  label: string;
  longName: string;
  teamIds: readonly string[];
  source: SportsDataSource;
};

const conferenceSource = (sourceName: string, sourceUrl: string): SportsDataSource => ({
  sourceName,
  sourceUrl,
  season: "2026 football",
  verifiedAt: "2026-08-24",
});

export const footballConferences: readonly FootballConference[] = [
  {
    id: "sec", label: "SEC", longName: "Southeastern Conference",
    teamIds: ["alabama", "arkansas", "auburn", "florida", "georgia", "kentucky", "lsu", "mississippi-state", "missouri", "oklahoma", "ole-miss", "south-carolina", "tennessee", "texas", "texas-am", "vanderbilt"],
    source: conferenceSource("SEC", "https://www.secsports.com/standings/football"),
  },
  {
    id: "big-ten", label: "Big Ten", longName: "Big Ten Conference",
    teamIds: ["illinois", "indiana", "iowa", "maryland", "michigan", "michigan-state", "minnesota", "nebraska", "northwestern", "ohio-state", "oregon", "penn-state", "purdue", "rutgers", "ucla", "usc", "washington", "wisconsin"],
    source: conferenceSource("Big Ten", "https://bigten.org/standings.aspx?path=football"),
  },
  {
    id: "acc", label: "ACC", longName: "Atlantic Coast Conference",
    teamIds: ["boston-college", "california", "clemson", "duke", "florida-state", "georgia-tech", "louisville", "miami", "north-carolina", "nc-state", "pittsburgh", "smu", "stanford", "syracuse", "virginia", "virginia-tech", "wake-forest"],
    source: conferenceSource("ACC", "https://theacc.com/standings.aspx?path=football"),
  },
  {
    id: "big-12", label: "Big 12", longName: "Big 12 Conference",
    teamIds: ["arizona", "arizona-state", "baylor", "byu", "cincinnati", "colorado", "houston", "iowa-state", "kansas", "kansas-state", "oklahoma-state", "tcu", "texas-tech", "ucf", "utah", "west-virginia"],
    source: conferenceSource("Big 12", "https://big12sports.com/standings.aspx?path=football"),
  },
  {
    id: "american", label: "American", longName: "American Conference",
    teamIds: ["army", "charlotte", "east-carolina", "florida-atlantic", "memphis", "navy", "north-texas", "rice", "south-florida", "temple", "tulane", "tulsa", "uab", "utsa"],
    source: conferenceSource("American Conference 2026 schedule pairings", "https://theamerican.org/news/2025/10/14/american-announces-2026-football-schedule-pairings.aspx"),
  },
  {
    id: "cusa", label: "CUSA", longName: "Conference USA",
    teamIds: ["delaware", "fiu", "jacksonville-state", "kennesaw-state", "liberty", "middle-tennessee", "missouri-state", "new-mexico-state", "sam-houston", "western-kentucky"],
    source: conferenceSource("Conference USA revised 2026 alignment", "https://conferenceusa.com/news/2026/4/29/fb-cusa-releases-revised-2026-football-schedule.aspx"),
  },
  {
    id: "mac", label: "MAC", longName: "Mid-American Conference",
    teamIds: ["akron", "ball-state", "bowling-green", "buffalo", "central-michigan", "eastern-michigan", "kent-state", "miami-oh", "ohio", "sacramento-state", "toledo", "umass", "western-michigan"],
    source: conferenceSource("Mid-American Conference", "https://getsomemaction.com/news/2026/2/16/sacramento-state-joins-mid-american-conference-as-football-only-member.aspx"),
  },
  {
    id: "mountain-west", label: "Mountain West", longName: "Mountain West Conference",
    teamIds: ["air-force", "hawaii", "nevada", "new-mexico", "northern-illinois", "north-dakota-state", "san-jose-state", "unlv", "utep", "wyoming"],
    source: conferenceSource("Mountain West 2026 schedule", "https://themw.com/news/2026/6/4/mw-announces-2026-football-schedule.aspx"),
  },
  {
    id: "pac-12", label: "Pac-12", longName: "Pac-12 Conference",
    teamIds: ["boise-state", "colorado-state", "fresno-state", "oregon-state", "san-diego-state", "texas-state", "utah-state", "washington-state"],
    source: conferenceSource("Pac-12 2026 football schedule", "https://pac-12.com/news/2026/2/9/general-the-new-pac-12-announces-its-2026-football-schedule.aspx"),
  },
  {
    id: "sun-belt", label: "Sun Belt", longName: "Sun Belt Conference",
    teamIds: ["appalachian-state", "arkansas-state", "coastal-carolina", "georgia-southern", "georgia-state", "james-madison", "louisiana", "louisiana-tech", "marshall", "old-dominion", "south-alabama", "southern-miss", "troy", "ul-monroe"],
    source: conferenceSource("Sun Belt welcomes Louisiana Tech", "https://sunbeltsports.org/news/2026/7/1/general-sun-belt-officially-welcomes-louisiana-tech.aspx"),
  },
  {
    id: "independent", label: "Independents", longName: "FBS Independents",
    teamIds: ["notre-dame", "uconn"],
    source: FBS_STRUCTURE_SOURCE,
  },
] as const;

export const footballConferenceOptions = [
  { id: "ap-poll", label: "AP Poll" },
  ...footballConferences.map(({ id, label }) => ({ id, label })),
] as const;

export function getFootballConference(conferenceId: string) {
  return footballConferences.find((conference) => conference.id === conferenceId) ?? null;
}

export function getFootballConferenceForTeam(teamId: string) {
  return footballConferences.find((conference) => conference.teamIds.includes(teamId)) ?? null;
}
