import { NextResponse } from "next/server";
import { validCronSecret } from "@/lib/security/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
  if (!validCronSecret(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createSupabaseAdminClient();
  const results = await Promise.all([admin.rpc("prune_security_records"), admin.rpc("prune_native_challenges")]);
  const error = results.some(result => result.error);
  return NextResponse.json({ ok: !error }, { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
