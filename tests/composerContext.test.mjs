import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../app/api/mintz/context/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function route({ authenticated = true, configured = true, campus = "tamu", failTable = null } = {}) {
  const queriedTables = [];
  const club = { id: "trusted-club", name: "Book club", university_id: "tamu", status: "active", is_development: false, confidence_level: "official", official_status: "university_verified", contact_email: "private-contact@example.test" };
  const event = { id: "campus-event", title: "Campus meetup", campus_id: "tamu", status: "scheduled", starts_at: "2099-10-01T12:00:00Z", location_name: "Student center" };
  const tables = {
    profile_identities: [{ user_id: "owner", university_id: campus }, { user_id: "another-student", university_id: "other" }],
    organizations: [club, { ...club, id: "other-campus-club", university_id: "other" }, { ...club, id: "pending-club", official_status: "pending" }, { ...club, id: "fixture-club", is_development: true }, { ...club, id: "archived-club", status: "archived" }, { ...club, id: "unconfirmed-club", confidence_level: "pending" }],
    organization_memberships: [{ organization_id: club.id, user_id: "owner", status: "member" }],
    organization_roles: [{ organization_id: club.id, user_id: "another-student", can_publish: true }],
    campus_events: [event, { ...event, id: "nearby-event", campus_id: "nearby" }, { ...event, id: "other-campus-event", campus_id: "other" }, { ...event, id: "cancelled-event", status: "cancelled" }],
  };
  const admin = {
    from(table) {
      queriedTables.push(table);
      const filters = [];
      let single = false;
      const chain = {
        select() { return chain; },
        eq(key, value) { filters.push((row) => row[key] === value); return chain; },
        in(key, values) { filters.push((row) => values.includes(row[key])); return chain; },
        order() { return chain; }, limit() { return chain; }, or() { return chain; },
        maybeSingle() { single = true; return chain; },
        then(resolve, reject) {
          const rows = (tables[table] ?? []).filter((row) => filters.every((filter) => filter(row)));
          return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: failTable === table ? new Error("Unavailable") : null }).then(resolve, reject);
        },
      };
      return chain;
    },
  };
  const bindings = {
    "next/server": { NextResponse: { json: Response.json } },
    "@/data/universities": { universities: { tamu: { accessibleCampuses: ["tamu", "nearby"] } } },
    "@/lib/supabase/server": {
      hasSupabaseServerConfig: () => configured,
      createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: "owner" } : null } }) } }),
      createSupabaseAdminClient: () => admin,
    },
  };
  const exports = {};
  new Function("require", "exports", compiled)((name) => {
    assert.ok(bindings[name], `Unexpected dependency: ${name}`);
    return bindings[name];
  }, exports);
  return { get: exports.GET, queriedTables, tables };
}

test("composer catalog is unavailable without a configured authenticated session", async () => {
  for (const [options, expectedStatus] of [[{ authenticated: false }, 401], [{ configured: false }, 503]]) {
    const app = route(options);
    assert.equal((await app.get()).status, expectedStatus);
    assert.deepEqual(app.queriedTables, []);
  }
});

test("composer catalog scopes trusted clubs/events to the authenticated campus without leaking contact fields", async () => {
  const app = route();
  const response = await app.get();
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(data.clubs, [{ id: "trusted-club", name: "Book club", canPublish: false }]);
  assert.deepEqual(data.events.map((event) => event.id), ["campus-event", "nearby-event"]);
  assert.equal(JSON.stringify(data).includes("private-contact"), false);
});

test("another user's club role never grants this viewer publish authority", async () => {
  const app = route();
  assert.equal((await (await app.get()).json()).clubs[0].canPublish, false);
  app.tables.organization_roles.push({ organization_id: "trusted-club", user_id: "owner", can_publish: true });
  assert.equal((await (await app.get()).json()).clubs[0].canPublish, true);
});

test("unknown campus returns an empty catalog and query errors do not masquerade as an empty successful catalog", async () => {
  const unknown = route({ campus: "unknown" });
  assert.deepEqual(await (await unknown.get()).json(), { ok: true, clubs: [], events: [] });
  assert.deepEqual(unknown.queriedTables, ["profile_identities"]);
  for (const failTable of ["profile_identities", "organizations", "organization_roles", "campus_events"]) {
    const response = await route({ failTable }).get();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).ok, false);
  }
});

test("only accepted membership grants a Club badge choice", async () => {
  for (const status of ["requested", "rejected", "left"]) {
    const app = route(); app.tables.organization_memberships[0].status = status;
    assert.deepEqual((await (await app.get()).json()).clubs, []);
  }
  const app = route(); app.tables.organization_memberships[0].user_id = "someone-else";
  assert.deepEqual((await (await app.get()).json()).clubs, []);
});
