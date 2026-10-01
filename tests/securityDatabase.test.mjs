import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Real PostgreSQL statements in an isolated WASM engine, never a production URL.
// Auth/Storage service schemas are small contract fixtures; Storage HTTP signed-
// token verification and live Supabase configuration still require staging QA.
let db;
let baselineTables;
const owner = '10000000-1111-4111-8111-111111111111';
const stranger = '20000000-1111-4111-8111-111111111111';
const administrator = '30000000-1111-4111-8111-111111111111';
const post = '40000000-1111-4111-8111-111111111111';
let nativeFixtureSequence = 0;
function nativeId() { return `a0000000-1111-4111-8111-${String(++nativeFixtureSequence).padStart(12, '0')}`; }
function nativeKeyId() { return Buffer.from(`native-key-${++nativeFixtureSequence}`.padEnd(32, '.')).toString('base64'); }
async function registrationChallenge(userId = owner, expires = "now() + interval '5 minutes'") {
  const id = nativeId();
  await asRole('service_role', null, `insert into public.native_attest_challenges(id,user_id,challenge,purpose,expires_at)
    values ('${id}','${userId}',repeat('c',43),'register',${expires})`);
  return id;
}
async function registeredKey(userId = owner) {
  const challenge = await registrationChallenge(userId);
  const keyId = nativeKeyId();
  await asRole('service_role', null, `select public.register_native_attest_key('${challenge}','${userId}','${keyId}','public fixture key','receipt','development')`);
  return keyId;
}
async function assertionChallenge(keyId, userId = owner, expires = "now() + interval '5 minutes'") {
  const id = nativeId();
  await asRole('service_role', null, `insert into public.native_attest_challenges(id,user_id,challenge,purpose,key_id,method,path,body_hash,expires_at)
    values ('${id}','${userId}',repeat('c',43),'assert','${keyId}','POST','/api/mintz',repeat('d',64),${expires})`);
  return id;
}
const consumeAssertion = (challenge, userId, keyId, previousCount, nextCount) => asRole('service_role', null,
  `select public.consume_native_assertion('${challenge}','${userId}','${keyId}',${previousCount},${nextCount})`);
const keyCounter = async keyId => (await asRole('service_role', null, `select sign_count from public.native_attest_keys where key_id='${keyId}'`)).rows[0]?.sign_count;
async function asRole(role, userId, sql) {
  try {
    await db.exec(`set role ${role}; set request.jwt.claim.sub = '${userId ?? ''}';`);
    return await db.query(sql);
  } finally { await db.exec('reset role; reset request.jwt.claim.sub;'); }
}
before(async () => {
  db = new PGlite({ extensions: { pg_trgm, pgcrypto } });
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
    grant all on storage.objects,storage.buckets to service_role;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    create publication supabase_realtime;
    create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path = pg_catalog as $$ begin end $$;
    -- Simulate legacy Supabase defaults: policies alone must not suffice.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `);
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const migrations = (await readdir(directory)).filter(file => file.endsWith('.sql')).sort();
  for (const migration of migrations) {
    await db.exec(await readFile(new URL(migration, directory), 'utf8'));
  }
  baselineTables = (await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`)).rows;
  await db.exec(`
    insert into auth.users(id) values ('${owner}'), ('${stranger}'), ('${administrator}');
    insert into public.profile_identities(user_id,university_id,role,verified_student,account_type)
      values ('${owner}','tamu','student',true,'student'),('${stranger}','tamu','student',true,'student'),('${administrator}','tamu','student',true,'student');
    insert into public.profiles(user_id,first_name,last_name,display_name,username,social_account_type)
      values ('${owner}','Owner','','Owner','rls.owner','private'),('${stranger}','Other','','Other','rls.other','public'),('${administrator}','Operator','','Operator','rls.operator','public');
    insert into public.profile_privacy_settings(user_id) values ('${owner}'), ('${stranger}');
    insert into public.social_content(id,kind,author_id,university_id,campus_network_id,content_type,caption,poll_definition)
      values ('${post}','mint','${owner}','tamu','bryan-college-station','text','Private question', '{"question":"Private?","options":[{"id":"1","label":"A"},{"id":"2","label":"B"}]}');
    insert into public.mints(content_id,privacy) values ('${post}','connections');
  `);
});
after(async () => { await db?.close(); });

