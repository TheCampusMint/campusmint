import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import ts from "typescript";

import * as policy from "../lib/content/mintUploadPolicy.ts";
import * as tickets from "../lib/content/mintUploadTicket.ts";
import * as mediaPolicy from "../lib/content/mediaPolicy.ts";
import { publishMint } from "../lib/content/publishMint.ts";

const userId = "85a07f98-0a8e-41f9-825c-847c094f33da";
const requestId = "1218db39-aea3-43b7-b7b0-2391b734ab46";
const secret = "test-only-upload-manifest-secret";
const now = Date.parse("2026-09-27T12:00:00Z");
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const selected = [{ mimeType: "image/png", byteSize: png.length }];

test("signed upload manifests bind account, request, content declaration and expiry", () => {
  const issued = tickets.createMintUploadTicket(userId, requestId, selected, secret, now);
  const manifest = tickets.verifyMintUploadTicket(issued.ticket, userId, requestId, secret, now + 1);
  assert.equal(manifest.files[0].byteSize, png.length);
  assert.ok(manifest.files[0].storagePath.startsWith(`${userId}/${requestId}/`));
  assert.throws(() => tickets.verifyMintUploadTicket(issued.ticket, randomUUID(), requestId, secret, now));
  assert.throws(() => tickets.verifyMintUploadTicket(issued.ticket, userId, randomUUID(), secret, now));
  assert.throws(() => tickets.verifyMintUploadTicket(issued.ticket, userId, requestId, "another-key", now));
  assert.throws(() => tickets.verifyMintUploadTicket(issued.ticket, userId, requestId, secret, now + 2 * 60 * 60 * 1000));
  const [encoded, signature] = issued.ticket.split(".");
  const tampered = JSON.parse(Buffer.from(encoded, "base64url").toString());
  tampered.files[0].byteSize = 1024;
  const changed = `${Buffer.from(JSON.stringify(tampered)).toString("base64url")}.${signature}`;
  assert.throws(() => tickets.verifyMintUploadTicket(changed, userId, requestId, secret, now));
  assert.notEqual(issued.files[0].storagePath, tickets.createMintUploadTicket(userId, requestId, selected, secret, now).files[0].storagePath);
});

test("upload policy rejects unsupported, empty, fractional, excessive and aggregate sizes", () => {
  for (const files of [null, [{ mimeType: "image/svg+xml", byteSize: 1 }], [{ mimeType: "image/png", byteSize: 0 }], [{ mimeType: "image/png", byteSize: 1.1 }], [{ mimeType: "image/png", byteSize: 12 * 1024 ** 2 + 1 }], [{ mimeType: "video/mp4", byteSize: 100 * 1024 ** 2 + 1 }], Array(7).fill(selected[0]), Array(2).fill({ mimeType: "video/mp4", byteSize: 100 * 1024 ** 2 })]) {
    assert.throws(() => policy.validateMintUploadFiles(files));
  }
  assert.equal(policy.validateMintUploadFiles([{ mimeType: "video/mp4", byteSize: 100 * 1024 ** 2 }])[0].byteSize, 100 * 1024 ** 2);
});

test("finalization checks actual Storage location, size, MIME and media signature", () => {
  const expected = { ...selected[0], storagePath: `${userId}/image.png`, sortOrder: 0 };
  const info = { size: png.length, contentType: "image/png", bucketId: "mint-media", name: expected.storagePath };
  assert.doesNotThrow(() => policy.validateMintStoredObject(expected, info, png));
  for (const patch of [{ size: png.length + 1 }, { contentType: "text/html" }, { name: "someone-else/image.png" }, { bucketId: "avatars" }]) {
    assert.throws(() => policy.validateMintStoredObject(expected, { ...info, ...patch }, png));
  }
  assert.throws(() => policy.validateMintStoredObject(expected, info, new TextEncoder().encode("<script>")));
  assert.equal(policy.matchesMintMediaSignature(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg"), true);
  assert.equal(policy.matchesMintMediaSignature(new TextEncoder().encode("RIFF0000WEBP"), "image/webp"), true);
  assert.equal(policy.matchesMintMediaSignature(new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109]), "video/mp4"), true);
  assert.equal(policy.matchesMintMediaSignature(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 119, 101, 98, 109]), "video/webm"), true);
});

