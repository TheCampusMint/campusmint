import type { UniversityId } from "../universities.ts";
import { apCurrentPoll, AP_POLL_SOURCE } from "./football.ts";
import { getFootballConferenceForTeam } from "./conferences.ts";
import { getSportsTeam } from "./teams.ts";
import type { SportsDataSource } from "./types.ts";

export const launchCampusSports = [
  { id: "football", label: "Football" },
  { id: "basketball", label: "Basketball" },
  { id: "baseball", label: "Baseball" },
] as const;

export type LaunchCampusSportId = (typeof launchCampusSports)[number]["id"];
export type CollegeAthleticsDivision =
  | "ncaa_d1"
  | "ncaa_d2"
  | "ncaa_d3"
  | "njcaa";

export type CampusScheduleGame = {
  id: string;
  sport: LaunchCampusSportId;
  opponentName: string;
  date: string;
  dateLabel: string;
  timeLabel: string | null;
  homeAway: "home" | "away" | "neutral";
  location: string | null;
  network: string | null;
  status: "scheduled" | "live" | "final" | "verification_pending";
  campusScore: number | null;
  opponentScore: number | null;
  liveDetail: string | null;
  result: "W" | "L" | "T" | null;
  sourceGameId?: string;
  scheduleSourceUrl?: string;
  boxScoreSourceUrl?: string | null;
  lastUpdated?: string;
  detail?: CampusGameDetail | null;
};

export type CampusGameStatRow = {
  playerId: string;
  playerName: string;
  teamName: string;
  participated: true;
  values: readonly string[];
};

export type CampusGameStatGroup = {
  id: string;
  label: string;
  columns: readonly string[];
  rows: readonly CampusGameStatRow[];
};

export type CampusGameDetail = {
  scopeLabel: string;
  sourceUrl: string;
  sourceName: string;
  statGroups: readonly CampusGameStatGroup[];
};

export type CampusSportProgram = {
  sport: LaunchCampusSportId;
  label: string;
  seasonLabel: string;
  seasonStart: string;
  seasonEnd: string;
  schedulePublished: boolean;
  games: readonly CampusScheduleGame[];
  source: SportsDataSource;
  record?: string | null;
};

export type CampusAthleticsProfile = {
  universityId: UniversityId;
  universityName: string;
  nickname: string;
  division: CollegeAthleticsDivision;
  divisionLabel: string;
  conferenceId: string | null;
  conferenceLabel: string;
  supportedSports: readonly LaunchCampusSportId[];
  programs: Partial<Record<LaunchCampusSportId, CampusSportProgram>>;
  /** Provider snapshots may replace bundled weekly poll boards without a deploy. */
  rankingBoards?: Partial<Record<LaunchCampusSportId, readonly CampusRankingBoard[]>>;
};

export type CampusRankingBoard = {
  id: string;
  kind: "national" | "conference";
  title: string;
  entries: readonly { rank: number; teamId: string; teamName: string }[];
  source: SportsDataSource;
};

export type SportsEntitlement = {
  sportsPlus: boolean;
  source: "development_default" | "verified_subscription";
};

export const defaultSportsEntitlement: SportsEntitlement = {
  sportsPlus: false,
  source: "development_default",
};

const footballSource: SportsDataSource = {
  sourceName: "Texas A&M Athletics · 2026 football schedule",
  sourceUrl: "https://12thman.com/news/2025/12/11/2026-football-schedule-announced",
  season: "2026",
  verifiedAt: "2026-09-10",
  lastFetchedAt: "2026-09-10T12:00:00-05:00",
  staleAfter: "2026-09-12T14:00:00-05:00",
};

const basketballSource: SportsDataSource = {
  sourceName: "Texas A&M Athletics · 2026–27 men's basketball schedule",
  sourceUrl: "https://12thman.com/sports/mens-basketball/schedule?path=mbball",
  season: "2026–27",
  verifiedAt: "2026-08-29",
};

const baseballSource: SportsDataSource = {
  sourceName: "Texas A&M Athletics · 2027 published baseball schedule",
  sourceUrl: "https://12thman.com/sports/baseball/schedule?path=baseball",
  season: "2027",
  verifiedAt: "2026-09-10",
  lastFetchedAt: "2026-09-10T12:00:00-05:00",
  staleAfter: "2026-09-11T12:00:00-05:00",
};