test('all application tables have RLS and no browser mutation ACL, including legacy column ACLs', async () => {
  assert.ok(baselineTables.length >= 114);
  const leaks = await db.query(`
    select c.relname, r.rolname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    cross join pg_roles r where n.nspname='public' and c.relkind='r'
      and r.rolname in ('anon','authenticated') and (
        not c.relrowsecurity or has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege(r.oid,c.oid,'INSERT,UPDATE,REFERENCES'));
  `);
  assert.deepEqual(leaks.rows, []);
});

test('account hydration returns only caller profile, never another account', async () => {
  const own = await asRole('authenticated', owner, 'select user_id from public.profiles');
  assert.deepEqual(own.rows, [{ user_id: owner }]);
  await assert.rejects(asRole('anon', null, 'select user_id from public.profiles'), { code: '42501' });
  await assert.rejects(asRole('authenticated', owner, `update public.profile_identities set verified_student=true where user_id='${stranger}'`), { code: '42501' });
});

test('direct account-role, private-message, marketplace and moderation calls are denied', async () => {
  for (const relation of ['security_administrators','security_rate_limits','security_audit_events','phone_verification_challenges','direct_messages','marketplace_messages','marketplace_listings','web_authn_credentials','content_review_actions']) {
    await assert.rejects(asRole('authenticated', owner, `select * from public.${relation}`), { code: '42501' }, relation);
  }
  await assert.rejects(asRole('authenticated', owner, `select public.remove_organization_membership(gen_random_uuid(),'${stranger}')`), { code: '42501' });
  await assert.rejects(asRole('authenticated', owner, `select public.review_creator_application(gen_random_uuid(),'${owner}','approve',null)`), { code: '42501' });
});

test('hosted trigger helpers are not public RPCs and normalizers have fixed search paths', async () => {
  const { rows } = await db.query(`select has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') as anon,
    has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') as authenticated`);
  assert.deepEqual(rows, [{ anon: false, authenticated: false }]);
  const normalizers = await db.query(`select proconfig from pg_proc where pronamespace='public'::regnamespace and proname in ('normalize_organization_name','normalize_organization_handle')`);
  assert.equal(normalizers.rows.length, 2);
  for (const row of normalizers.rows) assert.ok(row.proconfig.some(value => value.startsWith('search_path=')));
});

test('new tables and functions default to no client grants', async () => {
  await db.exec('create table public.security_default_probe(id integer); create function public.security_default_rpc() returns integer language sql as $$ select 1 $$;');
  const result = await db.query(`select has_table_privilege('anon','public.security_default_probe','SELECT,INSERT,UPDATE,DELETE') as anonymous,
    has_table_privilege('authenticated','public.security_default_probe','SELECT,INSERT,UPDATE,DELETE') as signed_in,
    has_function_privilege('anon','public.security_default_rpc()','EXECUTE') as rpc;`);
  assert.deepEqual(result.rows, [{ anonymous: false, signed_in: false, rpc: false }]);
  await db.exec('drop table public.security_default_probe; drop function public.security_default_rpc();');
});

test('public catalog is readable but source registry and development records stay private', async () => {
  assert.ok((await asRole('anon', null, 'select id from public.universities')).rows.some(row => row.id === 'tamu'));
  await db.exec(`insert into public.universities(id,name,short_name,is_development,confidence_level) values ('rls-fixture','Fixture','Fixture',true,'official');`);
  assert.equal((await asRole('anon', null, `select id from public.universities where id='rls-fixture'`)).rows.length, 0);
  await assert.rejects(asRole('anon', null, 'select * from public.data_sources'), { code: '42501' });
});

