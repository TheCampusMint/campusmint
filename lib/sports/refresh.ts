import { getCampusAthleticsProfile, type CampusAthleticsProfile } from "../../data/sports/campus.ts";
import type { UniversityId } from "../../data/universities.ts";
import { createSupabaseAdminClient } from "../supabase/server";
import { FOOTBALL_REFRESH_INTERVAL_MS, officialFootballUrl, parseOfficialFootballSchedule, updateOfficialFootballProgram } from "./officialFootball.ts";

export type SportsSnapshot = { payload: CampusAthleticsProfile; fetched_at: string; verified_at: string; stale_after: string | null };
const inFlight = new Map<string, Promise<SportsSnapshot>>();
const retryAfter = new Map<string, number>();

export function sportsSnapshotNeedsRefresh(snapshot: SportsSnapshot | null, now = Date.now()) {
  const fetched = Date.parse(snapshot?.payload.programs.football?.source.lastFetchedAt ?? "");
  return !Number.isFinite(fetched) || now - fetched >= FOOTBALL_REFRESH_INTERVAL_MS;
}

/** Only football is refreshed here; other programs/polls retain their own provenance. */
export async function refreshCampusSports(universityId: UniversityId, snapshot: SportsSnapshot | null, force = false): Promise<SportsSnapshot | null> {
  if (universityId !== "tamu" || (!force && !sportsSnapshotNeedsRefresh(snapshot))) return snapshot;
  const running = inFlight.get(universityId);
  if (running) return running;
  if (!force && (retryAfter.get(universityId) ?? 0) > Date.now()) return snapshot;
  retryAfter.set(universityId, Date.now() + 60_000);
  const operation = (async () => {
    const now = new Date();
    const season = String(now.getUTCFullYear());
    const response = await fetch(officialFootballUrl(season), { cache: "no-store", signal: AbortSignal.timeout(12_000), headers: { Accept: "text/html" } });
    if (!response.ok) throw new Error(`Official football schedule returned ${response.status}.`);
    const html = await response.text();
    if (html.length > 2_000_000) throw new Error("Official football schedule response was too large.");
    const base = snapshot?.payload ?? getCampusAthleticsProfile(universityId);
    if (!base?.programs.football) throw new Error("Football program is not configured.");
    const football = updateOfficialFootballProgram(base.programs.football, parseOfficialFootballSchedule(html, season, now), season, now);
    const next: SportsSnapshot = { payload: { ...base, programs: { ...base.programs, football } }, fetched_at: now.toISOString(), verified_at: now.toISOString(), stale_after: football.source.staleAfter! };
    const { error } = await createSupabaseAdminClient().from("sports_program_snapshots").upsert({ university_id: universityId, dataset_key: "campus-athletics", ...next,
      source_name: football.source.sourceName, source_url: football.source.sourceUrl, season }, { onConflict: "university_id,dataset_key" });
    if (error) throw new Error("The refreshed sports snapshot could not be stored.");
    return next;
  })();
  inFlight.set(universityId, operation);
  try { return await operation; } finally { inFlight.delete(universityId); }
}
