import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as requestBody from "../lib/security/requestBody.ts";
import ts from "typescript";
import { normalizeProfileUpdate, persistProfile, profileValuesFromRow } from "../lib/auth/profilePersistence.ts";
import { getCampusAthleticsProfile, getCampusProgramCatalog } from "../data/sports/campus.ts";
import { validateUsername } from "../lib/social/usernames.ts";

const profileRow = {
  user_id: "user-one", first_name: "Sam", last_name: "", display_name: "Sam", username: "sam.student",
  bio: "A bio", major: "Physics", graduation_year: 2028, interests: ["Books"],
  created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
  profile_details: { academicArea: "Science", hobbies: ["Reading"], lookingForRoommate: true, roommatePreferences: ["Quiet"], offersTutoring: true, tutoringSubjects: ["Math"], classIds: ["math101"], clubIds: ["book-club"] },
};

function database(resolve, authError = null) {
  return {
    auth: { getUser: async () => ({ data: { user: authError ? null : { id: "user-one", email: "sam@tamu.edu", email_confirmed_at: "2026-09-01", app_metadata: { account_type: "student" } } }, error: authError }) },
    from(table) {
      const query = { table, operation: "select", filters: [] };
      const chain = {
        select() { return chain; },
        update(values) { query.operation = "update"; query.values = values; return chain; },
        upsert(values, options) { query.operation = "upsert"; query.values = values; query.options = options; return chain; },
        eq(key, value) { query.filters.push([key, value]); return chain; },
        is() { return chain; }, order() { return chain; }, limit() { return chain; }, maybeSingle() { return chain; },
        then(onFulfilled, onRejected) { return Promise.resolve(resolve(query)).then(onFulfilled, onRejected); },
      };
      return chain;
    },
  };
}