test('Storage cannot be read or written directly even with a stray permissive rule', async () => {
  await db.exec(`create policy test_unsafe_policy on storage.objects for all to anon,authenticated using (true) with check (true);
    insert into storage.objects(bucket_id,name,owner_id) values ('mint-media','${owner}/private.mp4','${owner}');`);
  assert.equal((await asRole('authenticated', owner, 'select * from storage.objects')).rows.length, 0);
  await assert.rejects(asRole('authenticated', owner, `insert into storage.objects(bucket_id,name,owner_id) values ('mint-media','${owner}/forged.mp4','${owner}')`), { code: '42501' });
  assert.equal((await asRole('service_role', null, 'select * from storage.objects')).rows.length, 1);
  assert.ok((await db.query(`select public from storage.buckets`)).rows.every(row => row.public === false));
  await db.exec('drop policy test_unsafe_policy on storage.objects;');
});

test('unilateral follow cannot reveal private poll; accepted friendship can', async () => {
  await db.exec(`insert into public.profile_follows(follower_id,following_id) values ('${stranger}','${owner}');`);
  assert.equal((await asRole('service_role', null, `select public.can_read_mint_poll('${post}','${stranger}') allowed`)).rows[0].allowed, false);
  await db.exec(`insert into public.friendships(requester_id,addressee_id,status) values ('${stranger}','${owner}','friends');`);
  assert.equal((await asRole('service_role', null, `select public.can_read_mint_poll('${post}','${stranger}') allowed`)).rows[0].allowed, true);
  await db.exec(`insert into public.profile_blocks(blocker_id,blocked_id) values ('${owner}','${stranger}');`);
  assert.equal((await asRole('service_role', null, `select public.can_read_mint_poll('${post}','${stranger}') allowed`)).rows[0].allowed, false);
});

test('brand account email and internal reviewer notes are not browser-readable across users', async () => {
  await db.exec(`insert into public.brand_profiles(user_id,display_name,username,username_normalized,contact_email)
    values ('${administrator}','Brand','privatebrand','privatebrand','private@example.com');`);
  assert.equal((await asRole('authenticated',owner,'select contact_email from public.brand_profiles')).rows.length,0);
  assert.deepEqual((await asRole('authenticated',administrator,'select contact_email from public.brand_profiles')).rows,[{contact_email:'private@example.com'}]);
  await assert.rejects(asRole('authenticated',owner,'select review_notes from public.creator_applications'),{code:'42501'});
  assert.deepEqual((await asRole('authenticated',owner,'select id,status from public.creator_applications')).rows,[]);
});

test('canonical identity cannot be reassigned even through service-role profile mutation', async () => {
  await assert.rejects(db.exec(`update public.profile_identities set user_id='${stranger}' where user_id='${owner}'`), { code: '23514' });
  await assert.rejects(db.exec(`update public.profiles set user_id='${stranger}' where user_id='${owner}'`), { code: '23514' });
});

test('shared rate limit atomically allows only the configured count and rejects bad input', async () => {
  const results = await asRole('service_role', null, `select public.consume_security_rate_limit(repeat('a',64),2,3600) as result from generate_series(1,3)`);
  assert.deepEqual(results.rows.map(row => row.result.allowed), [true,true,false]);
  assert.deepEqual(results.rows.map(row => row.result.remaining), [1,0,0]);
  assert.ok(results.rows[2].result.retry_after_seconds > 0);
  await assert.rejects(asRole('authenticated', owner, `select public.consume_security_rate_limit(repeat('a',64),2,3600)`), { code: '42501' });
  await assert.rejects(asRole('service_role', null, `select public.consume_security_rate_limit('raw-ip',2,3600)`), { code: '22023' });
  await assert.rejects(asRole('service_role', null, `select public.consume_security_rate_limit(repeat('a',64),0,3600)`), { code: '22023' });
});

