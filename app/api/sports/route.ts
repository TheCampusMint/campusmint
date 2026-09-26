import { NextResponse } from "next/server";

import { configuredUniversityIds, type UniversityId } from "@/data/universities";
import { areDeveloperControlsEnabled } from "@/lib/runtime/fixturePolicy";
import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabasePublicConfig, hasSupabaseServerConfig } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasSupabasePublicConfig() || !hasSupabaseServerConfig()) return NextResponse.json({ ok: true, profile: null }, { headers: { "Cache-Control": "private, no-store" } });
  const requestedUniversityId = new URL(request.url).searchParams.get("universityId") as UniversityId | null;
  if (!requestedUniversityId || !configuredUniversityIds.includes(requestedUniversityId)) return NextResponse.json({ ok: false, message: "Invalid university." }, { status: 400 });
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user || user.app_metadata?.account_type !== "student") return NextResponse.json({ ok: false, message: "Sign in to view campus Sports." }, { status: 401 });
  const { data: identity } = await session.from("profile_identities").select("university_id").eq("user_id", user.id).maybeSingle();
  const admin = createSupabaseAdminClient();
  if (identity?.university_id !== requestedUniversityId) {
    const { data: testerCapability } = await admin.from("account_capabilities")
      .select("capability")
      .eq("user_id", user.id)
      .eq("capability", "owner_campus_tester")
      .is("revoked_at", null)
      .maybeSingle();
    if (!testerCapability && !areDeveloperControlsEnabled()) {
      return NextResponse.json({ ok: false, message: "Campus test access is required." }, { status: 403 });
    }
  }
  const { data, error } = await admin.from("sports_program_snapshots").select("payload,fetched_at,verified_at,stale_after").eq("university_id", requestedUniversityId).eq("dataset_key", "campus-athletics").maybeSingle();
  if (error) return NextResponse.json({ ok: false, message: "Sports data is temporarily unavailable." }, { status: 503 });
  return NextResponse.json({ ok: true, profile: data?.payload ?? null, freshness: data ? { fetchedAt: data.fetched_at, verifiedAt: data.verified_at, staleAfter: data.stale_after } : null }, { headers: { "Cache-Control": "private, no-store" } });
}
