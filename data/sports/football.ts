import type { UniversityId } from "@/data/universities";
import { FBS_STRUCTURE_SOURCE, getFootballConferenceForTeam } from "./conferences.ts";
import type { SportsDataSource, SportsGame, SportsSeason } from "@/data/sports/types";

export const AP_POLL_SOURCE: SportsDataSource = {
  sourceName: "Associated Press 2026 preseason Top 25",
  sourceUrl: "https://apnews.com/article/ap-top-25-preseason-poll-bd5dd1c058fab6047510f09e18b035f1",
  season: "2026 preseason",
  verifiedAt: "2026-08-24",
};

export const TEXAS_AM_FOOTBALL_SOURCE: SportsDataSource = {
  sourceName: "Texas A&M Athletics 2026 football schedule",
  sourceUrl: "https://12thman.com/sports/football/schedule",
  season: "2026",
  verifiedAt: "2026-08-24",
};

export const BLINN_FOOTBALL_SOURCE: SportsDataSource = {
  sourceName: "Blinn College Athletics 2026 season preview",
  sourceUrl: "https://buccaneersports.com/news/2026/8/20/football-blinn-seeking-to-turn-experience-urgency-into-winning-season-in-2026.aspx",
  season: "2026",
  verifiedAt: "2026-08-24",
};

const BLINN_KILGORE_RESULT_SOURCE: SportsDataSource = {
  sourceName: "Blinn College Athletics · Blinn 34, Kilgore 20",
  sourceUrl: "https://buccaneersports.com/story.aspx?file_date=8%2F23%2F2026&filename=football-blinn-rallies-past-kilgore-for-first-win-over-rangers-since-2017-the-buccaneers-scored-21-unanswered-points-to-secure-the-season-opening-victory",
  season: "2026",
  verifiedAt: "2026-08-25",
};

export type ApPollEntry = { rank: number; teamId: string };

export const apPreseasonPoll: readonly ApPollEntry[] = [
  { rank: 1, teamId: "ohio-state" }, { rank: 2, teamId: "oregon" },
  { rank: 3, teamId: "georgia" }, { rank: 4, teamId: "notre-dame" },
  { rank: 5, teamId: "texas" }, { rank: 6, teamId: "indiana" },
  { rank: 7, teamId: "miami" }, { rank: 8, teamId: "texas-am" },
  { rank: 9, teamId: "ole-miss" }, { rank: 10, teamId: "oklahoma" },
  { rank: 11, teamId: "lsu" }, { rank: 12, teamId: "texas-tech" },
  { rank: 13, teamId: "alabama" }, { rank: 14, teamId: "byu" },
  { rank: 14, teamId: "usc" }, { rank: 16, teamId: "michigan" },
  { rank: 17, teamId: "washington" }, { rank: 18, teamId: "penn-state" },
  { rank: 19, teamId: "smu" }, { rank: 20, teamId: "tennessee" },
  { rank: 21, teamId: "utah" }, { rank: 22, teamId: "iowa" },
  { rank: 23, teamId: "houston" }, { rank: 24, teamId: "louisville" },
  { rank: 25, teamId: "missouri" },
] as const;

const tamuGame = (game: Omit<SportsGame, "status" | "source">): SportsGame => ({
  ...game,
  status: "scheduled",
  source: TEXAS_AM_FOOTBALL_SOURCE,
});