function scheduledGame(
  sport: LaunchCampusSportId,
  game: Omit<
    CampusScheduleGame,
    "sport" | "status" | "campusScore" | "opponentScore" | "liveDetail" | "result"
  >,
): CampusScheduleGame {
  return {
    ...game,
    sport,
    status: "scheduled",
    campusScore: null,
    opponentScore: null,
    liveDetail: null,
    result: null,
  };
}

const texasAmFootballGames: readonly CampusScheduleGame[] = [
  {
    id: "tamu-fb-missouri-state", sport: "football", opponentName: "Missouri State",
    date: "2026-09-05T18:00:00-05:00", dateLabel: "Sep 5", timeLabel: "6:00 PM CT",
    homeAway: "home", location: "Kyle Field", network: "ESPN", status: "final",
    campusScore: 50, opponentScore: 0, liveDetail: null, result: "W",
    sourceGameId: "tamu-missouri-state-2026-09-05",
    scheduleSourceUrl: "https://12thman.com/sports/football/schedule",
    boxScoreSourceUrl: "https://12thman.com/documents/ec53897d-8a81-4352-b0e9-80e8e97ed36b.pdf",
    lastUpdated: "2026-09-05T22:30:00-05:00",
    detail: {
      scopeLabel: "Official recap stat producers; not a complete participation list",
      sourceUrl: "https://12thman.com/news/2026/09/5/aggies-vs-missouri-state",
      sourceName: "Texas A&M Athletics official recap and box score",
      statGroups: [
        { id: "passing", label: "Passing", columns: ["C/ATT", "YDS", "TD"], rows: [
          { playerId: "marcel-reed", playerName: "Marcel Reed", teamName: "Texas A&M", participated: true, values: ["21/30", "233", "2"] },
          { playerId: "brady-hart", playerName: "Brady Hart", teamName: "Texas A&M", participated: true, values: ["—", "—", "1"] },
        ] },
        { id: "rushing", label: "Rushing", columns: ["CAR", "YDS", "TD"], rows: [
          { playerId: "rueben-owens", playerName: "Rueben Owens II", teamName: "Texas A&M", participated: true, values: ["17", "77", "0"] },
          { playerId: "marcel-reed-rush", playerName: "Marcel Reed", teamName: "Texas A&M", participated: true, values: ["7", "20", "0"] },
          { playerId: "terry-bussey", playerName: "Terry Bussey", teamName: "Texas A&M", participated: true, values: ["—", "—", "1"] },
          { playerId: "jamarion-morrow", playerName: "Jamarion Morrow", teamName: "Texas A&M", participated: true, values: ["—", "—", "1"] },
          { playerId: "carsyn-baker", playerName: "Carsyn Baker", teamName: "Texas A&M", participated: true, values: ["—", "—", "1"] },
        ] },
        { id: "receiving", label: "Receiving", columns: ["REC", "YDS", "TD"], rows: [
          { playerId: "mario-craver", playerName: "Mario Craver", teamName: "Texas A&M", participated: true, values: ["5", "41", "1"] },
          { playerId: "isaiah-horton", playerName: "Isaiah Horton", teamName: "Texas A&M", participated: true, values: ["4", "76", "1"] },
          { playerId: "aaron-gregory", playerName: "Aaron Gregory", teamName: "Texas A&M", participated: true, values: ["—", "—", "1"] },
        ] },
        { id: "defense", label: "Defense", columns: ["TKL", "TFL", "SACK", "FF/FR"], rows: [
          { playerId: "noah-mikhail", playerName: "Noah Mikhail", teamName: "Texas A&M", participated: true, values: ["7", "—", "—", "—"] },
          { playerId: "ryan-henderson", playerName: "Ryan Henderson", teamName: "Texas A&M", participated: true, values: ["—", "2", "1", "1/0"] },
          { playerId: "anto-saka", playerName: "Anto Saka", teamName: "Texas A&M", participated: true, values: ["—", "—", "—", "0/1"] },
          { playerId: "dj-sanders", playerName: "DJ Sanders", teamName: "Texas A&M", participated: true, values: ["—", "—", "—", "0/1"] },
        ] },
        { id: "kicking", label: "Kicking", columns: ["FG", "NOTE"], rows: [
          { playerId: "david-olano", playerName: "David Olano", teamName: "Texas A&M", participated: true, values: ["1", "28 yards"] },
          { playerId: "asher-murray", playerName: "Asher Murray", teamName: "Texas A&M", participated: true, values: ["1", "47 yards"] },
        ] },
      ],
    },
  },
  scheduledGame("football", { id: "tamu-fb-arizona-state", opponentName: "Arizona State", date: "2026-09-12T11:00:00-05:00", dateLabel: "Sep 12", timeLabel: "11:00 AM CT", homeAway: "home", location: "Kyle Field", network: "ABC" }),
  scheduledGame("football", { id: "tamu-fb-kentucky", opponentName: "Kentucky", date: "2026-09-19T14:30:00-05:00", dateLabel: "Sep 19", timeLabel: "2:30 PM CT", homeAway: "home", location: "Kyle Field", network: "ESPN / ESPN2" }),
  scheduledGame("football", { id: "tamu-fb-lsu", opponentName: "LSU", date: "2026-09-26", dateLabel: "Sep 26", timeLabel: "TBA", homeAway: "away", location: "Tiger Stadium", network: null }),
  scheduledGame("football", { id: "tamu-fb-arkansas", opponentName: "Arkansas", date: "2026-10-03", dateLabel: "Oct 3", timeLabel: "TBA", homeAway: "home", location: "Kyle Field", network: null }),
  scheduledGame("football", { id: "tamu-fb-missouri", opponentName: "Missouri", date: "2026-10-10", dateLabel: "Oct 10", timeLabel: "TBA", homeAway: "away", location: "Faurot Field", network: null }),
  scheduledGame("football", { id: "tamu-fb-citadel", opponentName: "The Citadel", date: "2026-10-17T12:00:00-05:00", dateLabel: "Oct 17", timeLabel: "12:00 PM CT", homeAway: "home", location: "Kyle Field", network: "SEC Network+" }),
  scheduledGame("football", { id: "tamu-fb-alabama", opponentName: "Alabama", date: "2026-10-24", dateLabel: "Oct 24", timeLabel: "TBA", homeAway: "away", location: "Bryant–Denny Stadium", network: null }),
  scheduledGame("football", { id: "tamu-fb-south-carolina", opponentName: "South Carolina", date: "2026-11-07", dateLabel: "Nov 7", timeLabel: "TBA", homeAway: "away", location: "Williams–Brice Stadium", network: null }),
  scheduledGame("football", { id: "tamu-fb-tennessee", opponentName: "Tennessee", date: "2026-11-14", dateLabel: "Nov 14", timeLabel: "TBA", homeAway: "home", location: "Kyle Field", network: null }),
  scheduledGame("football", { id: "tamu-fb-oklahoma", opponentName: "Oklahoma", date: "2026-11-21", dateLabel: "Nov 21", timeLabel: "TBA", homeAway: "away", location: "Oklahoma Memorial Stadium", network: null }),
  scheduledGame("football", { id: "tamu-fb-texas", opponentName: "Texas", date: "2026-11-27T18:30:00-06:00", dateLabel: "Nov 27", timeLabel: "6:30 PM CT", homeAway: "home", location: "Kyle Field", network: "ABC" }),
];

