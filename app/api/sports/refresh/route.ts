import { NextResponse } from "next/server";

import { configuredUniversityIds, type UniversityId } from "@/data/universities";
import { createSupabaseAdminClient, hasSupabaseServerConfig } from "@/lib/supabase/server";
import { refreshCampusSports, type SportsSnapshot } from "@/lib/sports/refresh";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET ?? process.env.CAMPUS_DATA_SYNC_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return NextResponse.json({ ok: false }, { status: 401 });
  if (!hasSupabaseServerConfig()) return NextResponse.json({ ok: false, message: "Sports storage is not configured." }, { status: 503 });
  const { data, error } = await createSupabaseAdminClient().from("sports_program_snapshots").select("payload,fetched_at,verified_at,stale_after").eq("university_id", "tamu").eq("dataset_key", "campus-athletics").maybeSingle();
  if (error) return NextResponse.json({ ok: false, message: "Sports storage is unavailable." }, { status: 503 });
  try {
    const snapshot = await refreshCampusSports("tamu", data as SportsSnapshot | null, true);
    return NextResponse.json({ ok: true, universityId: "tamu", refreshedAt: snapshot?.fetched_at }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, message: "The official football schedule could not be refreshed. The previous verified snapshot was retained." }, { status: 502 });
  }
}

const record = (value: unknown): Record<string, unknown> | null => typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
const httpsUrl = (value: unknown) => typeof value === "string" && /^https:\/\//.test(value);

export async function POST(request: Request) {
  const expected = process.env.CAMPUS_DATA_SYNC_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return NextResponse.json({ ok: false }, { status: 401 });
  if (!hasSupabaseServerConfig()) return NextResponse.json({ ok: false, message: "Sports storage is not configured." }, { status: 503 });
  let input: unknown;
  try { input = await request.json(); } catch { input = null; }
  const envelope = record(input); const profile = record(envelope?.profile);
  const universityId = profile?.universityId as UniversityId | undefined;
  const programs = record(profile?.programs);
  if (!universityId || !configuredUniversityIds.includes(universityId) || !programs) return NextResponse.json({ ok: false, message: "Invalid Sports snapshot." }, { status: 400 });
  const normalizedPrograms = Object.values(programs).filter(Boolean).map(record);
  if (!normalizedPrograms.length || normalizedPrograms.some((program) => {
    const source = record(program?.source);
    return !source || !httpsUrl(source.sourceUrl) || typeof source.sourceName !== "string" || typeof source.season !== "string" || typeof source.verifiedAt !== "string" || !Array.isArray(program?.games);
  })) return NextResponse.json({ ok: false, message: "Every Sports program needs a verified HTTPS source and game array." }, { status: 400 });
  const fetchedAt = typeof envelope?.fetchedAt === "string" && Number.isFinite(new Date(envelope.fetchedAt).getTime()) ? envelope.fetchedAt : null;
  const verifiedAt = typeof envelope?.verifiedAt === "string" && Number.isFinite(new Date(envelope.verifiedAt).getTime()) ? envelope.verifiedAt : null;
  if (!fetchedAt || !verifiedAt) return NextResponse.json({ ok: false, message: "Sports snapshot freshness is required." }, { status: 400 });
  const firstSource = record(normalizedPrograms[0]?.source)!;
  const staleAfter = typeof envelope?.staleAfter === "string" && Number.isFinite(new Date(envelope.staleAfter).getTime()) ? envelope.staleAfter : null;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("sports_program_snapshots").upsert({ university_id: universityId, dataset_key: "campus-athletics", payload: profile, source_name: firstSource.sourceName, source_url: firstSource.sourceUrl, season: firstSource.season, fetched_at: fetchedAt, verified_at: verifiedAt, stale_after: staleAfter }, { onConflict: "university_id,dataset_key" });
  if (error) return NextResponse.json({ ok: false, message: "Sports snapshot could not be stored." }, { status: 500 });
  return NextResponse.json({ ok: true, universityId, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
