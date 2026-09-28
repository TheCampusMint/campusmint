/**
 * Runs the actual poll migration against isolated PostgreSQL (PGlite), never production.
 * npm install --prefix /tmp/campusmint-poll-db --ignore-scripts @electric-sql/pglite@0.4.6
 * PGLITE_RUNTIME=/tmp/campusmint-poll-db/node_modules/@electric-sql/pglite/dist/index.js node --test tests/communityPolls.database.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { after, before, test } from "node:test";

if (!process.env.PGLITE_RUNTIME) throw new Error("Set PGLITE_RUNTIME to the temporary PGlite runtime; see the command at the top of this file.");
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_RUNTIME).href);
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const voter = "22222222-2222-4222-8222-222222222222";
const outsider = "33333333-3333-4333-8333-333333333333";
const unverified = "44444444-4444-4444-8444-444444444444";
const creator = "55555555-5555-4555-8555-555555555555";
const mint = "99999999-9999-4999-8999-999999999999";
const org = "88888888-8888-4888-8888-888888888888";
const definition = { question: "Study together?", options: [{ id: "1", label: "Library" }, { id: "2", label: "Cafe" }] };

before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.profiles(user_id uuid primary key, social_account_type text not null default 'public');
    create table public.profile_identities(user_id uuid primary key, university_id text, account_type text, verified_student boolean);
    create table public.account_capabilities(user_id uuid, capability text, revoked_at timestamptz);
    create table public.social_content(id uuid primary key, author_id uuid, kind text default 'mint', status text default 'active', university_id text,
      organization_id uuid, organization_audience text default 'public', expires_at timestamptz);
    create table public.mints(content_id uuid primary key references public.social_content(id) on delete cascade, privacy text default 'account', archived_at timestamptz);
    create table public.profile_blocks(blocker_id uuid, blocked_id uuid);
    create table public.profile_follows(follower_id uuid, following_id uuid);
    create table public.friendships(requester_id uuid, addressee_id uuid, status text);
    create table public.organization_memberships(organization_id uuid, user_id uuid, status text);
  `);
  await db.exec(readFileSync(new URL("../supabase/migrations/20260927002300_community_polls.sql", import.meta.url), "utf8"));
  for (const [userId, campus, verified] of [[owner, "tamu", true], [voter, "tamu", true], [outsider, "texas", true], [unverified, "tamu", false], [creator, null, false]]) {
    await db.query("insert into profiles(user_id) values ($1);", [userId]);
    await db.query("insert into profile_identities values ($1,$2,'student',$3);", [userId, campus, verified]);
  }
  await db.query("insert into account_capabilities values ($1,'creator',null)", [creator]);
  await db.query("insert into social_content(id,author_id,university_id,poll_definition) values ($1,$2,'tamu',$3::jsonb)", [mint, owner, JSON.stringify(definition)]);
  await db.query("insert into mints(content_id) values ($1)", [mint]);
});
after(async () => { await db.close(); });

async function read(userId = voter) { return (await db.query("select public.read_mint_poll($1,$2) as poll", [mint, userId])).rows[0].poll; }
async function vote(userId, optionId) { return (await db.query("select public.vote_mint_poll($1,$2,$3) as poll", [mint, userId, optionId])).rows[0].poll; }
async function denied(operation, code = "P0002") { await assert.rejects(operation, (error) => error.code === code); }

test("database rejects invalid definitions and prevents editing answers after publishing", async () => {
  assert.equal((await db.query("select public.valid_mint_poll_definition($1::jsonb) as valid", [JSON.stringify(definition)])).rows[0].valid, true);
  for (const value of [[], {}, { question: "", options: definition.options }, { question: "x", options: [] },
    { ...definition, options: [{ id: "1", label: "A" }, { id: "1", label: "B" }] },
    { ...definition, options: [{ id: "1", label: "A" }, { id: "2", label: " a " }] }]) {
    assert.equal((await db.query("select public.valid_mint_poll_definition($1::jsonb) as valid", [JSON.stringify(value)])).rows[0].valid, false);
  }
  await denied(() => db.query("update social_content set poll_definition = $2::jsonb where id = $1", [mint, JSON.stringify({ ...definition, question: "Changed" })]), "22023");
});

test("account votes persist, retries do not inflate totals, and a changed choice moves only that account vote", async () => {
  assert.equal((await read()).totalVotes, 0);
  await Promise.all(Array.from({ length: 12 }, () => vote(voter, "1")));
  let result = await read();
  assert.equal(result.totalVotes, 1);
  assert.equal(result.selectedOptionId, "1");
  result = await vote(voter, "2");
  assert.equal(result.totalVotes, 1);
  assert.deepEqual(result.options.map((option) => option.voteCount), [0, 1]);
  await vote(owner, "1");
  result = await read();
  assert.equal(result.totalVotes, 2);
  assert.deepEqual(result.options.map((option) => option.voteCount), [1, 1]);
  assert.equal((await read(owner)).selectedOptionId, "1");
  assert.deepEqual(Object.keys(result).sort(), ["options", "question", "selectedOptionId", "totalVotes"]);
  await denied(() => vote(voter, "6"), "22023");
  assert.equal((await read()).totalVotes, 2);
});

test("a private author profile gates even public polls and permits only owner or eligible connections", async () => {
  await db.query("update profiles set social_account_type = 'private' where user_id = $1", [owner]);
  await db.query("update mints set privacy = 'public' where content_id = $1", [mint]);
  await denied(() => read(voter));
  await denied(() => vote(voter, "1"));
  await denied(() => read(outsider));
  assert.equal((await read(owner)).totalVotes, 2);
  for (const [follower, following] of [[owner, voter], [voter, owner]]) {
    await db.query("insert into profile_follows values ($1,$2)", [follower, following]);
    assert.equal((await read(voter)).totalVotes, 2);
    await db.exec("delete from profile_follows");
  }
  await db.query("insert into friendships values ($1,$2,'friends')", [owner, voter]);
  assert.equal((await read(voter)).totalVotes, 2);
  await db.exec("delete from friendships");
  await db.query("update profiles set social_account_type = 'public' where user_id = $1", [owner]);
  await db.query("update mints set privacy = 'account' where content_id = $1", [mint]);
});

test("poll authorization enforces campus, private, connections, memberships and both block directions", async () => {
  await denied(() => read(outsider));
  await db.query("update mints set privacy = 'private' where content_id = $1", [mint]);
  await denied(() => vote(voter, "1"));
  assert.equal((await read(owner)).totalVotes, 2);
  await db.query("update mints set privacy = 'connections' where content_id = $1", [mint]);
  await denied(() => read());
  await db.query("insert into profile_follows values ($1,$2)", [voter, owner]);
  assert.equal((await read()).totalVotes, 2);
  await db.exec("delete from profile_follows");
  await db.query("insert into friendships values ($1,$2,'friends')", [owner, voter]);
  assert.equal((await read()).totalVotes, 2);
  await db.exec("delete from friendships");
  await db.query("update mints set privacy = 'public' where content_id = $1", [mint]);
  assert.equal((await read(outsider)).totalVotes, 2);
  await db.query("update social_content set organization_id = $2, organization_audience = 'members' where id = $1", [mint, org]);
  await denied(() => read(outsider));
  await db.query("insert into organization_memberships values ($1,$2,'member')", [org, outsider]);
  assert.equal((await read(outsider)).totalVotes, 2);
  await db.query("update social_content set organization_id = null, organization_audience = 'public' where id = $1", [mint]);
  for (const [a, b] of [[owner, voter], [voter, owner]]) {
    await db.query("insert into profile_blocks values ($1,$2)", [a, b]);
    await denied(() => vote(voter, "1"));
    await denied(() => read(voter));
    await db.exec("delete from profile_blocks");
  }
});

test("voting requires verified identity or active Creator capability; no client role can invoke privileged RPCs or read voters", async () => {
  assert.equal((await read(unverified)).totalVotes, 2);
  await denied(() => vote(unverified, "1"), "42501");
  assert.equal((await vote(creator, "2")).totalVotes, 3);
  await db.query("update account_capabilities set revoked_at = now() where user_id = $1", [creator]);
  await denied(() => vote(creator, "1"), "42501");
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    try {
      await denied(() => read(voter), "42501");
      await denied(() => vote(voter, "1"), "42501");
      await denied(() => db.query("select * from public.mint_poll_votes"), "42501");
    } finally { await db.exec("reset role"); }
  }
  await db.exec("set role service_role");
  try { assert.equal((await read(voter)).totalVotes, 3); }
  finally { await db.exec("reset role"); }
});

test("expired, removed and archived polls stop reads/votes without erasing previous votes", async () => {
  await db.query("update social_content set expires_at = now() - interval '1 second' where id = $1", [mint]);
  await denied(() => vote(voter, "1"));
  await denied(() => read(owner));
  await db.query("update social_content set expires_at = null, status = 'removed' where id = $1", [mint]);
  await denied(() => read());
  await db.query("update social_content set status = 'active' where id = $1", [mint]);
  await db.query("update mints set archived_at = now() where content_id = $1", [mint]);
  await denied(() => read());
  await db.query("update mints set archived_at = null where content_id = $1", [mint]);
  assert.equal((await read()).totalVotes, 3);
});
