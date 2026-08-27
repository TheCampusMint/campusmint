import type { UniversityId } from "@/data/universities";
import type { SportsDataSource, SportsSeason } from "@/data/sports/types";

const source: SportsDataSource = { sourceName: "Texas A&M Athletics 2026 women's soccer schedule", sourceUrl: "https://12thman.com/sports/womens-soccer/schedule/2026", season: "2026", verifiedAt: "2026-08-24" };
const official = (name: string, url: string): SportsDataSource => ({ sourceName: name, sourceUrl: url, season: "2026", verifiedAt: "2026-08-24" });

export const soccerSeasons: readonly SportsSeason[] = [
  { id: "tamu-wsoc-2026", sport: "soccer", teamId: "texas-am", label: "Women's soccer · 2026", record: "2–2", conferenceLabel: "SEC", disciplineLabel: "Women", source, games: [
    { id: "tamu-wsoc-rice", opponentId: "rice", date: "2026-08-12", dateLabel: "Aug 12, 2026", homeAway: "away", status: "final", result: { outcome: "W", teamScore: 2, opponentScore: 1 }, source },
    { id: "tamu-wsoc-baylor", opponentId: "baylor", date: "2026-08-16", dateLabel: "Aug 16, 2026", homeAway: "away", status: "final", result: { outcome: "L", teamScore: 1, opponentScore: 2 }, source },
    { id: "tamu-wsoc-texas-state", opponentId: "texas-state", date: "2026-08-19", dateLabel: "Aug 19, 2026", homeAway: "away", status: "final", result: { outcome: "L", teamScore: 2, opponentScore: 3 }, source },
    { id: "tamu-wsoc-sam-houston", opponentId: "sam-houston", date: "2026-08-22", dateLabel: "Aug 22, 2026", homeAway: "home", status: "final", result: { outcome: "W", teamScore: 5, opponentScore: 0 }, scoringHighlight: "Kennedy Churchill and Izzy Buchanan each recorded two goals and an assist.", source },
    { id: "tamu-wsoc-air-force", opponentId: "air-force", date: "2026-08-27T19:00:00-05:00", dateLabel: "Aug 27, 2026", timeLabel: "7:00 PM CT", homeAway: "home", venue: "Ellis Field", status: "scheduled", source },
    { id: "tamu-wsoc-tcu", opponentId: "tcu", date: "2026-09-03T19:00:00-05:00", dateLabel: "Sep 3, 2026", timeLabel: "7:00 PM CT", homeAway: "home", venue: "Ellis Field", status: "scheduled", source },
  ] },
  { id: "blinn-wsoc-2026", sport: "soccer", teamId: "blinn", label: "Women's soccer · 2026", conferenceLabel: "NJCAA", disciplineLabel: "Women", source: official("Blinn College women's soccer", "https://buccaneersports.com/sports/womens-soccer/schedule/2026"), games: [] },
  { id: "texas-wsoc-2026", sport: "soccer", teamId: "texas", label: "Women's soccer · 2026", conferenceLabel: "SEC", disciplineLabel: "Women", source: official("Texas Soccer", "https://texaslonghorns.com/sports/womens-soccer"), games: [] },
  { id: "lsu-wsoc-2026", sport: "soccer", teamId: "lsu", label: "Women's soccer · 2026", conferenceLabel: "SEC", disciplineLabel: "Women", source: official("LSU Soccer", "https://lsusports.net/sports/sc/"), games: [] },
  { id: "alabama-wsoc-2026", sport: "soccer", teamId: "alabama", label: "Women's soccer · 2026", conferenceLabel: "SEC", disciplineLabel: "Women", source: official("Alabama Soccer", "https://rolltide.com/sports/womens-soccer"), games: [] },
];

export function getSoccerSeason(universityId: UniversityId | null) { return soccerSeasons.find((season) => season.teamId === ({ tamu: "texas-am", blinn: "blinn", texas: "texas", lsu: "lsu", alabama: "alabama" } as const)[universityId ?? "tamu"]) ?? soccerSeasons[0]; }