test('audit is append-only to service and pruning respects retention', async () => {
  await asRole('service_role', null, `insert into public.security_audit_events(actor_id,action,outcome) values ('${owner}','profile.update','allowed')`);
  await assert.rejects(asRole('service_role', null, `update public.security_audit_events set outcome='denied'`), { code: '42501' });
  await assert.rejects(asRole('service_role', null, `delete from public.security_audit_events`), { code: '42501' });
  await assert.rejects(asRole('service_role', null, `insert into public.security_audit_events(action,outcome,metadata) values ('test.large','error', jsonb_build_object('body',repeat('x',3000)))`), { code: '23514' });
  await db.exec(`insert into public.security_audit_events(action,outcome,created_at) values ('retention.expired','allowed',now()-interval '91 days');
    insert into public.security_rate_limits values (repeat('b',64),now()-interval '3 days',now()-interval '2 days',1);`);
  const result = await asRole('service_role', null, 'select public.prune_security_records() as result');
  assert.deepEqual(result.rows[0].result, { audit_events_deleted: 1, rate_buckets_deleted: 1 });
  assert.equal((await db.query('select count(*)::int n from public.security_audit_events')).rows[0].n,1);
});

test('reviewer capability by itself cannot grant creator status; no administrator is seeded', async () => {
  assert.equal((await db.query('select count(*)::int n from public.security_administrators')).rows[0].n, 0);
  await db.exec(`insert into public.account_capabilities(user_id,capability,granted_by) values ('${administrator}','creator_reviewer','${owner}');`);
  await assert.rejects(asRole('service_role', null, `select public.review_creator_application(gen_random_uuid(),'${administrator}','approve',null)`), /Creator reviewer authorization/);
  await assert.rejects(asRole('service_role', null, `insert into public.security_administrators(user_id,role) values ('${administrator}','security_admin')`), { code: '42501' });
});

test('native records and attestation RPCs are inaccessible to both browser roles', async () => {
  for (const role of ['anon', 'authenticated']) {
    for (const relation of ['native_auth_sessions', 'native_attest_keys', 'native_attest_challenges']) {
      await assert.rejects(asRole(role, owner, `select * from public.${relation}`), { code: '42501' }, `${role}:${relation}`);
    }
    await assert.rejects(asRole(role, owner, `select public.prune_native_challenges()`), { code: '42501' });
    await assert.rejects(asRole(role, owner, `select public.register_native_attest_key(gen_random_uuid(),'${owner}',repeat('k',44),'key','receipt','development')`), { code: '42501' });
    await assert.rejects(asRole(role, owner, `select public.consume_native_assertion(gen_random_uuid(),'${owner}',repeat('k',44),0,1)`), { code: '42501' });
  }
  // Even trusted API code cannot overwrite an enrolled key or its counter via CRUD.
  await assert.rejects(asRole('service_role', null, `update public.native_attest_keys set public_key='forged'`), { code: '42501' });
  await assert.rejects(asRole('service_role', null, `delete from public.native_attest_challenges`), { code: '42501' });
});

test('registration challenge is owner-scoped, single-use, and rolls back if key insertion fails', async () => {
  const challenge = await registrationChallenge();
  const key = nativeKeyId();
  const register = (userId, keyId) => asRole('service_role', null,
    `select public.register_native_attest_key('${challenge}','${userId}','${keyId}','public fixture key','receipt','development')`);
  await assert.rejects(register(stranger, key), /Challenge unavailable/);
  assert.equal((await db.query(`select count(*)::int n from public.native_attest_challenges where id='${challenge}'`)).rows[0].n, 1);
  await assert.rejects(register(owner, 'invalid-key'), { code: '23514' });
  assert.equal((await db.query(`select count(*)::int n from public.native_attest_challenges where id='${challenge}'`)).rows[0].n, 1);
  await register(owner, key);
  await assert.rejects(register(owner, nativeKeyId()), /Challenge unavailable/);
  const expired = await registrationChallenge(owner, "now() - interval '1 second'");
  await assert.rejects(asRole('service_role', null,
    `select public.register_native_attest_key('${expired}','${owner}','${nativeKeyId()}','key','receipt','development')`), /Challenge unavailable/);
});