const basketballGame = (
  id: string,
  opponentName: string,
  date: string,
  dateLabel: string,
  homeAway: CampusScheduleGame["homeAway"],
  location: string | null,
) =>
  scheduledGame("basketball", {
    id,
    opponentName,
    date,
    dateLabel,
    timeLabel: "TBA",
    homeAway,
    location,
    network: null,
  });

const texasAmBasketballGames: readonly CampusScheduleGame[] = [
  basketballGame("tamu-mbb-smu", "SMU (exhibition)", "2026-10-25", "Oct 25", "away", "Moody Coliseum"),
  basketballGame("tamu-mbb-alabama-state", "Alabama State", "2026-11-03", "Nov 3", "home", "Reed Arena"),
  basketballGame("tamu-mbb-northern-kentucky", "Northern Kentucky", "2026-11-06", "Nov 6", "home", "Reed Arena"),
  basketballGame("tamu-mbb-ulm", "ULM", "2026-11-09", "Nov 9", "home", "Reed Arena"),
  basketballGame("tamu-mbb-oklahoma-state", "Oklahoma State", "2026-11-12", "Nov 12", "home", "Reed Arena"),
  basketballGame("tamu-mbb-southeastern-louisiana", "Southeastern Louisiana", "2026-11-16", "Nov 16", "home", "Reed Arena"),
  basketballGame("tamu-mbb-tcu", "TCU", "2026-11-19", "Nov 19", "away", "Schollmaier Arena"),
  basketballGame("tamu-mbb-atlantis-1", "Battle 4 Atlantis opponent TBD", "2026-11-25", "Nov 25", "neutral", "Paradise Island, Bahamas"),
  basketballGame("tamu-mbb-atlantis-2", "Battle 4 Atlantis opponent TBD", "2026-11-27", "Nov 27", "neutral", "Paradise Island, Bahamas"),
  basketballGame("tamu-mbb-stanford", "Stanford", "2026-12-02", "Dec 2", "home", "Reed Arena"),
  basketballGame("tamu-mbb-uapb", "Arkansas–Pine Bluff", "2026-12-06", "Dec 6", "home", "Reed Arena"),
  basketballGame("tamu-mbb-florida-state", "Florida State", "2026-12-12", "Dec 12", "neutral", "Toyota Center, Houston"),
  basketballGame("tamu-mbb-holy-cross", "Holy Cross", "2026-12-17", "Dec 17", "home", "Reed Arena"),
  basketballGame("tamu-mbb-north-florida", "North Florida", "2026-12-21", "Dec 21", "home", "Reed Arena"),
  basketballGame("tamu-mbb-prairie-view", "Prairie View A&M", "2026-12-29", "Dec 29", "home", "Reed Arena"),
  basketballGame("tamu-mbb-auburn", "Auburn", "2027-01-02", "Jan 2", "home", "Reed Arena"),
  basketballGame("tamu-mbb-missouri", "Missouri", "2027-01-05", "Jan 5/6", "away", "Mizzou Arena"),
  basketballGame("tamu-mbb-south-carolina", "South Carolina", "2027-01-09", "Jan 9", "away", "Colonial Life Arena"),
  basketballGame("tamu-mbb-arkansas", "Arkansas", "2027-01-12", "Jan 12/13", "home", "Reed Arena"),
  basketballGame("tamu-mbb-lsu-home", "LSU", "2027-01-16", "Jan 16", "home", "Reed Arena"),
  basketballGame("tamu-mbb-florida", "Florida", "2027-01-19", "Jan 19/20", "away", "Exactech Arena"),
  basketballGame("tamu-mbb-ole-miss", "Ole Miss", "2027-01-23", "Jan 23", "away", "The Pavilion"),
  basketballGame("tamu-mbb-tennessee", "Tennessee", "2027-01-26", "Jan 26/27", "home", "Reed Arena"),
  basketballGame("tamu-mbb-vanderbilt-away", "Vanderbilt", "2027-01-30", "Jan 30", "away", "Memorial Gymnasium"),
  basketballGame("tamu-mbb-oklahoma", "Oklahoma", "2027-02-02", "Feb 2/3", "home", "Reed Arena"),
  basketballGame("tamu-mbb-mississippi-state", "Mississippi State", "2027-02-06", "Feb 6", "away", "Humphrey Coliseum"),
  basketballGame("tamu-mbb-georgia", "Georgia", "2027-02-13", "Feb 13", "home", "Reed Arena"),
  basketballGame("tamu-mbb-texas-away", "Texas", "2027-02-16", "Feb 16/17", "away", "Moody Center"),
  basketballGame("tamu-mbb-vanderbilt-home", "Vanderbilt", "2027-02-20", "Feb 20", "home", "Reed Arena"),
  basketballGame("tamu-mbb-alabama", "Alabama", "2027-02-23", "Feb 23/24", "home", "Reed Arena"),
  basketballGame("tamu-mbb-lsu-away", "LSU", "2027-02-27", "Feb 27", "away", "Pete Maravich Assembly Center"),
  basketballGame("tamu-mbb-kentucky", "Kentucky", "2027-03-02", "Mar 2/3", "away", "Rupp Arena"),
  basketballGame("tamu-mbb-texas-home", "Texas", "2027-03-06", "Mar 6", "home", "Reed Arena"),
];

