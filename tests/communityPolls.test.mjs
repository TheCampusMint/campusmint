import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

import { createPollDefinition, emptyPoll, validatePollInput } from "../lib/content/polls.ts";

test("poll input accepts text-only questions, trims options and starts with no fabricated votes", () => {
  const input = validatePollInput({ question: " Who needs a roommate? ", options: [" Fall ", "Spring"] });
  assert.deepEqual(input, { question: "Who needs a roommate?", options: ["Fall", "Spring"] });
  assert.deepEqual(createPollDefinition(input).options, [{ id: "1", label: "Fall" }, { id: "2", label: "Spring" }]);
  const poll = emptyPoll(input);
  assert.equal(poll.totalVotes, 0);
  assert.equal(poll.selectedOptionId, null);
  assert.ok(poll.options.every((option) => option.voteCount === 0));
  assert.equal(validatePollInput(undefined), null);
  assert.equal(validatePollInput(null), null);
});

test("poll input rejects ambiguous, blank, oversized or malformed answers instead of silently changing them", () => {
  const valid = { question: "Where?", options: ["Library", "Cafe"] };
  for (const input of [[], 1, {}, { ...valid, question: " " }, { ...valid, question: "x".repeat(281) },
    { ...valid, options: ["Only one"] }, { ...valid, options: Array.from({ length: 7 }, (_, i) => String(i)) },
    { ...valid, options: ["Library", " library "] }, { ...valid, options: ["Fine", " "] },
    { ...valid, options: ["Fine", "x".repeat(101)] }, { ...valid, options: ["Fine", {}] }]) {
    assert.throws(() => validatePollInput(input));
  }
  assert.equal(validatePollInput({ ...valid, options: ["A", "B", "C", "D", "E", "F"] }).options.length, 6);
});

const viewerId = "e7a7b155-a7c4-4bd1-9905-0c794e45a782";
const mintId = "b5ab531a-be30-4903-aa67-fbe988fb6d96";
function pollRoute({ signedIn = true, error = null } = {}) {
  const calls = [];
  const poll = emptyPoll({ question: "Where?", options: ["Library", "Cafe"] });
  const bindings = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/supabase/server": {
      hasSupabasePublicConfig: () => true, hasSupabaseServerConfig: () => true,
      createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: viewerId } : null }, error: null }) } }),
      createSupabaseAdminClient: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return { data: poll, error }; } }),
    },
  };
  const source = readFileSync(new URL("../app/api/mintz/[mintId]/poll/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)((name) => {
    assert.ok(bindings[name], `Unmocked dependency: ${name}`); return bindings[name];
  }, exports);
  return { calls, run: (method, body = undefined, id = mintId) => exports[method](new Request(`https://campusmint.test/api/mintz/${id}/poll`, {
    method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  }), { params: Promise.resolve({ mintId: id }) }) };
}

test("poll endpoint rejects signed-out callers and malformed choices without touching the database", async () => {
  const signedOut = pollRoute({ signedIn: false });
  assert.equal((await signedOut.run("GET")).status, 401);
  assert.equal((await signedOut.run("POST", { optionId: "1" })).status, 401);
  assert.equal(signedOut.calls.length, 0);
  const invalid = pollRoute();
  for (const optionId of [null, {}, 1, "", "0", "7", "1 OR true"]) {
    assert.equal((await invalid.run("POST", { optionId })).status, 400);
  }
  assert.equal((await invalid.run("GET", undefined, "invalid")).status, 404);
  assert.equal(invalid.calls.length, 0);
});

test("poll read and vote always use authenticated account identity, ignoring spoofed request identity", async () => {
  const route = pollRoute();
  const read = await route.run("GET");
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("Cache-Control"), "private, no-store");
  const result = await route.run("POST", { optionId: "2", viewer_id: "another-user", userId: "another-user" });
  assert.equal(result.status, 200);
  assert.deepEqual(route.calls, [
    { name: "read_mint_poll", args: { target_content_id: mintId, viewer_id: viewerId } },
    { name: "vote_mint_poll", args: { target_content_id: mintId, viewer_id: viewerId, selected_option_id: "2" } },
  ]);
  assert.deepEqual(Object.keys((await result.json()).poll).sort(), ["options", "question", "selectedOptionId", "totalVotes"]);
});

test("poll endpoint hides database details and preserves unavailable/privacy failure status", async () => {
  for (const [code, expected] of [["P0002", 404], ["42501", 403], ["22023", 400], ["XX000", 503]]) {
    const route = pollRoute({ error: { code, message: "private diagnostic value" } });
    const response = await route.run("POST", { optionId: "1" });
    assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /private diagnostic/);
  }
});
