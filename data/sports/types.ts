import type { UniversityId } from "@/data/universities";

export type SportsDataSource = {
  sourceName: string;
  sourceUrl: string;
  season: string;
  verifiedAt: string;
};

export type SportsTeamIdentity = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  universityId?: UniversityId;
  footballConferenceId?: string;
  logoUrl?: string;
  colors?: { primary: string; secondary: string };
};

export type SportsGameResult = {
  outcome: "W" | "L" | "T";
  teamScore: number;
  opponentScore: number;
};

export type SportsGame = {
  id: string;
  opponentId: string;
  date: string;
  dateLabel: string;
  timeLabel?: string;
  homeAway: "home" | "away" | "neutral";
  venue?: string;
  network?: string;
  status: "scheduled" | "final" | "verification_pending";
  result?: SportsGameResult;
  scoringHighlight?: string;
  source: SportsDataSource;
};

export type SportsSeason = {
  id: string;
  sport: "football" | "basketball" | "baseball" | "soccer";
  teamId: string;
  label: string;
  record?: string;
  conferenceLabel?: string;
  disciplineLabel?: string;
  games: readonly SportsGame[];
  source: SportsDataSource;
};

export type TrackMeet = {
  id: string;
  name: string;
  dateLabel: string;
  location: string;
  status: "scheduled" | "completed";
  resultNote?: string;
  source: SportsDataSource;
};

export type TrackProgram = {
  id: string;
  teamId: string;
  label: string;
  season: string;
  meets: readonly TrackMeet[];
  source: SportsDataSource;
};