test('native assertion consumes a challenge once and atomically compares the counter', async () => {
  const key = await registeredKey();
  const first = await assertionChallenge(key);
  const second = await assertionChallenge(key);
  await consumeAssertion(first, owner, key, 0, 1);
  assert.equal(Number(await keyCounter(key)), 1);
  // A concurrent request verified against the previous counter must lose its CAS.
  await assert.rejects(consumeAssertion(second, owner, key, 0, 2), /Assertion replay/);
  assert.equal(Number(await keyCounter(key)), 1);
  assert.equal((await db.query(`select count(*)::int n from public.native_attest_challenges where id='${second}'`)).rows[0].n, 1);
  // A consumed challenge cannot be reused with a freshly chosen higher counter.
  await assert.rejects(consumeAssertion(first, owner, key, 1, 2), /Challenge unavailable/);
  assert.equal(Number(await keyCounter(key)), 1, 'failed consumption must roll back the counter update');
  await consumeAssertion(second, owner, key, 1, 2);
  assert.equal(Number(await keyCounter(key)), 2);
});

test('native assertions reject wrong users, mismatched keys, revoked keys, expiry and non-increasing counters', async () => {
  const key = await registeredKey();
  const otherKey = await registeredKey(stranger);
  const challenge = await assertionChallenge(key);
  await assert.rejects(consumeAssertion(challenge, stranger, key, 0, 1), /Assertion replay/);
  await assert.rejects(consumeAssertion(challenge, stranger, otherKey, 0, 1), /Challenge unavailable/);
  assert.equal(Number(await keyCounter(otherKey)), 0, 'wrong challenge must not advance another key');
  for (const next of [0, -1]) await assert.rejects(consumeAssertion(challenge, owner, key, 0, next), /Invalid counter/);
  const expired = await assertionChallenge(key, owner, "now() - interval '1 second'");
  await assert.rejects(consumeAssertion(expired, owner, key, 0, 1), /Challenge unavailable/);
  assert.equal(Number(await keyCounter(key)), 0);
  await db.exec(`update public.native_attest_keys set revoked_at=now() where key_id='${key}'`);
  await assert.rejects(consumeAssertion(challenge, owner, key, 0, 1), /Assertion replay/);
  assert.equal(Number(await keyCounter(key)), 0);
});

test('native enrollment enforces device limit and key uniqueness without losing retry challenges', async () => {
  const userId = '70000000-1111-4111-8111-111111111111';
  await db.exec(`insert into auth.users(id) values ('${userId}')`);
  const keys = [];
  for (let i = 0; i < 10; i++) keys.push(await registeredKey(userId));
  const challenge = await registrationChallenge(userId);
  const register = key => asRole('service_role', null,
    `select public.register_native_attest_key('${challenge}','${userId}','${key}','key','receipt','development')`);
  await assert.rejects(register(nativeKeyId()), /Device limit reached/);
  await db.exec(`update public.native_attest_keys set revoked_at=now() where key_id='${keys[0]}'`);
  await assert.rejects(register(keys[1]), { code: '23505' });
  await register(nativeKeyId());
  assert.equal((await db.query(`select count(*)::int n from public.native_attest_keys where user_id='${userId}' and revoked_at is null`)).rows[0].n, 10);
});