/** In-memory Supabase boundary exercises the real route's auth, storage and DB sequence. */
function routeHarness({ authenticated = true, verified = true, malformedStorage = false, configured = true } = {}) {
  const rows = {
    profile_identities: [{ user_id: userId, university_id: "tamu", account_type: "student", verified_student: verified }],
    profiles: [{ user_id: userId, username: "student", username_normalized: "student", first_name: "Test", last_name: "Student", display_name: "Test Student" }],
    campus_network_universities: [{ university_id: "tamu", campus_network_id: randomUUID() }],
  };
  const objects = new Map();
  let signedUploads = 0;
  let removedObjects = 0;
  const admin = {
    from(table) {
      rows[table] ??= [];
      let mode = "select", value, one = false;
      const filters = [];
      const query = {
        select() { return query; },
        eq(key, expected) { filters.push((row) => row[key] === expected); return query; },
        is(key, expected) { filters.push((row) => (row[key] ?? null) === expected); return query; },
        in(key, expected) { filters.push((row) => expected.includes(row[key])); return query; },
        order() { return query; }, limit() { return query; }, or() { return query; },
        maybeSingle() { one = true; return query; }, single() { one = true; return query; },
        insert(data) { mode = "insert"; value = data; return query; },
        delete() { mode = "delete"; return query; },
        then(resolve) {
          let result = rows[table].filter((row) => filters.every((filter) => filter(row)));
          if (mode === "insert") {
            result = (Array.isArray(value) ? value : [value]).map((item) => ({ id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: "active", ...item }));
            rows[table].push(...result);
          } else if (mode === "delete") rows[table] = rows[table].filter((row) => !result.includes(row));
          return Promise.resolve({ data: one ? result[0] ?? null : result, error: null }).then(resolve);
        },
      };
      return query;
    },
    storage: { from(bucketId) {
      assert.equal(bucketId, "mint-media");
      return {
        async createSignedUploadUrl(path, options) { signedUploads += 1; assert.equal(options.upsert, false); return { data: { token: "storage-upload-token", path }, error: null }; },
        async info(path) {
          const file = objects.get(path);
          return file ? { data: { name: path, bucketId, size: file.size + (malformedStorage ? 1 : 0), contentType: file.type }, error: null } : { data: null, error: new Error("Missing") };
        },
        async createSignedUrl(path) { return { data: { signedUrl: `https://storage.test/${path}` }, error: null }; },
        async createSignedUrls(paths) { return { data: paths.map((path) => ({ path, signedUrl: `https://storage.test/${path}` })), error: null }; },
        async remove() { removedObjects += 1; return { error: null }; },
      };
    } },
  };
  const bindings = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/data/universities": { configuredUniversityIds: ["tamu"] },
    "@/lib/supabase/server": {
      hasSupabasePublicConfig: () => configured,
      hasSupabaseServerConfig: () => configured,
      createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: userId } : null }, error: null }) } }),
      createSupabaseAdminClient: () => admin,
    },
    "@/lib/content/mediaPolicy": mediaPolicy,
    "@/lib/content/mintUploadPolicy": policy,
    "@/lib/content/mintUploadTicket": tickets,
  };
  const source = readFileSync(new URL("../app/api/mintz/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)((name) => {
    assert.ok(bindings[name], `Unmocked dependency: ${name}`);
    return bindings[name];
  }, exports);
  const request = (body) => exports.POST(new Request("http://campusmint.test/api/mintz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  return { request, rows, objects, signedUploads: () => signedUploads, removedObjects: () => removedObjects };
}

const payload = { requestId, caption: "A campus moment", postType: "personal", privacy: "public", mediaMetadata: [{ width: 640, height: 480 }] };

test("upload authorization is withheld from signed-out, unverified and unconfigured accounts", async () => {
  for (const [options, status] of [[{ authenticated: false }, 401], [{ verified: false }, 403], [{ configured: false }, 503]]) {
    const app = routeHarness(options);
    const response = await app.request({ action: "prepare", payload, files: selected });
    assert.equal(response.status, status);
    assert.equal(app.signedUploads(), 0);
  }
});

test("a large video publishes through direct Storage and reloads as a durable Mint; retry deduplicates", async (t) => {
  const savedSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
  t.after(() => { if (savedSecret === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = savedSecret; });
  const app = routeHarness();
  const bytes = new Uint8Array(5 * 1024 ** 2);
  bytes.set([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109]);
  const file = new File([bytes], "campus.mp4", { type: "video/mp4" });
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.headers.Range, "bytes=0-511");
    const stored = app.objects.get(new URL(url).pathname.slice(1));
    return new Response(stored.slice(0, 512), { status: 206 });
  });
  let uploadCalls = 0;
  const upload = async (destination, body) => { uploadCalls += 1; assert.equal(body, file); app.objects.set(destination.storagePath, body); return { error: null }; };
  const transport = async (url, options) => {
    assert.equal(url, "/api/mintz");
    assert.ok(options.body.length < 16_000, "app host receives JSON only, never video bytes");
    return app.request(JSON.parse(options.body));
  };
  const result = await publishMint(payload, [file], upload, transport);
  assert.equal(result.ok, true);
  assert.equal(result.mint.media[0].type, "video");
  assert.equal(result.mint.media[0].width, 640);
  assert.equal(result.mint.isDevelopment, false);
  assert.equal(app.rows.content_media[0].byte_size, file.size);
  assert.equal(app.rows.social_content.length, 1);
  assert.equal(app.rows.media_cleanup_jobs.length, 0);
  const retry = await publishMint(payload, [file], upload, transport);
  assert.equal(retry.ok, true);
  assert.equal(retry.deduplicated, true);
  assert.equal(retry.mint.id, result.mint.id);
  assert.equal(uploadCalls, 1);
  assert.equal(app.rows.social_content.length, 1);
});

