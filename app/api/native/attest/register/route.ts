import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { readJsonObject } from "@/lib/security/requestBody";
import { attestConfiguration } from "@/lib/security/attestPayload";
import { base64Bytes, uuid, verifyRegistration } from "@/lib/security/appAttest";
import { auditSecurityEvent } from "@/lib/security/server";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function POST(request: Request) {
  if (!attestConfiguration(process.env).enabled) return json({ ok: false, message: "App Attest is not configured." }, 503);
  try {
    const auth = await createSupabaseServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return json({ ok: false }, 401);
    const body = await readJsonObject(request, 40000);
    if (!uuid(body.challengeId) || typeof body.keyId !== "string" || base64Bytes(body.keyId, 32).length !== 32) return json({ ok: false }, 400);
    const admin = createSupabaseAdminClient();
    const challenge = await admin.from("native_attest_challenges").select("challenge").eq("id", body.challengeId).eq("user_id", user.id).eq("purpose", "register").gt("expires_at", new Date().toISOString()).maybeSingle();
    if (challenge.error || !challenge.data) return json({ ok: false, message: "Request a new challenge." }, 403);
    const verified = verifyRegistration(base64Bytes(body.attestation, 24000), challenge.data.challenge, body.keyId);
    const result = await admin.rpc("register_native_attest_key", { p_challenge_id: body.challengeId, p_user_id: user.id, p_key_id: verified.keyId, p_public_key: verified.publicKey, p_receipt: verified.receipt.toString("base64"), p_environment: verified.environment });
    if (result.error) throw new Error("Registration rejected.");
    await auditSecurityEvent("attest.register", "allowed", user.id);
    return json({ ok: true });
  } catch { return json({ ok: false, message: "Device verification failed." }, 403); }
}
