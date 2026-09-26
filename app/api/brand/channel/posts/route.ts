import { NextResponse } from "next/server";

import { createSupabaseServerClient, hasSupabasePublicConfig } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!hasSupabasePublicConfig()) return NextResponse.json({ ok: false, message: "Brand publishing is not configured." }, { status: 503 });
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.account_type !== "brand") return NextResponse.json({ ok: false, message: "This account cannot publish Brand content." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const postBody = body && typeof body === "object" && "body" in body && typeof body.body === "string" ? body.body.trim().slice(0, 10_000) : "";
  if (!postBody) return NextResponse.json({ ok: false, message: "Write something before publishing." }, { status: 400 });
  const { data: brand } = await supabase.from("brand_profiles").select("id,verification_status").eq("user_id", user.id).maybeSingle();
  if (!brand) return NextResponse.json({ ok: false, message: "Finish your Brand profile first." }, { status: 409 });
  if (brand.verification_status !== "verified") return NextResponse.json({ ok: false, message: "Brand approval is required before publishing." }, { status: 403 });
  const { data: channel } = await supabase.from("brand_channels").select("id").eq("brand_id", brand.id).eq("status", "active").maybeSingle();
  if (!channel) return NextResponse.json({ ok: false, message: "Your Brand Channel is unavailable." }, { status: 409 });
  const { data: post, error } = await supabase.from("brand_channel_posts").insert({ channel_id: channel.id, author_user_id: user.id, body: postBody }).select("id,body,created_at").single();
  if (error || !post) return NextResponse.json({ ok: false, message: "We couldn't publish that Channel post." }, { status: 500 });
  return NextResponse.json({ ok: true, post }, { headers: { "Cache-Control": "private, no-store" } });
}