test('native pruning removes expired challenges and old sessions, preserving active sessions and keys', async () => {
  const activeChallenge = await registrationChallenge();
  const expiredChallenge = await registrationChallenge(owner, "now() - interval '1 second'");
  const currentSession = nativeId();
  const oldSession = nativeId();
  await asRole('service_role', null, `insert into public.native_auth_sessions(session_id,user_id,expires_at) values
    ('${currentSession}','${owner}',now()+interval '1 hour'),('${oldSession}','${owner}',now()-interval '31 days')`);
  const keysBefore = (await db.query('select count(*)::int n from public.native_attest_keys')).rows[0].n;
  await asRole('service_role', null, 'select public.prune_native_challenges()');
  assert.equal((await db.query(`select count(*)::int n from public.native_attest_challenges where id='${activeChallenge}'`)).rows[0].n, 1);
  assert.equal((await db.query(`select count(*)::int n from public.native_attest_challenges where id='${expiredChallenge}'`)).rows[0].n, 0);
  assert.deepEqual((await db.query('select session_id from public.native_auth_sessions')).rows, [{ session_id: currentSession }]);
  assert.equal((await db.query('select count(*)::int n from public.native_attest_keys')).rows[0].n, keysBefore);
});

test('deleting an otherwise unreferenced account removes its native keys, challenges and session markers', async () => {
  // Other business records can intentionally restrict full account deletion;
  // this isolates the native ownership FK contract, not the full deletion job.
  const userId = '80000000-1111-4111-8111-111111111111';
  await db.exec(`insert into auth.users(id) values ('${userId}')`);
  await registeredKey(userId);
  await registrationChallenge(userId);
  await asRole('service_role', null, `insert into public.native_auth_sessions(session_id,user_id,expires_at)
    values ('${nativeId()}','${userId}',now()+interval '1 hour')`);
  await db.exec(`delete from auth.users where id='${userId}'`);
  for (const table of ['native_auth_sessions', 'native_attest_keys', 'native_attest_challenges']) {
    assert.equal((await db.query(`select count(*)::int n from public.${table} where user_id='${userId}'`)).rows[0].n, 0, table);
  }
});

test('Places identity is unique and private; unshipped community mutations remain denied even to the service', async () => {
  const placeId = '90000000-1111-4111-8111-111111111111';
  await asRole('service_role', null, `insert into public.place_identity(id,google_place_id) values ('${placeId}','test_place_id')`);
  await assert.rejects(asRole('service_role', null, `insert into public.place_identity(google_place_id) values ('test_place_id')`), { code: '23505' });
  await assert.rejects(asRole('service_role', null, `insert into public.place_identity(google_place_id) values ('https://provider.example/place')`), { code: '23514' });
  for (const role of ['anon', 'authenticated']) {
    for (const table of ['place_identity', 'place_areas', 'place_saves', 'place_student_reviews', 'place_student_photos']) {
      await assert.rejects(asRole(role, owner, `select * from public.${table}`), { code: '42501' }, `${role}:${table}`);
    }
  }
  await assert.rejects(asRole('service_role', null, `insert into public.place_saves(user_id,place_id) values ('${owner}','${placeId}')`), { code: '42501' });
  await assert.rejects(asRole('service_role', null, `insert into public.place_student_reviews(user_id,place_id,campus_id,rating,body)
    values ('${owner}','${placeId}','tamu',5,'Unreviewed')`), { code: '42501' });
  await assert.rejects(asRole('service_role', null, `insert into public.place_student_photos(user_id,place_id,campus_id,storage_object_path)
    values ('${owner}','${placeId}','tamu','unvalidated/file.jpg')`), { code: '42501' });
});

test('read-only live drift inventory executes against the complete schema without changing it', async () => {
  const sql = await readFile(new URL('../scripts/security/live-drift.sql', import.meta.url), 'utf8');
  const before = (await db.query('select count(*)::int n from public.security_audit_events')).rows;
  await db.exec(sql);
  assert.deepEqual((await db.query('select count(*)::int n from public.security_audit_events')).rows, before);
});