const texasAmBaseballGames: readonly CampusScheduleGame[] = [
  scheduledGame("baseball", { id: "tamu-base-rice-exhibition", opponentName: "Rice (exhibition)", date: "2026-10-02T18:00:00-05:00", dateLabel: "Oct 2", timeLabel: "6:00 PM CT", homeAway: "home", location: "Blue Bell Park", network: null }),
  scheduledGame("baseball", { id: "tamu-base-mcneese-exhibition", opponentName: "McNeese (exhibition)", date: "2026-10-16T19:00:00-05:00", dateLabel: "Oct 16", timeLabel: "7:00 PM CT", homeAway: "home", location: "Blue Bell Park", network: null }),
  scheduledGame("baseball", { id: "tamu-base-louisville", opponentName: "Louisville", date: "2027-03-05T19:00:00-06:00", dateLabel: "Mar 5", timeLabel: "7:00 PM CT", homeAway: "neutral", location: "Daikin Park · Houston", network: null }),
  scheduledGame("baseball", { id: "tamu-base-louisiana", opponentName: "Louisiana", date: "2027-03-06T19:00:00-06:00", dateLabel: "Mar 6", timeLabel: "7:00 PM CT", homeAway: "neutral", location: "Daikin Park · Houston", network: null }),
  scheduledGame("baseball", { id: "tamu-base-houston", opponentName: "Houston", date: "2027-03-07T18:00:00-06:00", dateLabel: "Mar 7", timeLabel: "6:00 PM CT", homeAway: "neutral", location: "Daikin Park · Houston", network: null }),
  scheduledGame("baseball", { id: "tamu-base-alabama-series", opponentName: "Alabama · series", date: "2027-03-19", dateLabel: "Mar 19–21", timeLabel: "TBA", homeAway: "away", location: "Tuscaloosa, Ala.", network: null }),
  scheduledGame("baseball", { id: "tamu-base-tennessee-series", opponentName: "Tennessee · series", date: "2027-03-26", dateLabel: "Mar 26–28", timeLabel: "TBA", homeAway: "home", location: "Blue Bell Park", network: null }),
  scheduledGame("baseball", { id: "tamu-base-kentucky-series", opponentName: "Kentucky · series", date: "2027-04-02", dateLabel: "Apr 2–4", timeLabel: "TBA", homeAway: "away", location: "Lexington, Ky.", network: null }),
  scheduledGame("baseball", { id: "tamu-base-oklahoma-series", opponentName: "Oklahoma · series", date: "2027-04-09", dateLabel: "Apr 9–11", timeLabel: "TBA", homeAway: "home", location: "Blue Bell Park", network: null }),
  scheduledGame("baseball", { id: "tamu-base-mississippi-state-series", opponentName: "Mississippi State · series", date: "2027-04-16", dateLabel: "Apr 16–18", timeLabel: "TBA", homeAway: "away", location: "Starkville, Miss.", network: null }),
  scheduledGame("baseball", { id: "tamu-base-lsu-series", opponentName: "LSU · series", date: "2027-04-23", dateLabel: "Apr 23–25", timeLabel: "TBA", homeAway: "home", location: "Blue Bell Park", network: null }),
  scheduledGame("baseball", { id: "tamu-base-south-carolina-series", opponentName: "South Carolina · series", date: "2027-04-30", dateLabel: "Apr 30–May 2", timeLabel: "TBA", homeAway: "away", location: "Columbia, S.C.", network: null }),
  scheduledGame("baseball", { id: "tamu-base-arkansas-series", opponentName: "Arkansas · series", date: "2027-05-07", dateLabel: "May 7–9", timeLabel: "TBA", homeAway: "home", location: "Blue Bell Park", network: null }),
  scheduledGame("baseball", { id: "tamu-base-texas-series", opponentName: "Texas · series", date: "2027-05-14", dateLabel: "May 14–16", timeLabel: "TBA", homeAway: "away", location: "Austin, Texas", network: null }),
  scheduledGame("baseball", { id: "tamu-base-ole-miss-series", opponentName: "Ole Miss · series", date: "2027-05-20", dateLabel: "May 20–22", timeLabel: "TBA", homeAway: "home", location: "Blue Bell Park", network: null }),
  scheduledGame("baseball", { id: "tamu-base-sec-tournament", opponentName: "SEC Tournament · opponent TBD", date: "2027-05-25", dateLabel: "May 25–30", timeLabel: "TBA", homeAway: "neutral", location: "Hoover, Ala.", network: null }),
];

