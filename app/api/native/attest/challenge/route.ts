import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { readJsonObject } from "@/lib/security/requestBody";
import { attestConfiguration } from "@/lib/security/attestPayload";
import { base64Bytes } from "@/lib/security/appAttest";
import { consumeRateLimit } from "@/lib/security/server";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function POST(request: Request) {
  if (!attestConfiguration(process.env).enabled) return json({ ok: false, message: "App Attest is not configured." }, 503);
  try {
    const auth = await createSupabaseServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return json({ ok: false, message: "Sign in again." }, 401);
    const body = await readJsonObject(request, 4096);
    if (body.purpose !== "register" && body.purpose !== "assert") return json({ ok: false }, 400);
    if (body.purpose === "register") {
      const budget = await consumeRateLimit("attest.enroll.challenge", user.id, 10, 600);
      if (!budget.allowed) return json({ ok: false, message: "Please wait before registering another device." }, 429);
    }
    const admin = createSupabaseAdminClient();
    if (body.purpose === "assert") {
      if (base64Bytes(body.keyId, 32).length !== 32 || typeof body.method !== "string" || !["POST", "PATCH", "DELETE", "PUT"].includes(body.method) || typeof body.path !== "string" || !body.path.startsWith("/api/") || body.path.length > 512 || /[\r\n#]/.test(body.path) || typeof body.bodyHash !== "string" || !/^[a-f0-9]{64}$/.test(body.bodyHash)) return json({ ok: false }, 400);
      const key = await admin.from("native_attest_keys").select("key_id").eq("key_id", body.keyId).eq("user_id", user.id).is("revoked_at", null).maybeSingle();
      if (key.error || !key.data) return json({ ok: false, message: "Register this device again." }, 403);
    }
    const result = await admin.from("native_attest_challenges").insert({ user_id: user.id, challenge: randomBytes(32).toString("base64url"), purpose: body.purpose,
      ...(body.purpose === "assert" ? { key_id: body.keyId, method: body.method, path: body.path, body_hash: body.bodyHash } : {}),
    }).select("id,challenge,expires_at").single();
    if (result.error || !result.data) throw new Error("Storage unavailable.");
    return json({ ok: true, challengeId: result.data.id, challenge: result.data.challenge, expiresAt: result.data.expires_at });
  } catch { return json({ ok: false, message: "Device verification unavailable." }, 400); }
}