test('private clubs enforce owner/admin/member permissions, explicit invitations and campus scope', async () => {
  // Earlier privacy tests intentionally left a block in place.
  await db.exec(`delete from public.profile_blocks where blocker_id='${owner}' and blocked_id='${stranger}'`);
  const call = (actor, action, club = null, target = null, data = {}) => asRole('service_role', null,
    `select public.mutate_club('${actor}','${action}',${club ? `'${club}'` : 'null'},${target ? `'${target}'` : 'null'},'${JSON.stringify(data).replaceAll("'","''")}'::jsonb) id`);
  const club = (await call(owner,'create',null,null,{name:'Security Test Club',handle:'security-test-club',description:'Private club details'})).rows[0].id;
  assert.deepEqual((await db.query(`select visibility,member_count from public.organizations where id='${club}'`)).rows,[{visibility:'private',member_count:1}]);
  for (const role of ['anon','authenticated']) {
    assert.equal((await asRole(role,stranger,`select id from public.organizations where id='${club}'`)).rows.length,0);
    await assert.rejects(asRole(role,owner,`select public.mutate_club('${owner}','approve','${club}','${stranger}')`),{code:'42501'});
    await assert.rejects(asRole(role,owner,'select * from public.club_invitations'),{code:'42501'});
  }
  await call(stranger,'request',club);
  await assert.rejects(call(stranger,'approve',club,stranger),{code:'42501'});
  await assert.rejects(call(stranger,'invite',club,administrator),{code:'42501'});
  await call(owner,'approve',club,stranger);
  await call(owner,'promote',club,stranger);
  await assert.rejects(call(stranger,'remove',club,owner),{code:'42501'});
  await assert.rejects(call(stranger,'promote',club,administrator),{code:'42501'});
  await assert.rejects(call(stranger,'update',club,null,{name:'Test club',description:'Details',visibility:'public'}),{code:'42501'});
  await call(stranger,'invite',club,administrator);
  assert.equal((await db.query(`select 1 from public.organization_memberships where organization_id='${club}' and user_id='${administrator}'`)).rows.length,0);
  await call(administrator,'accept_invite',club);
  await assert.rejects(call(administrator,'accept_invite',club),{code:'42501'});
  await call(owner,'promote',club,administrator);
  await assert.rejects(call(stranger,'remove',club,administrator),{code:'42501'});
  await call(owner,'demote',club,administrator);
  const conversation = (await db.query(`insert into public.conversations(kind,organization_id,created_by) values ('organization_group','${club}','${owner}') returning id`)).rows[0].id;
  await db.exec(`insert into public.conversation_participants(conversation_id,user_id) values('${conversation}','${administrator}')`);
  await call(stranger,'remove',club,administrator);
  assert.equal((await db.query(`select 1 from public.organization_roles where organization_id='${club}' and user_id='${administrator}'`)).rows.length,0);
  assert.ok((await db.query(`select removed_at from public.conversation_participants where conversation_id='${conversation}' and user_id='${administrator}'`)).rows[0].removed_at);
  await db.exec(`update public.profile_identities set university_id='texas' where user_id='${administrator}'`);
  await assert.rejects(call(administrator,'request',club),{code:'42501'});
  await assert.rejects(call(owner,'invite',club,administrator),{code:'42501'});
  await db.exec(`update public.profile_identities set university_id='tamu' where user_id='${administrator}'; insert into public.profile_blocks(blocker_id,blocked_id) values('${owner}','${administrator}')`);
  await assert.rejects(call(administrator,'request',club),{code:'42501'});
  await assert.rejects(call(owner,'leave',club),{code:'42501'});
  await call(stranger,'leave',club);
  assert.equal((await db.query(`select member_count from public.organizations where id='${club}'`)).rows[0].member_count,1);
  await call(owner,'update',club,null,{name:'Security Test Club',description:'Now public',visibility:'public'});
  assert.equal((await db.query(`select visibility from public.organizations where id='${club}'`)).rows[0].visibility,'public');
});