const texasAmPrograms: CampusAthleticsProfile["programs"] = {
  football: {
    sport: "football",
    label: "Football",
    seasonLabel: "2026",
    seasonStart: "2026-09-05",
    seasonEnd: "2026-11-27",
    schedulePublished: true,
    games: texasAmFootballGames,
    source: footballSource,
    record: "1–0",
  },
  basketball: {
    sport: "basketball",
    label: "Men's Basketball",
    seasonLabel: "2026–27",
    seasonStart: "2026-10-25",
    seasonEnd: "2027-03-06",
    schedulePublished: true,
    games: texasAmBasketballGames,
    source: basketballSource,
  },
  baseball: {
    sport: "baseball",
    label: "Baseball",
    seasonLabel: "2027",
    seasonStart: "2027-02-01",
    seasonEnd: "2027-06-30",
    schedulePublished: true,
    games: texasAmBaseballGames,
    source: baseballSource,
    record: "0–0",
  },
};

function standardProfile(input: {
  universityId: Exclude<UniversityId, "tamu">;
  universityName: string;
  nickname: string;
  division: CollegeAthleticsDivision;
  divisionLabel: string;
  conferenceId: string | null;
  conferenceLabel: string;
}) : CampusAthleticsProfile {
  return {
    ...input,
    supportedSports: [],
    programs: {},
  };
}