function loadRoute(name, db) {
  const modules = {
    "@/lib/security/requestBody": requestBody,
    "@/data/sports/campus": { getCampusAthleticsProfile, getCampusProgramCatalog },
    "next/server": { NextResponse: { json: Response.json } },
    "@/lib/auth/profilePersistence": { normalizeProfileUpdate, profileValuesFromRow },
    "@/lib/supabase/server": { hasSupabasePublicConfig: () => true, hasSupabaseServerConfig: () => true, createSupabaseServerClient: async () => db, createSupabaseAdminClient: () => db },
    "@/data/universities": { configuredUniversityIds: ["tamu"] },
    "@/data/userRoles": { userRoleOptions: [{ id: "student" }] },
    "@/types/accountCapabilities": { accountCapabilityValues: ["creator", "owner_campus_tester"] },
    "@/lib/auth/studentSmsPolicy": { isStudentSmsVerificationRequired: () => false },
    "@/lib/auth/accountTypes": { normalizeSafeBrandWebsite: (value) => value },
    "@/lib/auth/studentEmail": { assessStudentEmail: () => ({ ok: true, resolved: { identity: { knownUniversityId: "tamu" } } }) },
    "@/lib/social/usernames": { validateUsername },
  };
  const source = readFileSync(new URL(`../app/api/account/${name}/route.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  new Function("require", "exports", outputText)((id) => {
    assert.ok(id in modules, `Unexpected route dependency: ${id}`);
    return modules[id];
  }, exports);
  return exports;
}

const request = (body, method = "PATCH") => new Request("https://campusmint.test/api/account/profile", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("profile JSON cannot claim an unverified private avatar object", async () => {
  for (const path of ["another-user/photo.jpg", "user-one/../another-user/photo.jpg", "user-one/not-verified.jpg"]) {
    const writes = [];
    const db = database(query => {
      if (query.operation !== "select") writes.push(query);
      return { data: query.table === "profiles" ? profileRow : null, error: null };
    });
    assert.equal((await loadRoute("profile", db).PATCH(request({ photo: { storagePath: path } }))).status, 409);
    assert.equal(writes.length, 0);
    const signupDb = database(query => {
      if (query.operation !== "select") writes.push(query);
      return { data: null, error: null };
    });
    assert.equal((await loadRoute("complete", signupDb).POST(request({ accountType: "student", firstName: "Sam", username: "sam.student", profileImageStoragePath: path }, "POST"))).status, 409);
    assert.equal(writes.length, 0);
  }
});

test("single names remain single and all editable profile details round-trip", () => {
  const values = profileValuesFromRow(profileRow);
  const result = normalizeProfileUpdate(values);
  assert.equal(result.ok, true);
  assert.equal(result.update.last_name, "");
  assert.equal(result.update.display_name, "Sam");
  assert.deepEqual(profileValuesFromRow(result.update), values);
});

test("profile edits reject reserved and malformed usernames", () => {
  for (const username of ["admin", "support", "a", "sam..student", ".sam"]) {
    assert.equal(normalizeProfileUpdate({ firstName: "Sam", username }).ok, false);
  }
});

test("PATCH preserves omitted fields, accepts explicit clears, and is scoped to the session owner", async () => {
  let update;
  const db = database((query) => {
    assert.deepEqual(query.filters, [["user_id", "user-one"]]);
    if (query.operation === "update") { update = query.values; return { data: { ...profileRow, ...query.values }, error: null }; }
    return { data: profileRow, error: null };
  });
  const response = await loadRoute("profile", db).PATCH(request({ bio: null, graduationYear: null, photo: { storagePath: null, placeholderId: null }, user_id: "another-user" }));
  assert.equal(response.status, 200);
  assert.equal(update.bio, null);
  assert.equal(update.graduation_year, null);
  assert.equal(update.major, "Physics");
  assert.equal(update.first_name, "Sam");
  assert.equal("user_id" in update, false);
  assert.deepEqual((await response.json()).profile.hobbies, ["Reading"]);
});

test("PATCH never reports success for a missing or policy-blocked profile", async () => {
  for (const missingAt of ["select", "update"]) {
    const db = database((query) => ({ data: query.operation === missingAt ? null : profileRow, error: null }));
    const response = await loadRoute("profile", db).PATCH(request({ bio: "new" }));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).ok, false);
  }
});

test("profile save waits for server success and surfaces rejected/network saves", async () => {
  const values = profileValuesFromRow(profileRow);
  let finish;
  let resolved = false;
  const pending = persistProfile(values, () => new Promise((resolve) => { finish = resolve; })).then((result) => { resolved = true; return result; });
  await Promise.resolve();
  assert.equal(resolved, false);
  finish(Response.json({ ok: true, profile: values }));
  assert.equal((await pending).ok, true);
  assert.equal((await persistProfile(values, async () => Response.json({ ok: false, message: "That username is already taken." }, { status: 409 }))).error, "That username is already taken.");
  assert.equal((await persistProfile(values, async () => { throw new Error("offline"); })).ok, false);
  assert.equal((await persistProfile(values, async () => Response.json({ ok: true }))).ok, false);
});

test("account hydration treats database failures as retryable, not missing setup", async () => {
  for (const failingTable of ["account_capabilities", "profile_identities", "profiles", "profile_privacy_settings", "creator_profiles", "creator_applications"]) {
    const db = database(({ table }) => ({ data: table === "account_capabilities" ? [] : null, error: table === failingTable ? { message: "temporary outage" } : null }));
    const response = await loadRoute("me", db).GET();
    assert.equal(response.status, 503, failingTable);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal("onboardingComplete" in body, false);
  }
});

test("auth service outages differ from signed-out sessions", async () => {
  const outage = await loadRoute("me", database(() => null, { name: "AuthRetryableFetchError", status: 503 })).GET();
  assert.equal(outage.status, 503);
  const signedOut = await loadRoute("me", database(() => null, { name: "AuthSessionMissingError", status: 400 })).GET();
  assert.equal((await signedOut.json()).authenticated, false);
});

test("signing back in restores the same saved account and profile", async () => {
  const db = database(({ table }) => ({ error: null, data: table === "account_capabilities" ? [] : table === "profiles" ? profileRow : table === "profile_identities" ? { user_id: "user-one", university_id: "tamu", role: "student", verified_student: true, created_at: profileRow.created_at, updated_at: profileRow.updated_at } : null }));
  const response = await loadRoute("me", db).GET();
  const body = await response.json();
  assert.equal(body.onboardingComplete, true);
  assert.equal(body.user.account.id, "user-one");
  assert.equal(body.user.profile.lastName, "");
  assert.equal(body.user.profile.displayName, "Sam");
  assert.deepEqual(body.user.profile.hobbies, ["Reading"]);
});

test("repeated account completion does not overwrite a saved profile", async () => {
  const writes = [];
  const db = database((query) => {
    if (query.operation !== "select") writes.push(query);
    return { data: { user_id: "user-one" }, error: null };
  });
  const response = await loadRoute("complete", db).POST(request({ accountType: "student", firstName: "Sam", lastName: "", username: "sam.student" }, "POST"));
  assert.equal(response.status, 200);
  assert.equal(writes.length, 0);
});

test("new account completion stores a blank surname without duplicating the first name", async () => {
  const writes = [];
  const db = database((query) => {
    if (query.operation !== "select") writes.push(query);
    return { data: null, error: null };
  });
  const response = await loadRoute("complete", db).POST(request({ accountType: "student", firstName: "Sam", lastName: "", username: "sam.student" }, "POST"));
  assert.equal(response.status, 200);
  const saved = writes.find((query) => query.table === "profiles");
  assert.equal(saved.values.last_name, "");
  assert.equal(saved.values.display_name, "Sam");
  assert.equal(saved.options.ignoreDuplicates, true);
});
