import { NextResponse } from "next/server";
import { universities, type UniversityId } from "@/data/universities";
import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Small campus-scoped context catalog. Attaching a club never grants publishing authority. */
export async function GET() {
  if (!hasSupabaseServerConfig()) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const client = await createSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const admin = createSupabaseAdminClient();
    const identity = await admin.from("profile_identities").select("university_id").eq("user_id", user.id).maybeSingle();
    if (identity.error) throw identity.error;
    const campus = identity.data?.university_id as UniversityId | undefined;
    const headers = { "Cache-Control": "private, no-store" };
    if (!campus || !universities[campus]) return NextResponse.json({ ok: true, clubs: [], events: [] }, { headers });
    const [clubs, roles, events, memberships] = await Promise.all([
      admin.from("organizations").select("id,name").eq("university_id", campus).eq("status", "active").eq("is_development", false)
        .or("user_created.eq.true,and(official_status.in.(university_verified,community_verified),confidence_level.in.(official,community_verified))").order("name").limit(500),
      admin.from("organization_roles").select("organization_id").eq("user_id", user.id).eq("can_publish", true),
      admin.from("campus_events").select("id,title,starts_at,location_name").in("campus_id", universities[campus].accessibleCampuses)
        .in("status", ["scheduled", "updated"])
        .or(`ends_at.gt.${new Date().toISOString()},and(ends_at.is.null,starts_at.gt.${new Date().toISOString()})`)
        .order("starts_at").limit(250),
      admin.from("organization_memberships").select("organization_id").eq("user_id", user.id).in("status", ["member", "officer", "leader"]),
    ]);
    if (clubs.error || roles.error || events.error || memberships.error) throw clubs.error ?? roles.error ?? events.error ?? memberships.error;
    const joined = new Set((memberships.data ?? []).map((row) => row.organization_id));
    const publishable = new Set((roles.data ?? []).map((row) => row.organization_id));
    return NextResponse.json({ ok: true,
      clubs: (clubs.data ?? []).filter((row) => joined.has(row.id)).map((row) => ({ id: row.id, name: row.name, canPublish: publishable.has(row.id) })),
      events: (events.data ?? []).map((row) => ({ id: row.id, title: row.title, startAt: row.starts_at, location: row.location_name })),
    }, { headers });
  } catch { return NextResponse.json({ ok: false, message: "Club and event choices are temporarily unavailable." }, { status: 503 }); }
}
