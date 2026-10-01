import "server-only";
import { createHash, X509Certificate } from "node:crypto";
import cbor from "cbor";
import { verifyAttestation, verifyAssertion } from "node-app-attest";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { assertionPayload, attestConfiguration } from "./attestPayload";
import { readBodyBytes } from "./requestBody";

export const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function base64Bytes(v: unknown, max: number) {
  if (typeof v !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(v) || v.length > max * 4 / 3 + 4) throw new Error("Invalid proof.");
  const bytes = Buffer.from(v, "base64");
  if (!bytes.length || bytes.length > max || bytes.toString("base64") !== v) throw new Error("Invalid proof.");
  return bytes;
}

export function verifyRegistration(attestation: Buffer, challenge: string, keyId: string) {
  const configuration = attestConfiguration(process.env);
  if (!configuration.enabled) throw new Error("App Attest is not configured.");
  // The upstream verifier checks Apple's root, nonce, app ID, key ID, AAGUID and
  // zero counter. Add strict CBOR shape, chain ordering and certificate lifetime.
  const objects = cbor.decodeAllSync(attestation, { max_depth: 12 });
  if (objects.length !== 1 || !Array.isArray(objects[0]?.attStmt?.x5c) || objects[0].attStmt.x5c.length !== 2) throw new Error("Invalid chain.");
  const certs = objects[0].attStmt.x5c.map((der: Buffer) => new X509Certificate(der)) as X509Certificate[];
  if (certs[0].ca || !certs[1].ca || !certs[0].checkIssued(certs[1])) throw new Error("Invalid chain.");
  if (certs.some(cert => Date.parse(cert.validFrom) > Date.now() || Date.parse(cert.validTo) < Date.now())) throw new Error("Expired certificate.");
  return verifyAttestation({ attestation, challenge, keyId, ...configuration });
}

export async function verifyRequestAssertion(request: Request, userId: string) {
  const config = attestConfiguration(process.env);
  if (!config.enabled) throw new Error("Attestation unavailable.");
  const challengeId = request.headers.get("x-app-attest-challenge-id");
  const keyId = request.headers.get("x-app-attest-key-id");
  if (!uuid(challengeId) || !keyId || base64Bytes(keyId, 32).length !== 32) throw new Error("Missing proof.");
  const assertion = base64Bytes(request.headers.get("x-app-attest-assertion"), 4096);
  const admin = createSupabaseAdminClient();
  const [challenge, key] = await Promise.all([
    admin.from("native_attest_challenges").select("*").eq("id", challengeId).eq("user_id", userId).eq("purpose", "assert").eq("key_id", keyId).gt("expires_at", new Date().toISOString()).maybeSingle(),
    admin.from("native_attest_keys").select("public_key,sign_count,environment").eq("key_id", keyId).eq("user_id", userId).is("revoked_at", null).maybeSingle(),
  ]);
  if (challenge.error || key.error || !challenge.data || !key.data) throw new Error("Invalid proof.");
  if (!config.allowDevelopmentEnvironment && key.data.environment !== "production") throw new Error("Invalid environment.");
  const url = new URL(request.url);
  const path = url.pathname + url.search;
  const bodyHash = createHash("sha256").update(request.body ? await readBodyBytes(request.clone()) : new Uint8Array()).digest("hex");
  const saved = challenge.data;
  if (saved.method !== request.method || saved.path !== path || saved.body_hash !== bodyHash) throw new Error("Request changed.");
  const decoded = cbor.decodeAllSync(assertion, { max_depth: 8 });
  if (decoded.length !== 1 || !Buffer.isBuffer(decoded[0]?.authenticatorData) || decoded[0].authenticatorData.length !== 37 || !Buffer.isBuffer(decoded[0]?.signature)) throw new Error("Invalid assertion.");
  const result = verifyAssertion({ assertion, payload: assertionPayload({ challengeId, challenge: saved.challenge, userId, method: request.method, path, bodyHash }), publicKey: key.data.public_key, signCount: Number(key.data.sign_count), ...config });
  const consumed = await admin.rpc("consume_native_assertion", { p_challenge_id: challengeId, p_user_id: userId, p_key_id: keyId, p_previous_count: key.data.sign_count, p_next_count: result.signCount });
  if (consumed.error) throw new Error("Proof replayed.");
}
