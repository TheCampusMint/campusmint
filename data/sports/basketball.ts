import type { UniversityId } from "@/data/universities";
import type { SportsDataSource, SportsSeason } from "@/data/sports/types";

const source: SportsDataSource = { sourceName: "Texas A&M Athletics 2025-26 men's basketball schedule and NCAA recaps", sourceUrl: "https://12thman.com/sports/mens-basketball/schedule/2025-26", season: "2025-26", verifiedAt: "2026-08-24" };
const official = (name: string, url: string): SportsDataSource => ({ sourceName: name, sourceUrl: url, season: "2025-26", verifiedAt: "2026-08-24" });

export const basketballSeasons: readonly SportsSeason[] = [
  { id: "tamu-mbb-2025-26", sport: "basketball", teamId: "texas-am", label: "Men's basketball · 2025-26", record: "22–12 · 11–7 SEC", conferenceLabel: "SEC", source, games: [
    { id: "tamu-mbb-saint-marys", opponentId: "saint-marys", date: "2026-03-20", dateLabel: "Mar 20, 2026", homeAway: "neutral", venue: "NCAA First Round", status: "final", result: { outcome: "W", teamScore: 63, opponentScore: 50 }, scoringHighlight: "Rashaun Agee scored 22 points.", source },
    { id: "tamu-mbb-houston", opponentId: "tamu-houston", date: "2026-03-22", dateLabel: "Mar 22, 2026", homeAway: "neutral", venue: "NCAA Second Round", status: "final", result: { outcome: "L", teamScore: 57, opponentScore: 88 }, source },
  ] },
  { id: "blinn-mbb-2025-26", sport: "basketball", teamId: "blinn", label: "Men's basketball · 2025-26", conferenceLabel: "Region XIV", source: official("Blinn College men's basketball", "https://buccaneersports.com/sports/mens-basketball"), games: [] },
  { id: "texas-mbb-2025-26", sport: "basketball", teamId: "texas", label: "Men's basketball · 2025-26", conferenceLabel: "SEC", source: official("Texas Athletics men's basketball", "https://texaslonghorns.com/sports/mens-basketball"), games: [] },
  { id: "lsu-mbb-2025-26", sport: "basketball", teamId: "lsu", label: "Men's basketball · 2025-26", conferenceLabel: "SEC", source: official("LSU men's basketball", "https://lsusports.net/sports/mb/"), games: [] },
  { id: "alabama-mbb-2025-26", sport: "basketball", teamId: "alabama", label: "Men's basketball · 2025-26", conferenceLabel: "SEC", source: official("Alabama men's basketball", "https://rolltide.com/sports/mens-basketball"), games: [] },
];

export function getBasketballSeason(universityId: UniversityId | null) { return basketballSeasons.find((season) => season.teamId === ({ tamu: "texas-am", blinn: "blinn", texas: "texas", lsu: "lsu", alabama: "alabama" } as const)[universityId ?? "tamu"]) ?? basketballSeasons[0]; }
