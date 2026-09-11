import { NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabasePublicConfig } from "@/lib/supabase/server";

export async function POST() {
  if (hasSupabasePublicConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