export const campusAthleticsProfiles: Readonly<Record<UniversityId, CampusAthleticsProfile>> = {
  tamu: {
    universityId: "tamu",
    universityName: "Texas A&M University",
    nickname: "Aggies",
    division: "ncaa_d1",
    divisionLabel: "NCAA Division I",
    conferenceId: "sec",
    conferenceLabel: "SEC",
    supportedSports: ["football", "basketball", "baseball"],
    programs: texasAmPrograms,
  },
  blinn: standardProfile({ universityId: "blinn", universityName: "Blinn College", nickname: "Buccaneers", division: "njcaa", divisionLabel: "NJCAA", conferenceId: null, conferenceLabel: "NJCAA Region XIV" }),
  texas: standardProfile({ universityId: "texas", universityName: "The University of Texas at Austin", nickname: "Longhorns", division: "ncaa_d1", divisionLabel: "NCAA Division I", conferenceId: "sec", conferenceLabel: "SEC" }),
  lsu: standardProfile({ universityId: "lsu", universityName: "Louisiana State University", nickname: "Tigers", division: "ncaa_d1", divisionLabel: "NCAA Division I", conferenceId: "sec", conferenceLabel: "SEC" }),
  alabama: standardProfile({ universityId: "alabama", universityName: "The University of Alabama", nickname: "Crimson Tide", division: "ncaa_d1", divisionLabel: "NCAA Division I", conferenceId: "sec", conferenceLabel: "SEC" }),
};

export function getCampusAthleticsProfile(universityId: UniversityId | null) {
  return universityId ? campusAthleticsProfiles[universityId] ?? null : null;
}

export function getAvailableCampusPrograms(profile: CampusAthleticsProfile) {
  return profile.supportedSports.flatMap((sport) => {
    const program = profile.programs[sport];
    return program ? [program] : [];
  });
}

