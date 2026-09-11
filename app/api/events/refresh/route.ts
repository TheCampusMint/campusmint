import { NextResponse } from "next/server";

import { universities } from "@/data/universities";
import { getEventDistanceFromCampus, isEventInsideCampusRadius } from "@/lib/events/geography";
import { getAutomatedEventSourceAdapters } from "@/lib/events/providers/registry";
import { findEquivalentEvent, type DiscoveredEvent } from "@/lib/events/systemEventIngestion";
import { createSupabaseAdminClient, hasSupabaseServerConfig } from "@/lib/supabase/server";
import type { Event } from "@/types/event";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET ?? process.env.CAMPUS_DATA_SYNC_SECRET;
  return Boolean(expected && request.headers.get("authorization") === `Bearer ${expected}`);
}
const normalizedTitle = (title: string) => title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function databaseEvent(event: DiscoveredEvent) {
  return {
    campus_id: event.campus, title: event.title, normalized_title: normalizedTitle(event.title), brief_description: event.description || null,
    starts_at: event.eventStartAt, ends_at: event.eventEndAt ?? null, timezone: event.timeZone, location_name: event.location,
    address: event.address ?? null, city: event.city ?? null, latitude: event.latitude ?? null, longitude: event.longitude ?? null,
    organizer: event.organizer ?? null, category: event.category, audience: event.audience, source_kind: event.source?.sourceType === "university" ? "university" : "trusted_public",
    source_name: event.source?.sourceTitle ?? "Unknown", source_url: event.source?.sourceUrl ?? null, source_event_id: event.source?.sourceEventId ?? null,
    source_updated_at: event.source?.sourceUpdatedAt ?? null, ingested_at: event.source?.ingestedAt ?? new Date().toISOString(), verified_at: event.source?.verifiedAt ?? new Date().toISOString(),
    status: event.status ?? "scheduled", image_url: event.source?.officialImageUrl ?? null, is_campus_mint_system_post: true,
    distance_from_campus_miles: getEventDistanceFromCampus(event, universities[event.campus as keyof typeof universities]),
  };
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!hasSupabaseServerConfig()) return NextResponse.json({ ok: false, message: "Event storage is not configured." }, { status: 503 });
  const now = new Date(); const end = new Date(now.getTime() + 120 * 86_400_000); const admin = createSupabaseAdminClient();
  const report: Array<{ adapter: string; fetched: number; accepted: number; error?: string }> = [];
  for (const adapter of getAutomatedEventSourceAdapters()) {
    try {
      const campus = universities[adapter.campusId as keyof typeof universities];
      const fetched = await adapter.fetchEvents({ startsAt: now, endsAt: end });
      const eligible = fetched.filter((event) => event.source && event.status !== "cancelled" && isEventInsideCampusRadius(event, campus));
      const { data: brandRows } = await admin.from("campus_events")
        .select("id,campus_id,title,brief_description,starts_at,ends_at,timezone,location_name,address,city,latitude,longitude,organizer,category,audience,source_name,source_url,source_event_id,verified_at,status,author_brand_id,author_user_id")
        .eq("campus_id", adapter.campusId).eq("source_kind", "brand")
        .gte("starts_at", now.toISOString()).lte("starts_at", end.toISOString());
      const brandEvents: Event[] = (brandRows ?? []).map((row) => ({
        id: row.id, campus: row.campus_id, title: row.title, description: row.brief_description ?? "",
        eventStartAt: row.starts_at, ...(row.ends_at ? { eventEndAt: row.ends_at } : {}), timeZone: row.timezone,
        date: row.starts_at, time: row.starts_at, location: row.location_name, address: row.address, city: row.city,
        latitude: row.latitude === null ? null : Number(row.latitude), longitude: row.longitude === null ? null : Number(row.longitude),
        organizer: row.organizer, category: row.category, audience: row.audience ?? "Campus community", rsvpCount: 0,
        status: row.status, authorBrandId: row.author_brand_id, authorUserId: row.author_user_id, systemGenerated: false,
        sourceTrust: "authenticated_organizer", source: { sourceTitle: row.source_name, sourceUrl: row.source_url ?? "", sourceType: "brand", sourceEventId: row.source_event_id, verifiedAt: row.verified_at },
      }));
      const accepted = eligible.filter((event) => !findEquivalentEvent(event, brandEvents));
      if (accepted.length) {
        const { error } = await admin.from("campus_events").upsert(accepted.map(databaseEvent), { onConflict: "source_kind,source_event_id" });
        if (error) throw error;
      }
      report.push({ adapter: adapter.id, fetched: fetched.length, accepted: accepted.length });
    } catch (error) {
      report.push({ adapter: adapter.id, fetched: 0, accepted: 0, error: error instanceof Error ? error.message : "Refresh failed" });
    }
  }
  return NextResponse.json({ ok: report.every((entry) => !entry.error), refreshedAt: now.toISOString(), report }, { headers: { "Cache-Control": "no-store" } });
}
