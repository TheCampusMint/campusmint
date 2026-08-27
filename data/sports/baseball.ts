import type { UniversityId } from "@/data/universities";
import type { SportsDataSource, SportsSeason } from "@/data/sports/types";

const tamuSource: SportsDataSource = { sourceName: "Texas A&M Athletics 2026 baseball schedule", sourceUrl: "https://12thman.com/sports/baseball/schedule/2026", season: "2026", verifiedAt: "2026-08-24" };
const blinnSource: SportsDataSource = { sourceName: "Blinn College 2026 baseball schedule", sourceUrl: "https://buccaneersports.com/sports/baseball/schedule/2026", season: "2026", verifiedAt: "2026-08-24" };
const official = (name: string, url: string): SportsDataSource => ({ sourceName: name, sourceUrl: url, season: "2026", verifiedAt: "2026-08-24" });

export const baseballSeasons: readonly SportsSeason[] = [
  { id: "tamu-baseball-2026", sport: "baseball", teamId: "texas-am", label: "Baseball · 2026", record: "41–16 · 18–11 SEC", conferenceLabel: "SEC", source: tamuSource, games: [
    { id: "tamu-bsb-lamar", opponentId: "lamar", date: "2026-05-29", dateLabel: "May 29, 2026", homeAway: "neutral", venue: "NCAA Regional", status: "final", result: { outcome: "W", teamScore: 7, opponentScore: 5 }, scoringHighlight: "Gavin Grahovac homered and Chris Hacopian added a two-run home run in the comeback.", source: tamuSource },
    { id: "tamu-bsb-texas-state", opponentId: "texas-state", date: "2026-05-30", dateLabel: "May 30, 2026", homeAway: "neutral", venue: "NCAA Regional", status: "final", result: { outcome: "W", teamScore: 17, opponentScore: 2 }, source: tamuSource },
    { id: "tamu-bsb-usc-1", opponentId: "usc-baseball", date: "2026-05-31", dateLabel: "May 31, 2026", homeAway: "neutral", venue: "NCAA Regional", status: "final", result: { outcome: "L", teamScore: 3, opponentScore: 14 }, scoringHighlight: "Chris Hacopian and Gavin Grahovac hit solo home runs.", source: tamuSource },
    { id: "tamu-bsb-usc-2", opponentId: "usc-baseball", date: "2026-06-01", dateLabel: "Jun 1, 2026", homeAway: "neutral", venue: "NCAA Regional final", status: "final", result: { outcome: "L", teamScore: 1, opponentScore: 7 }, source: tamuSource },
  ] },
  { id: "blinn-baseball-2026", sport: "baseball", teamId: "blinn", label: "Baseball · 2026", record: "49–14", conferenceLabel: "NJCAA", source: blinnSource, games: [] },
  { id: "texas-baseball-2026", sport: "baseball", teamId: "texas", label: "Baseball · 2026", conferenceLabel: "SEC", source: official("Texas Baseball", "https://texaslonghorns.com/sports/baseball"), games: [] },
  { id: "lsu-baseball-2026", sport: "baseball", teamId: "lsu", label: "Baseball · 2026", conferenceLabel: "SEC", source: official("LSU Baseball", "https://lsusports.net/sports/bsb/"), games: [] },
  { id: "alabama-baseball-2026", sport: "baseball", teamId: "alabama", label: "Baseball · 2026", conferenceLabel: "SEC", source: official("Alabama Baseball", "https://rolltide.com/sports/baseball"), games: [] },
];

export function getBaseballSeason(universityId: UniversityId | null) { return baseballSeasons.find((season) => season.teamId === ({ tamu: "texas-am", blinn: "blinn", texas: "texas", lsu: "lsu", alabama: "alabama" } as const)[universityId ?? "tamu"]) ?? baseballSeasons[0]; }
