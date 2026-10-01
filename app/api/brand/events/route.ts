import { readJsonBody } from "@/lib/security/requestBody";
import { NextResponse } from "next/server";

import { universities, type UniversityId } from "@/data/universities";
import { parseBrandEventSubmission, normalizeBrandEventTitle } from "@/lib/events/brandEventSubmission";
import { distanceMiles } from "@/lib/events/geography";
import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabasePublicConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasSupabasePublicConfig()) return NextResponse.json({ ok: false, message: "Brand events are not configured." }, { status: 503 });
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.account_type !== "brand") {
    return NextResponse.json({ ok: false, message: "Only an authenticated Brand account can publish this event." }, { status: 403 });
  }
  let body: unknown;
  try { body = await readJsonBody(request); } catch { body = null; }
  const parsed = parseBrandEventSubmission(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
  const value = parsed.value;
  const campus = universities[value.campusId as UniversityId];
  if (!campus) return NextResponse.json({ ok: false, message: "Choose a configured Campus Mint university." }, { status: 400 });
  const distance = distanceMiles(
    { latitude: campus.campusLatitude, longitude: campus.campusLongitude },
    { latitude: value.latitude, longitude: value.longitude },
  );
  if (distance > campus.eventDiscoveryRadiusMiles) {
    return NextResponse.json({ ok: false, message: `This venue is outside the ${campus.eventDiscoveryRadiusMiles}-mile ${campus.shortName} event area.` }, { status: 400 });
  }
  const { data: brand } = await supabase.from("brand_profiles")
    .select("id,display_name,website_url,verification_status,suspended_at").eq("user_id", user.id).maybeSingle();
  if (!brand) return NextResponse.json({ ok: false, message: "Finish your Brand profile first." }, { status: 409 });
  if (brand.verification_status !== "verified" || brand.suspended_at) {
    return NextResponse.json({ ok: false, message: "Brand approval is required before publishing events." }, { status: 403 });
  }

  const start = new Date(value.startsAt);
  const windowStart = new Date(start.getTime() - 30 * 60_000).toISOString();
  const windowEnd = new Date(start.getTime() + 30 * 60_000).toISOString();
  const normalizedTitle = normalizeBrandEventTitle(value.title);
  const { data: candidates, error: candidateError } = await createSupabaseAdminClient().from("campus_events")
    .select("id,normalized_title,location_name,starts_at")
    .eq("campus_id", value.campusId).gte("starts_at", windowStart).lte("starts_at", windowEnd);
  if (candidateError) return NextResponse.json({ ok: false, message: "Events are temporarily unavailable." }, { status: 503 });
  const normalizedLocation = normalizeBrandEventTitle(value.location);
  const duplicate = (candidates ?? []).find((candidate) =>
    candidate.normalized_title === normalizedTitle &&
    normalizeBrandEventTitle(candidate.location_name) === normalizedLocation,
  );
  if (duplicate) {
    return NextResponse.json({ ok: false, message: "This event already exists.", existingEventId: duplicate.id }, { status: 409 });
  }

  const { data: event, error } = await createSupabaseAdminClient().from("campus_events").insert({
    campus_id: value.campusId,
    title: value.title,
    normalized_title: normalizedTitle,
    brief_description: value.description,
    starts_at: value.startsAt,
    ends_at: value.endsAt,
    timezone: campus.timeZone,
    location_name: value.location,
    address: value.address,
    city: value.city,
    latitude: value.latitude,
    longitude: value.longitude,
    organizer: brand.display_name,
    category: value.category,
    audience: "Campus community",
    source_kind: "brand",
    source_name: brand.display_name,
    source_url: brand.website_url,
    verified_at: new Date().toISOString(),
    status: "scheduled",
    author_brand_id: brand.id,
    author_user_id: user.id,
    is_campus_mint_system_post: false,
    distance_from_campus_miles: Number(distance.toFixed(3)),
  }).select("id,title,starts_at").single();
  if (error || !event) return NextResponse.json({ ok: false, message: "We couldn't publish that event." }, { status: 500 });
  return NextResponse.json({ ok: true, event }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