export function getLiveCampusGames(
  profile: CampusAthleticsProfile,
  currentTime: number,
) {
  return getAvailableCampusPrograms(profile)
    .flatMap((program) => program.games)
    .filter((game) => resolveCampusGameState(game, programForGame(profile, game)?.source, currentTime) === "live")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function resolveDefaultCampusSport(
  profile: CampusAthleticsProfile,
  currentTime: number,
): LaunchCampusSportId | null {
  const programs = getAvailableCampusPrograms(profile);
  const live = programs.find((program) =>
    program.games.some((game) => resolveCampusGameState(game, program.source, currentTime) === "live"),
  );
  if (live) return live.sport;

  const inSeason = programs
    .filter(
      (program) =>
        new Date(program.seasonStart).getTime() <= currentTime &&
        currentTime <= new Date(`${program.seasonEnd}T23:59:59`).getTime(),
    )
    .sort((a, b) => {
      const nextFor = (program: CampusSportProgram) =>
        program.games.find((game) => new Date(game.date).getTime() >= currentTime);
      return (
        (nextFor(a) ? new Date(nextFor(a)!.date).getTime() : Number.MAX_SAFE_INTEGER) -
        (nextFor(b) ? new Date(nextFor(b)!.date).getTime() : Number.MAX_SAFE_INTEGER)
      );
    });
  if (inSeason[0]) return inSeason[0].sport;

  const nextProgram = programs
    .flatMap((program) =>
      program.games
        .filter((game) => new Date(game.date).getTime() >= currentTime)
        .map((game) => ({ program, game })),
    )
    .sort((a, b) => new Date(a.game.date).getTime() - new Date(b.game.date).getTime())[0];
  return nextProgram?.program.sport ?? programs[0]?.sport ?? null;
}

export function getCampusRankingBoards(
  profile: CampusAthleticsProfile,
  sport: LaunchCampusSportId,
): CampusRankingBoard[] {
  const providerBoards = profile.rankingBoards?.[sport];
  if (providerBoards) return [...providerBoards];
  if (sport !== "football" || profile.division !== "ncaa_d1") return [];
  const entries = apCurrentPoll.flatMap(({ rank, teamId }) => {
    const team = getSportsTeam(teamId);
    return team ? [{ rank, teamId, teamName: team.name }] : [];
  });
  const boards: CampusRankingBoard[] = [
    {
      id: "ap-2026-09-08",
      kind: "national",
      title: "AP Top 25 · Sep 8",
      entries,
      source: AP_POLL_SOURCE,
    },
  ];
  if (profile.conferenceId) {
    boards.push({
      id: `${profile.conferenceId}-ap-2026-09-08`,
      kind: "conference",
      title: `${profile.conferenceLabel} teams in AP Top 25`,
      entries: entries.filter(
        (entry) =>
          getFootballConferenceForTeam(entry.teamId)?.id === profile.conferenceId,
      ),
      source: AP_POLL_SOURCE,
    });
  }
  return boards;
}

function programForGame(profile: CampusAthleticsProfile, game: CampusScheduleGame) {
  return profile.programs[game.sport] ?? null;
}

export function resolveCampusGameState(
  game: CampusScheduleGame,
  source: SportsDataSource | null | undefined,
  currentTime: number,
) {
  if (game.status === "final") return "final" as const;
  const startsAt = new Date(game.date).getTime();
  if (!Number.isFinite(startsAt)) return "verification_pending" as const;
  if (game.status === "live") {
    const staleAt = source?.staleAfter ? new Date(source.staleAfter).getTime() : Number.NaN;
    return Number.isFinite(staleAt) && currentTime > staleAt ? "verification_pending" as const : "live" as const;
  }
  if (startsAt <= currentTime || game.status === "verification_pending") return "verification_pending" as const;
  return "scheduled" as const;
}

export function getCampusGameDetail(game: CampusScheduleGame) {
  if (game.status !== "final") return null;
  return game.detail ?? null;
}

export function getVerifiedGameParticipants(game: CampusScheduleGame) {
  return getCampusGameDetail(game)?.statGroups.flatMap((group) => group.rows).filter((row) => row.participated) ?? [];
}

export function getNextCampusGame(
  profile: CampusAthleticsProfile,
  currentTime: number,
) {
  return getAvailableCampusPrograms(profile)
    .flatMap((program) => program.games)
    .filter((game) => game.status === "scheduled" && new Date(game.date).getTime() >= currentTime)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;
}
