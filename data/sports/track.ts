import type { UniversityId } from "@/data/universities";
import type { SportsDataSource, TrackProgram } from "@/data/sports/types";

const source: SportsDataSource = { sourceName: "Texas A&M Athletics 2026 track and field schedule", sourceUrl: "https://12thman.com/sports/track-and-field/schedule/2026", season: "2026 outdoor", verifiedAt: "2026-08-24" };
const official = (name: string, url: string): SportsDataSource => ({ sourceName: name, sourceUrl: url, season: "2026", verifiedAt: "2026-08-24" });

export const trackPrograms: readonly TrackProgram[] = [
  { id: "tamu-track-2026", teamId: "texas-am", label: "Track & field · 2026 outdoor", season: "2026 outdoor", source, meets: [
    { id: "tamu-track-sec", name: "SEC Outdoor Championships", dateLabel: "May 14–16, 2026", location: "Auburn, Alabama", status: "completed", source },
    { id: "tamu-track-west", name: "NCAA West First Round", dateLabel: "May 27–30, 2026", location: "Fayetteville, Arkansas", status: "completed", source },
    { id: "tamu-track-ncaa", name: "NCAA Outdoor Championships", dateLabel: "Jun 10–13, 2026", location: "Eugene, Oregon", status: "completed", source },
  ] },
  { id: "texas-track-2026", teamId: "texas", label: "Track & field · 2026", season: "2026", source: official("Texas Track & Field", "https://texaslonghorns.com/sports/track-and-field"), meets: [] },
  { id: "lsu-track-2026", teamId: "lsu", label: "Track & field · 2026", season: "2026", source: official("LSU Track & Field", "https://lsusports.net/sports/tf/"), meets: [] },
  { id: "alabama-track-2026", teamId: "alabama", label: "Track & field · 2026", season: "2026", source: official("Alabama Track & Field", "https://rolltide.com/sports/xctrack"), meets: [] },
];

export function getTrackProgram(universityId: UniversityId | null) {
  const teamId = universityId ? ({ tamu: "texas-am", texas: "texas", lsu: "lsu", alabama: "alabama", blinn: "blinn" } as const)[universityId] : "texas-am";
  return trackPrograms.find((program) => program.teamId === teamId) ?? null;
}