test("incomplete, foreign and mismatched uploads cannot create a published record", async (t) => {
  const savedSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
  t.after(() => { if (savedSecret === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = savedSecret; });
  t.mock.method(globalThis, "fetch", async () => new Response(png, { status: 206 }));
  t.mock.method(console, "error", () => {});
  for (const mode of ["missing", "mismatched", "foreign"]) {
    const app = routeHarness({ malformedStorage: mode === "mismatched" });
    const issued = tickets.createMintUploadTicket(mode === "foreign" ? randomUUID() : userId, requestId, selected, secret);
    if (mode !== "missing") app.objects.set(issued.files[0].storagePath, new File([png], "photo.png", { type: "image/png" }));
    const response = await app.request({ action: "publish", payload, uploadTicket: issued.ticket });
    assert.equal((await response.json()).ok, false);
    assert.equal(app.rows.social_content?.length ?? 0, 0);
    assert.equal(app.removedObjects(), 0, "failed finalize must not delete another concurrent request's objects");
  }
});

test("client does not finalize failed media uploads or report publication before the server succeeds", async () => {
  const calls = [];
  const result = await publishMint(payload, [new File([png], "photo.png", { type: "image/png" })], async () => ({ error: { message: "Network interrupted" } }), async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return Response.json({ ok: true, upload: { ticket: "ticket", files: [{ storagePath: "photo.png", sortOrder: 0, token: "token" }] } });
  });
  assert.equal(result.ok, false);
  assert.equal(result.retryable, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, "prepare");
});
