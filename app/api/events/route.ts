import { NextResponse } from "next/server";

import { universities, type UniversityId } from "@/data/universities";
import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabasePublicConfig } from "@/lib/supabase/server";
import { areDeveloperControlsEnabled } from "@/lib/runtime/fixturePolicy";
import { eventCategories, type Event, type EventCategory } from "@/types/event";

export const dynamic = "force-dynamic";

function category(value: unknown): EventCategory {
  return eventCategories.includes(value as EventCategory) ? value as EventCategory : "Social";
}

function sourceType(value: string): NonNullable<Event["source"]>["sourceType"] {
  return value === "organization" ? "student_organization" :
    ["university", "city", "tourism", "venue", "brand", "student", "trusted_public"].includes(value)
      ? value as NonNullable<Event["source"]>["sourceType"]
      : "trusted_public";
}

export async function GET(request: Request) {
  if (!hasSupabasePublicConfig()) return NextResponse.json({ ok: true, events: [] }, { headers: { "Cache-Control": "private, no-store" } });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: "Sign in to view campus events." }, { status: 401 });
    const { data: identity } = await supabase.from("profile_identities").select("university_id").eq("user_id", user.id).maybeSingle();
    const identityCampus = identity?.university_id as UniversityId | undefined;
    if (!identityCampus || !universities[identityCampus]) return NextResponse.json({ ok: true, events: [] }, { headers: { "Cache-Control": "private, no-store" } });
    const requestedCampus = new URL(request.url).searchParams.get("universityId") as UniversityId | null;
    let campus = identityCampus;
    if (requestedCampus && requestedCampus !== identityCampus) {
      if (!universities[requestedCampus]) {
        return NextResponse.json({ ok: false, message: "Unknown campus context." }, { status: 400 });
      }
      const { data: testerCapability } = await supabase
        .from("account_capabilities")
        .select("capability")
        .eq("user_id", user.id)
        .eq("capability", "owner_campus_tester")
        .is("revoked_at", null)
        .maybeSingle();
      if (!testerCapability && !areDeveloperControlsEnabled()) {
        return NextResponse.json({ ok: false, message: "Campus test access is required." }, { status: 403 });
      }
      campus = requestedCampus;
    }
    const accessible = universities[campus].accessibleCampuses;
    const { data, error } = await createSupabaseAdminClient().from("campus_events").select("id,title,brief_description,campus_id,category,timezone,starts_at,ends_at,location_name,address,city,latitude,longitude,organizer,audience,status,is_campus_mint_system_post,author_brand_id,author_user_id,source_kind,distance_from_campus_miles,source_name,source_url,source_event_id,source_updated_at,ingested_at,verified_at,image_url")
      .in("campus_id", accessible).in("status", ["scheduled", "updated"])
      .or(`ends_at.gt.${new Date().toISOString()},and(ends_at.is.null,starts_at.gt.${new Date().toISOString()})`)
      .order("starts_at", { ascending: true }).limit(250);
    if (error) throw error;
    const events: Event[] = (data ?? []).map((row) => {
      const timeZone = row.timezone || universities[row.campus_id as UniversityId]?.timeZone || "UTC";
      const start = new Date(row.starts_at);
      return {
        id: row.id, title: row.title, description: row.brief_description ?? "", campus: row.campus_id,
        category: category(row.category), date: new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(start),
        time: new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(start),
        eventStartAt: row.starts_at, ...(row.ends_at ? { eventEndAt: row.ends_at } : {}), timeZone,
        location: row.location_name, address: row.address, city: row.city,
        latitude: row.latitude === null ? null : Number(row.latitude), longitude: row.longitude === null ? null : Number(row.longitude),
        organizer: row.organizer, audience: row.audience ?? "Campus community", rsvpCount: 0,
        status: row.status, systemGenerated: row.is_campus_mint_system_post,
        authorBrandId: row.author_brand_id, authorUserId: row.author_user_id,
        sourceTrust: row.source_kind === "brand" ? "authenticated_organizer" : "verified_source",
        distanceFromCampusMiles: row.distance_from_campus_miles === null ? null : Number(row.distance_from_campus_miles),
        source: { sourceTitle: row.source_name, sourceUrl: row.source_url ?? "", sourceType: sourceType(row.source_kind), sourceEventId: row.source_event_id, sourceUpdatedAt: row.source_updated_at, ingestedAt: row.ingested_at, verifiedAt: row.verified_at, officialImageUrl: row.image_url },
      };
    });
    return NextResponse.json({ ok: true, events }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ ok: false, message: "Events are temporarily unavailable." }, { status: 503 });
  }
}
