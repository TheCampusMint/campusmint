import { getCampusAthleticsProfile, getCampusProgramCatalog, type CampusAthleticsProfile } from "../../data/sports/campus.ts";
import type { UniversityId } from "../../data/universities.ts";
import { createSupabaseAdminClient } from "../supabase/server";
import { FOOTBALL_REFRESH_INTERVAL_MS, officialFootballUrl, parseOfficialFootballSchedule, updateOfficialFootballProgram } from "./officialFootball.ts";
import { parseOfficialSchedule } from "./officialSchedule.ts";

export type SportsSnapshot = { payload: CampusAthleticsProfile; fetched_at: string; verified_at: string; stale_after: string | null };
const inFlight = new Map<string, Promise<SportsSnapshot>>();
const retryAfter = new Map<string, number>();

export function sportsSnapshotNeedsRefresh(snapshot: SportsSnapshot | null, now = Date.now()) {
  const fetched = Date.parse(snapshot?.fetched_at ?? "");
  return !Number.isFinite(fetched) || now - fetched >= FOOTBALL_REFRESH_INTERVAL_MS;
}

export function mergeCampusSports(universityId: UniversityId, snapshot: SportsSnapshot | null): CampusAthleticsProfile {
  const configured = getCampusAthleticsProfile(universityId)!;
  if (snapshot?.payload.universityId !== universityId) return configured;
  return { ...configured, programs: Object.fromEntries(getCampusProgramCatalog(configured).map((program) => {
    const saved = snapshot.payload.programs[program.sport];
    return [program.sport, saved?.source.lastFetchedAt ? { ...saved, label: program.label, source: { ...saved.source, sourceUrl: program.source.sourceUrl } } : program];
  })), rankingBoards: snapshot.payload.rankingBoards };
}

/** Refresh each configured official schedule independently, preserving last verified data on failures. */
export async function refreshCampusSports(universityId: UniversityId, snapshot: SportsSnapshot | null, force = false): Promise<SportsSnapshot | null> {
  if (!force && !sportsSnapshotNeedsRefresh(snapshot)) return snapshot;
  const running = inFlight.get(universityId);
  if (running) return running;
  if (!force && (retryAfter.get(universityId) ?? 0) > Date.now()) return snapshot;
  retryAfter.set(universityId, Date.now() + 60_000);
  const operation = (async () => {
    const now = new Date();
    const season = String(now.getUTCFullYear() - (now.getUTCMonth() === 0 ? 1 : 0));
    const base = mergeCampusSports(universityId, snapshot);
    const results = await Promise.allSettled(getCampusProgramCatalog(base).map(async (program) => {
      const isTamuFootball = universityId === "tamu" && program.sport === "football";
      const response = await fetch(isTamuFootball ? officialFootballUrl(season) : program.source.sourceUrl, { cache: "no-store", signal: AbortSignal.timeout(12_000), headers: { Accept: "text/html" } });
      if (!response.ok) throw new Error("Official schedule unavailable.");
      const html = await response.text();
      if (html.length > 3_000_000) throw new Error("Official schedule response was too large.");
      return isTamuFootball ? updateOfficialFootballProgram(program, parseOfficialFootballSchedule(html, season, now), season, now)
        : parseOfficialSchedule(html, universityId, program, now);
    }));
    const updated = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    if (!updated.length) throw new Error("Official schedules could not be refreshed.");
    const next: SportsSnapshot = { payload: { ...base, programs: { ...base.programs, ...Object.fromEntries(updated.map((program) => [program.sport, program])) } }, fetched_at: now.toISOString(), verified_at: now.toISOString(), stale_after: new Date(now.getTime() + FOOTBALL_REFRESH_INTERVAL_MS).toISOString() };
    const { error } = await createSupabaseAdminClient().from("sports_program_snapshots").upsert({ university_id: universityId, dataset_key: "campus-athletics", ...next,
      source_name: base.featuredSportsSource.sourceName, source_url: base.featuredSportsSource.sourceUrl, season }, { onConflict: "university_id,dataset_key" });
    if (error) throw new Error("The refreshed sports snapshot could not be stored.");
    return next;
  })();
  inFlight.set(universityId, operation);
  try { return await operation; } finally { inFlight.delete(universityId); }
}