const texasAmSchedule: readonly SportsGame[] = [
  tamuGame({ id: "tamu-missouri-state", opponentId: "missouri-state", date: "2026-09-05T18:00:00-05:00", dateLabel: "Sep 5, 2026", timeLabel: "6:00 PM CT", homeAway: "home", venue: "Kyle Field", network: "ESPN" }),
  tamuGame({ id: "tamu-arizona-state", opponentId: "arizona-state", date: "2026-09-12T11:00:00-05:00", dateLabel: "Sep 12, 2026", timeLabel: "11:00 AM CT", homeAway: "home", venue: "Kyle Field", network: "ABC" }),
  tamuGame({ id: "tamu-kentucky", opponentId: "kentucky", date: "2026-09-19T14:30:00-05:00", dateLabel: "Sep 19, 2026", timeLabel: "2:30 PM CT", homeAway: "home", venue: "Kyle Field", network: "ESPN / ESPN2" }),
  tamuGame({ id: "tamu-lsu", opponentId: "lsu", date: "2026-09-26", dateLabel: "Sep 26, 2026", timeLabel: "TBA", homeAway: "away", venue: "Tiger Stadium" }),
  tamuGame({ id: "tamu-arkansas", opponentId: "arkansas", date: "2026-10-03", dateLabel: "Oct 3, 2026", timeLabel: "TBA", homeAway: "home", venue: "Kyle Field" }),
  tamuGame({ id: "tamu-missouri", opponentId: "missouri", date: "2026-10-10", dateLabel: "Oct 10, 2026", timeLabel: "TBA", homeAway: "away", venue: "Faurot Field" }),
  tamuGame({ id: "tamu-the-citadel", opponentId: "the-citadel", date: "2026-10-17T12:00:00-05:00", dateLabel: "Oct 17, 2026", timeLabel: "12:00 PM CT", homeAway: "home", venue: "Kyle Field", network: "SEC Network+" }),
  tamuGame({ id: "tamu-alabama", opponentId: "alabama", date: "2026-10-24", dateLabel: "Oct 24, 2026", timeLabel: "TBA", homeAway: "away", venue: "Bryant–Denny Stadium" }),
  tamuGame({ id: "tamu-south-carolina", opponentId: "south-carolina", date: "2026-11-07", dateLabel: "Nov 7, 2026", timeLabel: "TBA", homeAway: "away", venue: "Williams–Brice Stadium" }),
  tamuGame({ id: "tamu-tennessee", opponentId: "tennessee", date: "2026-11-14", dateLabel: "Nov 14, 2026", timeLabel: "TBA", homeAway: "home", venue: "Kyle Field" }),
  tamuGame({ id: "tamu-oklahoma", opponentId: "oklahoma", date: "2026-11-21", dateLabel: "Nov 21, 2026", timeLabel: "TBA", homeAway: "away", venue: "Oklahoma Memorial Stadium" }),
  tamuGame({ id: "tamu-texas", opponentId: "texas", date: "2026-11-27T18:30:00-06:00", dateLabel: "Nov 27, 2026", timeLabel: "6:30 PM CT", homeAway: "home", venue: "Kyle Field", network: "ABC" }),
] as const;

const blinnSchedule: readonly SportsGame[] = [
  { id: "blinn-kilgore-1", opponentId: "kilgore", date: "2026-08-22T19:00:00-05:00", dateLabel: "Aug 22, 2026", homeAway: "home", venue: "Cub Stadium", status: "final", result: { outcome: "W", teamScore: 34, opponentScore: 20 }, scoringHighlight: "Blinn scored 21 unanswered points; Lorenn Johnson had a 70-yard touchdown and Bryson Batts returned a kickoff 102 yards for a score.", source: BLINN_KILGORE_RESULT_SOURCE },
  { id: "blinn-tyler", opponentId: "tyler-jc", date: "2026-09-05", dateLabel: "Sep 5, 2026", timeLabel: "TBA", homeAway: "home", venue: "Cub Stadium", status: "scheduled", source: BLINN_FOOTBALL_SOURCE },
  { id: "blinn-kilgore-2", opponentId: "kilgore", date: "2026-09-26", dateLabel: "Sep 26, 2026", timeLabel: "TBA", homeAway: "away", status: "scheduled", source: BLINN_FOOTBALL_SOURCE },
  { id: "blinn-snow", opponentId: "snow-college", date: "2026-10-03T15:00:00-05:00", dateLabel: "Oct 3, 2026", timeLabel: "3:00 PM CT", homeAway: "home", venue: "Cub Stadium", status: "scheduled", source: BLINN_FOOTBALL_SOURCE },
] as const;

export const footballSeasons: Readonly<Record<string, SportsSeason>> = {
  "texas-am": { id: "texas-am-football-2026", sport: "football", teamId: "texas-am", label: "2026 schedule", conferenceLabel: "SEC", games: texasAmSchedule, source: TEXAS_AM_FOOTBALL_SOURCE },
  blinn: { id: "blinn-football-2026", sport: "football", teamId: "blinn", label: "2026 verified fixtures", conferenceLabel: "SWJCFC", games: blinnSchedule, source: BLINN_FOOTBALL_SOURCE },
};

export const featuredFootballTeamByUniversity: Readonly<Record<UniversityId, string>> = {
  tamu: "texas-am", blinn: "blinn", texas: "texas", lsu: "lsu", alabama: "alabama",
};

export function getFeaturedFootballTeamId(universityId: UniversityId | null) {
  return universityId ? featuredFootballTeamByUniversity[universityId] : null;
}

export function getFootballSeason(teamId: string): SportsSeason {
  const conference = getFootballConferenceForTeam(teamId);
  return footballSeasons[teamId] ?? {
    id: `${teamId}-football-2026`, sport: "football", teamId, label: "2026 schedule / results",
    conferenceLabel: conference?.label, games: [], source: conference?.source ?? FBS_STRUCTURE_SOURCE,
  };
}
