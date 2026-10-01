import { readJsonObject } from "@/lib/security/requestBody";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabasePublicConfig, hasSupabaseServerConfig } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ mintId: string }> };

async function handle(request: Request, context: Context, voting: boolean) {
  if (!hasSupabasePublicConfig() || !hasSupabaseServerConfig()) return NextResponse.json({ ok: false, message: "Polls are temporarily unavailable." }, { status: 503, headers });
  const { mintId } = await context.params;
  if (!uuidPattern.test(mintId)) return NextResponse.json({ ok: false, message: "Poll unavailable." }, { status: 404, headers });
  try {
    const session = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) return NextResponse.json({ ok: false, message: "Sign in to use polls." }, { status: 401, headers });
    let optionId: string | null = null;
    if (voting) {
      const body = await readJsonObject(request).catch(() => null);
      if (!body || typeof body.optionId !== "string" || !/^[1-6]$/.test(body.optionId)) {
        return NextResponse.json({ ok: false, message: "Choose an available poll answer." }, { status: 400, headers });
      }
      optionId = body.optionId;
    }
    const admin = createSupabaseAdminClient();
    // The authenticated identity is set here, never accepted from the request.
    // Each RPC repeats the feed visibility checks inside the database.
    const { data, error } = voting
      ? await admin.rpc("vote_mint_poll", { target_content_id: mintId, viewer_id: user.id, selected_option_id: optionId })
      : await admin.rpc("read_mint_poll", { target_content_id: mintId, viewer_id: user.id });
    if (error) {
      const status = error.code === "P0002" ? 404 : error.code === "42501" ? 403 : error.code === "22023" ? 400 : 503;
      const message = status === 404 ? "Poll unavailable." : status === 403 ? "A verified Student or approved Creator profile is required to vote." : status === 400 ? "Choose an available poll answer." : "Couldn't update this poll. Try again.";
      return NextResponse.json({ ok: false, message }, { status, headers });
    }
    return NextResponse.json({ ok: true, poll: data }, { headers });
  } catch {
    return NextResponse.json({ ok: false, message: "Couldn't load this poll. Try again." }, { status: 503, headers });
  }
}

export async function GET(request: Request, context: Context) { return handle(request, context, false); }
export async function POST(request: Request, context: Context) { return handle(request, context, true); }
