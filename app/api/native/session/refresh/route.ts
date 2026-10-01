import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { readJsonObject } from "@/lib/security/requestBody";
import { consumeRateLimit } from "@/lib/security/server";
import { recordNativeSession } from "@/lib/security/nativeSession";

export const runtime = "nodejs";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request, 4096);
    if (typeof body.refreshToken !== "string" || body.refreshToken.length < 10 || body.refreshToken.length > 2048) return json({ ok: false, message: "Invalid session." }, 400);
    const budget = await consumeRateLimit("session.token.refresh", body.refreshToken, 10, 60);
    if (!budget.allowed) return json({ ok: false, message: "Please wait." }, 429);
    const config = getSupabasePublicConfig();
    if (!config) return json({ ok: false, message: "Sign-in unavailable." }, 503);
    const client = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await client.auth.refreshSession({ refresh_token: body.refreshToken });
    if (error || !data.session) return json({ ok: false, message: "Sign in again." }, 401);
    const verified = await client.auth.getUser(data.session.access_token);
    if (verified.error || verified.data.user?.id !== data.session.user.id) return json({ ok: false, message: "Sign in again." }, 401);
    await recordNativeSession(client, data.session);
    return json({ ok: true, session: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at, userId: verified.data.user.id } });
  } catch { return json({ ok: false, message: "Session refresh unavailable." }, 503); }
}
