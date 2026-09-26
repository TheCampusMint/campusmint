import { NextResponse } from "next/server";

import { createSupabaseServerClient, hasSupabasePublicConfig } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function context(params: Promise<{ channelId: string }>) {
  if (!hasSupabasePublicConfig()) return { error: NextResponse.json({ ok: false, message: "Brand Channels are not configured." }, { status: 503 }) };
  const { channelId } = await params;
  if (!uuid.test(channelId)) return { error: NextResponse.json({ ok: false, message: "Invalid Channel." }, { status: 400 }) };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.account_type !== "student") return { error: NextResponse.json({ ok: false, message: "Only a signed-in student can manage Channel membership." }, { status: 403 }) };
  const { data: channel } = await supabase.from("brand_channels").select("brand_id").eq("id", channelId).eq("status", "active").maybeSingle();
  if (!channel) return { error: NextResponse.json({ ok: false, message: "This Channel is unavailable." }, { status: 404 }) };
  const { data: brand } = await supabase.from("brand_profiles").select("verification_status").eq("id", channel.brand_id).maybeSingle();
  if (brand?.verification_status !== "verified") return { error: NextResponse.json({ ok: false, message: "This Channel is unavailable." }, { status: 404 }) };
  return { supabase, user, channelId };
}

export async function POST(_request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const resolved = await context(params);
  if ("error" in resolved) return resolved.error;
  const { error } = await resolved.supabase.from("brand_channel_memberships").upsert({ channel_id: resolved.channelId, user_id: resolved.user.id }, { onConflict: "channel_id,user_id" });
  if (error) return NextResponse.json({ ok: false, message: "We couldn't join that Channel." }, { status: 500 });
  return NextResponse.json({ ok: true, joined: true }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const resolved = await context(params);
  if ("error" in resolved) return resolved.error;
  const { error } = await resolved.supabase.from("brand_channel_memberships").delete().eq("channel_id", resolved.channelId).eq("user_id", resolved.user.id);
  if (error) return NextResponse.json({ ok: false, message: "We couldn't leave that Channel." }, { status: 500 });
  return NextResponse.json({ ok: true, joined: false }, { headers: { "Cache-Control": "private, no-store" } });
}
