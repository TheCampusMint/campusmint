import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabasePublicConfig } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (hasSupabasePublicConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (token && user) {
      const { error } = await createSupabaseAdminClient().auth.admin.signOut(token, "local");
      if (error) return NextResponse.json({ ok: false }, { status: 503 });
    } else { await supabase.auth.signOut({ scope: "local" }); }
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
