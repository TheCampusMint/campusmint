import test from "node:test";
import assert from "node:assert/strict";
import { nativeRealtimeConfig } from "../lib/security/nativeRealtimeConfig.ts";
const url = "https://projectref.supabase.co";
const jwt = role => ["header", Buffer.from(JSON.stringify({ role, iss: "supabase", ref: "projectref" })).toString("base64url"), "signature"].join(".");
test("native realtime exposes only public connection material", () => {
  assert.deepEqual(nativeRealtimeConfig({ url, publishableKey: "sb_publishable_test" }), { url, publishableKey: "sb_publishable_test" });
  assert.equal(nativeRealtimeConfig({ url, publishableKey: jwt("anon") }).publishableKey, jwt("anon"));
  for (const key of ["sb_secret_test", jwt("service_role"), jwt("authenticated"), "malformed"]) assert.equal(nativeRealtimeConfig({ url, publishableKey: key }), null);
});
test("native realtime rejects insecure, foreign and credential-bearing destinations", () => {
  for (const value of ["http://projectref.supabase.co", "https://projectref.supabase.co.evil.com", "https://user:password@projectref.supabase.co", `${url}/path`, `${url}?key=value`, `${url}#token`, `${url}:8443`]) {
    assert.equal(nativeRealtimeConfig({ url: value, publishableKey: "sb_publishable_test" }), null);
  }
  assert.equal(nativeRealtimeConfig(null), null);
});
