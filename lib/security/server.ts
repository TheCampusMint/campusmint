import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export function securityDigest(value: string) {
  const secret = process.env.SECURITY_RATE_LIMIT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Security storage is not configured.");
  return createHmac("sha256", secret).update(`campusmint/security/v1:${value}`).digest("hex");
}

export async function consumeRateLimit(scope: string, key: string, limit: number, seconds: number) {
  const { data, error } = await createSupabaseAdminClient().rpc("consume_security_rate_limit", {
    p_key_hash: securityDigest(`${scope}:${key}`), p_limit: limit, p_window_seconds: seconds,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || typeof row?.allowed !== "boolean") throw new Error("Rate limiter unavailable.");
  return { allowed: row.allowed as boolean, retryAfter: Math.max(1, Number(row.retry_after_seconds) || seconds) };
}

export async function auditSecurityEvent(action: string, outcome: "allowed" | "denied" | "error", actorId: string | null = null, requestId: string | null = null) {
  // Deliberately no arbitrary payloads, headers, email, token or precise location.
  const event = { actor_id: actorId, action: action.slice(0, 80), outcome, request_id: requestId, metadata: {} };
  const { error } = await createSupabaseAdminClient().from("security_audit_events").insert(event);
  console.info(JSON.stringify({ kind: "security", action: event.action, outcome: event.outcome, requestId }));
  if (error) throw new Error("Audit storage unavailable.");
}

export function validCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.CAMPUS_DATA_SYNC_SECRET;
  if (!secret || secret.length < 24) return false;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
