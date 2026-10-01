import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as crypto from "node:crypto";
import cbor from "cbor";
import * as upstream from "node-app-attest";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

// Only the database transport is mocked in request tests. P-256 signatures,
// CBOR parsing, Apple's fixture certificate chain and production verifier run.
// The SQL replay/permission tests below execute migration 030 in PostgreSQL.
function load(source, modules = {}, env = {}, clock = Date) {
  const code = ts.transpileModule(readFileSync(new URL(source, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  new Function("require", "exports", "process", "Date", code)((id) => {
    assert.ok(id in modules, `Unexpected dependency ${id}`);
    return modules[id];
  }, exports, { env }, clock);
  return exports;
}
const payload = load("../lib/security/attestPayload.ts");
const bodyReader = load("../lib/security/requestBody.ts");
const enabled = { APPLE_TEAM_ID: "TESTTEAM01", APPLE_BUNDLE_ID: "com.campusmint.app", APP_ATTEST_ENABLED: "true", APP_ATTEST_REVIEWED: "true", NODE_ENV: "production" };
const userId = "10000000-1111-4111-8111-111111111111";
const stranger = "20000000-1111-4111-8111-111111111111";
const challengeId = "30000000-1111-4111-8111-111111111111";
const keyId = crypto.randomBytes(32).toString("base64");
const keyPair = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const hash = value => crypto.createHash("sha256").update(value).digest();

function verifier(admin, env = enabled, clock = Date) {
  return load("../lib/security/appAttest.ts", {
    "server-only": {}, "node:crypto": crypto, cbor, "node-app-attest": upstream,
    "@/lib/supabase/server": { createSupabaseAdminClient: () => admin },
    "./attestPayload": payload, "./requestBody": bodyReader,
  }, env, clock);
}

function fixture({ body = '{"caption":"Campus Mint"}', method = "POST", path = "/api/mintz?source=native" } = {}) {
  const challenge = {
    id: challengeId, user_id: userId, key_id: keyId, purpose: "assert", challenge: crypto.randomBytes(32).toString("base64url"),
    method, path, body_hash: hash(body).toString("hex"), expires_at: new Date(Date.now() + 60_000).toISOString(),
  };
  const key = { key_id: keyId, user_id: userId, environment: "production", revoked_at: null, sign_count: 0,
    public_key: keyPair.publicKey.export({ format: "pem", type: "spki" }) };
  const state = { challenge, key, calls: 0 };
  const admin = {
    from(table) {
      const filters = [];
      const chain = {
        select() { return chain; },
        eq(field, value) { filters.push(row => row[field] === value); return chain; },
        is(field, value) { filters.push(row => row[field] === value); return chain; },
        gt(field, value) { filters.push(row => row[field] > value); return chain; },
        async maybeSingle() {
          const row = table === "native_attest_keys" ? state.key : state.challenge;
          return { data: row && filters.every(matches => matches(row)) ? { ...row } : null, error: null };
        },
      };
      return chain;
    },
    async rpc(name, values) {
      assert.equal(name, "consume_native_assertion");
      state.calls++;
      if (!state.challenge || values.p_challenge_id !== challengeId || values.p_user_id !== userId || values.p_key_id !== keyId || values.p_previous_count !== state.key.sign_count || values.p_next_count <= state.key.sign_count) return { error: { message: "Replay" } };
      state.key.sign_count = values.p_next_count;
      state.challenge = null;
      return { error: null };
    },
  };
  function proof(overrides = {}) {
    const signed = payload.assertionPayload({ challengeId, challenge: challenge.challenge, userId, method, path, bodyHash: challenge.body_hash, ...overrides });
    const authData = Buffer.alloc(37);
    hash(`${overrides.team ?? enabled.APPLE_TEAM_ID}.${overrides.bundle ?? enabled.APPLE_BUNDLE_ID}`).copy(authData);
    authData[32] = 0x40;
    authData.writeUInt32BE(overrides.count ?? 1, 33);
    const nonce = hash(Buffer.concat([authData, hash(signed)]));
    return cbor.encode({ authenticatorData: authData, signature: crypto.sign("sha256", nonce, keyPair.privateKey) });
  }
  function request({ bytes = proof(), requestBody = body, requestMethod = method, requestPath = path, headers = {} } = {}) {
    return new Request(`https://campusmint.test${requestPath}`, { method: requestMethod, ...(requestBody === null ? {} : { body: requestBody }), headers: {
      "X-App-Attest-Challenge-Id": challengeId, "X-App-Attest-Key-Id": keyId, "X-App-Attest-Assertion": bytes.toString("base64"), ...headers,
    } });
  }
  return { state, admin, proof, request, verify: verifier(admin).verifyRequestAssertion };
}

test("App Attest stays disabled without reviewed production configuration", () => {
  assert.equal(payload.attestConfiguration({}).enabled, false);
  assert.equal(payload.attestConfiguration({ ...enabled, APP_ATTEST_REVIEWED: undefined }).enabled, false);
  assert.equal(payload.attestConfiguration({ ...enabled, APPLE_TEAM_ID: "PERSONAL" }).enabled, false);
  assert.equal(payload.attestConfiguration({ ...enabled, APP_ATTEST_ALLOW_DEVELOPMENT: "true" }).allowDevelopmentEnvironment, false);
  assert.equal(payload.attestConfiguration({ ...enabled, APP_ATTEST_REQUIRED: "true" }).required, true);
  const brokenRequired = payload.attestConfiguration({ APP_ATTEST_REQUIRED: "true", NODE_ENV: "production" });
  assert.equal(brokenRequired.enabled, false);
  assert.equal(brokenRequired.required, true, "Missing configuration must not silently downgrade requested enforcement");
});

test("real signed assertion succeeds once and preserves the handler's request body", async () => {
  const f = fixture();
  const request = f.request();
  await f.verify(request, userId);
  assert.equal(await request.text(), '{"caption":"Campus Mint"}');
  assert.equal(f.state.key.sign_count, 1);
  assert.equal(f.state.challenge, null);
  await assert.rejects(f.verify(f.request(), userId));
});

for (const [label, changed] of Object.entries({
  challenge: { challenge: "different-nonce" },
  challengeId: { challengeId: "40000000-1111-4111-8111-111111111111" },
  user: { userId: stranger }, method: { method: "DELETE" }, path: { path: "/api/account/profile" },
  body: { bodyHash: hash("different").toString("hex") },
  bundle: { bundle: "com.attacker.app" }, team: { team: "OTHERTEAM1" },
})) {
  test(`signature binding rejects a changed ${label}`, async () => {
    const f = fixture();
    await assert.rejects(f.verify(f.request({ bytes: f.proof(changed) }), userId));
    assert.equal(f.state.calls, 0);
  });
}

test("the received method, path, query and exact bytes must match the issued challenge", async () => {
  for (const changed of [
    { requestMethod: "PATCH" }, { requestPath: "/api/account/profile" }, { requestPath: "/api/mintz?source=other" },
    { requestBody: '{ "caption":"Campus Mint"}' },
  ]) {
    const f = fixture();
    await assert.rejects(f.verify(f.request(changed), userId), /Request changed/);
    assert.equal(f.state.calls, 0);
  }
});

test("assertions are scoped to the authenticated owner, a live key and an unexpired challenge", async () => {
  for (const mutate of [
    f => { f.state.key.user_id = stranger; }, f => { f.state.challenge.user_id = stranger; },
    f => { f.state.key.revoked_at = new Date().toISOString(); },
    f => { f.state.challenge.expires_at = new Date(Date.now() - 1).toISOString(); },
    f => { f.state.key.environment = "development"; },
    f => { f.state.challenge.purpose = "register"; },
  ]) {
    const f = fixture(); mutate(f);
    await assert.rejects(f.verify(f.request(), userId));
    assert.equal(f.state.calls, 0);
  }
  const f = fixture();
  await assert.rejects(f.verify(f.request(), stranger));
});

test("signature tampering, malformed CBOR, extra CBOR objects and bad lengths fail closed", async () => {
  const f = fixture();
  const decoded = cbor.decodeAllSync(f.proof())[0];
  const altered = { ...decoded, signature: Buffer.from(decoded.signature) };
  altered.signature[altered.signature.length - 1] ^= 1;
  for (const bytes of [Buffer.from("malformed"), cbor.encode(altered), Buffer.concat([f.proof(), cbor.encode({})]),
    cbor.encode({ ...decoded, authenticatorData: Buffer.alloc(38) }),
    cbor.encode({ ...decoded, signature: "not bytes" }),
  ]) await assert.rejects(f.verify(f.request({ bytes }), userId));
  assert.equal(f.state.calls, 0);
});

test("canonical bounded base64 rejects noncanonical padding and oversized proofs", async () => {
  const f = fixture();
  for (const headers of [
    { "X-App-Attest-Key-Id": keyId.slice(0, -1) }, { "X-App-Attest-Key-Id": crypto.randomBytes(31).toString("base64") },
    { "X-App-Attest-Assertion": Buffer.alloc(4097).toString("base64") }, { "X-App-Attest-Challenge-Id": "not-a-uuid" },
  ]) await assert.rejects(f.verify(f.request({ headers }), userId));
  assert.equal(f.state.calls, 0);
});

test("a stale counter and concurrent replay cannot authorize two requests", async () => {
  const old = fixture();
  await assert.rejects(old.verify(old.request({ bytes: old.proof({ count: 0 }) }), userId));
  assert.equal(old.state.calls, 0);
  const f = fixture();
  const results = await Promise.allSettled([f.verify(f.request(), userId), f.verify(f.request(), userId)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(f.state.key.sign_count, 1);
});

test("empty-body DELETE uses the SHA256 of zero bytes", async () => {
  const f = fixture({ body: "", method: "DELETE", path: "/api/mintz?id=example" });
  await f.verify(f.request({ requestBody: null }), userId);
  assert.equal(f.state.key.sign_count, 1);
});

test("registration validates the real Apple chain and rejects expired, reordered or replayed evidence", () => {
  // Public, historical fixture distributed with the verifier; never production credentials.
  const historical = JSON.parse(readFileSync(new URL("../node_modules/node-app-attest/test/fixtures/attestation-production.json", import.meta.url), "utf8"));
  const bytes = Buffer.from(historical.attestation, "base64");
  const challenge = Buffer.from(historical.challenge, "base64").toString("utf8");
  const env = { ...enabled, APPLE_TEAM_ID: "V8H6LQ9448", APPLE_BUNDLE_ID: "io.uebelacker.AppAttestExample" };
  class FixtureClock extends Date { static now() { return Date.parse("2024-03-01T00:00:00Z"); } }
  const current = verifier(null, env).verifyRegistration;
  const atIssue = verifier(null, env, FixtureClock).verifyRegistration;
  assert.equal(atIssue(bytes, challenge, historical.keyId).environment, "production");
  assert.throws(() => atIssue(bytes, "another challenge", historical.keyId), /nonce/);
  assert.throws(() => atIssue(bytes, challenge, keyId), /keyId/);
  assert.throws(() => current(bytes, challenge, historical.keyId), /Expired certificate/);
  const decoded = cbor.decodeAllSync(bytes)[0];
  decoded.attStmt.x5c.reverse();
  assert.throws(() => atIssue(cbor.encode(decoded), challenge, historical.keyId), /Invalid chain/);
});

test("PostgreSQL grants keep attestation private and atomic consumption rolls back on expired/replayed challenges", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      grant usage on schema public to anon,authenticated,service_role;
      insert into auth.users values ('${userId}'),('${stranger}');`);
    await db.exec(readFileSync(new URL("../supabase/migrations/20260928003000_native_attestation.sql", import.meta.url), "utf8"));
    for (const role of ["anon", "authenticated"]) {
      const grants = await db.query(`select
        has_table_privilege('${role}','public.native_attest_keys','SELECT,INSERT,UPDATE,DELETE') as keys,
        has_table_privilege('${role}','public.native_attest_challenges','SELECT,INSERT,UPDATE,DELETE') as challenges,
        has_table_privilege('${role}','public.native_auth_sessions','SELECT,INSERT,UPDATE,DELETE') as sessions,
        has_function_privilege('${role}','public.consume_native_assertion(uuid,uuid,text,bigint,bigint)','EXECUTE') as consume;`);
      assert.deepEqual(grants.rows, [{ keys: false, challenges: false, sessions: false, consume: false }]);
    }
    await db.query("insert into public.native_attest_keys(key_id,user_id,public_key,receipt,environment) values($1,$2,'fixture','receipt','production')", [keyId, userId]);
    const insertChallenge = async (expires) => db.query("insert into public.native_attest_challenges(id,user_id,challenge,purpose,key_id,method,path,body_hash,expires_at) values($1,$2,$3,'assert',$4,'POST','/api/mintz',$5,$6)", [challengeId, userId, "x".repeat(43), keyId, "a".repeat(64), expires]);
    const consume = (owner, before, next) => db.query("select public.consume_native_assertion($1,$2,$3,$4,$5)", [challengeId, owner, keyId, before, next]);
    await insertChallenge(new Date(Date.now() - 60_000).toISOString());
    await assert.rejects(consume(userId, 0, 1), /Challenge unavailable/);
    assert.equal((await db.query("select sign_count from public.native_attest_keys")).rows[0].sign_count, 0);
    await db.query("update public.native_attest_challenges set expires_at=now()+interval '1 minute'");
    await assert.rejects(consume(stranger, 0, 1), /Assertion replay/);
    await consume(userId, 0, 1);
    assert.equal((await db.query("select count(*)::int n from public.native_attest_challenges")).rows[0].n, 0);
    await assert.rejects(consume(userId, 0, 1), /Assertion replay/);
    assert.equal((await db.query("select sign_count from public.native_attest_keys")).rows[0].sign_count, 1);
  } finally { await db.close(); }
});
