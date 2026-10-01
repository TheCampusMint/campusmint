import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as policy from "../lib/security/policy.ts";
import { readJsonBody, readJsonObject, readSmallFormData } from "../lib/security/requestBody.ts";
import * as attest from "../lib/security/attestPayload.ts";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function harness({ user = { id: userId }, rateAllowed = true, rateUnavailable = false, proofValid = true, nativeSession = false } = {}) {
  const calls = { limits: [], auth: 0, proofs: 0, audits: [] };
  const response = () => { const value = new Response(null); value.cookies = { set() {} }; return value; };
  const client = { auth: {
    getUser: async () => { calls.auth++; return { data: { user }, error: null }; },
    getClaims: async () => ({ data: { claims: { sub: userId, session_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } } }),
  } };
  const database = { from() { const chain = { select() { return chain; }, eq() { return chain; }, maybeSingle: async () => ({ data: nativeSession ? { session_id: "native" } : null, error: null }) }; return chain; } };
  const modules = {
    "@supabase/ssr": { createServerClient: () => client }, "@supabase/supabase-js": { createClient: () => client },
    "node:crypto": { randomUUID: () => "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
    "next/server": { NextResponse: { next: response, json: Response.json } },
    "@/lib/security/policy": policy,
    "@/lib/security/attestPayload": attest,
    "@/lib/supabase/server": { createSupabaseAdminClient: () => database },
    "@/lib/security/appAttest": { verifyRequestAssertion: async () => { calls.proofs++; if (!proofValid) throw new Error("Bad proof"); } },
    "@/lib/security/server": {
      validCronSecret: () => false,
      consumeRateLimit: async (...args) => { calls.limits.push(args); if (rateUnavailable) throw new Error("Unavailable"); return { allowed: rateAllowed, retryAfter: 17 }; },
      auditSecurityEvent: async (...args) => { calls.audits.push(args); },
    },
  };
  const source = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", code)(name => { assert.ok(name in modules, name); return modules[name]; }, exports);
  return { calls, run: async (path, { method = "GET", headers = {}, body } = {}, environment = {}) => {
    const saved = { ...process.env };
    Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable", APP_ATTEST_ENABLED: "false", APP_ATTEST_REQUIRED: "false", VERCEL: "0", ...environment });
    const request = new Request(`https://campusmint.test${path}`, { method, headers, body });
    request.nextUrl = new URL(request.url); request.cookies = { getAll: () => [], set() {} };
    try { return await exports.proxy(request); } finally { process.env = saved; }
  } };
}

test("logged-out account hydration and idempotent logout reach their handlers", async () => {
  const app = harness({ user: null });
  assert.equal((await app.run("/api/account/me")).status, 200);
  assert.equal((await app.run("/api/account/logout", { method: "POST", headers: { Origin: "https://campusmint.test" } })).status, 200);
  assert.equal((await app.run("/api/mintz")).status, 401);
});
test("paid provider, unknown API and filename-suffixed paths require verified identity", async () => {
  for (const path of ["/api/places/search?q=coffee", "/api/discovery/nearby", "/api/private.png", "/api/new-operation"]) {
    assert.equal((await harness({ user: null }).run(path)).status, 401);
  }
});
test("cross-site cookie mutations and malformed bearer headers are denied before work", async () => {
  for (const headers of [{ Origin: "https://evil.test", Cookie: "session=x" }, { Cookie: "session=x", "Sec-Fetch-Site": "cross-site" }, { Authorization: "Basic fake" }]) {
    const app = harness();
    assert.ok([401, 403].includes((await app.run("/api/mintz", { method: "POST", headers })).status));
    assert.equal(app.calls.auth, 0);
  }
  assert.equal((await harness().run("/api/mintz", { method: "POST", headers: { Authorization: "Bearer fake.jwt.token" } })).status, 200);
});
test("quota denial carries Retry-After; unavailable distributed storage fails closed", async () => {
  const limited = await harness({ rateAllowed: false }).run("/api/mintz");
  assert.equal(limited.status, 429); assert.equal(limited.headers.get("retry-after"), "17");
  assert.equal((await harness({ rateUnavailable: true }).run("/api/mintz")).status, 503);
});
test("untrusted forwarded addresses never partition the ingress quota", async () => {
  const app = harness();
  await app.run("/api/mintz", { headers: { "X-Forwarded-For": "spoof-1", "X-Vercel-Forwarded-For": "spoof-2" } });
  assert.equal(app.calls.limits[0][1], "ip:non-vercel-ingress");
});
const attestedEnvironment = { APPLE_TEAM_ID: "ABCDEFGHIJ", APPLE_BUNDLE_ID: "com.campusmint.app", APP_ATTEST_ENABLED: "true", APP_ATTEST_REVIEWED: "true" };
test("optional submitted assertions are verified and invalid proofs are rejected", async () => {
  const app = harness({ proofValid: false });
  const result = await app.run("/api/mintz", { method: "POST", headers: { Authorization: "Bearer fake.jwt.token", "X-App-Attest-Assertion": "proof" } }, attestedEnvironment);
  assert.equal(result.status, 403); assert.equal(app.calls.proofs, 1);
});
test("required attestation cannot silently disable itself on bad configuration", async () => {
  assert.equal(attest.attestConfiguration({ APP_ATTEST_REQUIRED: "true" }).required, true);
  const result = await harness({ nativeSession: true }).run("/api/mintz", { method: "POST", headers: { Origin: "https://campusmint.test" } }, { APP_ATTEST_REQUIRED: "true" });
  assert.equal(result.status, 503);
});
test("native-session cookies cannot strip required attestation; normal web remains authorized separately", async () => {
  const native = harness({ nativeSession: true, proofValid: false });
  const request = { method: "POST", headers: { Origin: "https://campusmint.test" } };
  assert.equal((await native.run("/api/mintz", request, { ...attestedEnvironment, APP_ATTEST_REQUIRED: "true" })).status, 403);
  assert.equal((await harness().run("/api/mintz", request, { ...attestedEnvironment, APP_ATTEST_REQUIRED: "true" })).status, 200);
});
test("body limits inspect actual bytes, reject arrays and non-JSON, and accept valid JSON", async () => {
  const request = (body, headers = {}) => new Request("https://campusmint.test", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });
  assert.deepEqual(await readJsonObject(request('{"caption":"Hi"}')), { caption: "Hi" });
  await assert.rejects(readJsonBody(request('"' + "x".repeat(100) + '"', { "Content-Length": "2" }), 30));
  await assert.rejects(readJsonObject(request("[]")));
  await assert.rejects(readJsonBody(request("{}", { "Content-Type": "text/plain" })));
  await assert.rejects(readSmallFormData(request("{}")));
});
