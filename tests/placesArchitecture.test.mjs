import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createSessionRequestStore, createSingleFlight } from '../lib/providers/places/requestStore.ts';
import { distinctPlaceIds, identityRows, placeAreaKey, validPlaceId } from '../lib/providers/places/identity.ts';
import * as nearby from '../lib/discovery/nearby.ts';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function compile(path, bindings, fetcher = fetch, logger = console) {
  const exports = {};
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', 'fetch', 'console', code)(name => { assert.ok(name in bindings, `Unexpected dependency: ${name}`); return bindings[name]; }, exports, fetcher, logger);
  return exports;
}
function provider(fetcher, allowed = true) {
  const requests = [], logs = [];
  const api = compile('lib/providers/places/google.ts', { 'server-only': {}, '@/lib/discovery/nearby': nearby, './requestStore': { createSingleFlight }, './identity': { validPlaceId }, '@/lib/security/server': { consumeRateLimit: async () => ({ allowed, retryAfter: 60 }) } }, async (url, init) => { requests.push({ url, init }); return fetcher(url, init); }, { info: line => logs.push(JSON.parse(line)) });
  return { ...api, requests, logs };
}
const origin = { latitude: 30.62, longitude: -96.34 };
test('legacy address search shares budgets and minimizes provider fields without durable Google labels', async () => {
  const calls = [];
  const place = { id: 'ChIJ123', displayName: { text: 'Cafe' }, formattedAddress: 'Main', rating: 5, photos: ['private'], googleMapsUri: 'javascript:bad', attributions: [{ provider: 'Source', providerUri: 'https://source.test' }] };
  const api = compile('lib/providers/places/googlePlaces.ts', { 'server-only': {}, './google': {
    placesConfigured: () => true,
    googleRequest: async (...args) => { calls.push(args); return { places: [place, place] }; },
  }, './requestStore': { createSingleFlight }, './identity': { validPlaceId }, '@/lib/discovery/nearby': nearby });
  const provider = api.createGooglePlacesProvider('test-key');
  const [a,b] = await Promise.all([provider.search({query:'coffee',universityId:'tamu'}),provider.search({query:'coffee',universityId:'tamu'})]);
  assert.equal(a, b); assert.equal(a.length, 1); assert.equal(calls.length, 1);
  assert.equal(a[0].googleMapsUri, null); assert.equal(a[0].rating, undefined); assert.equal(a[0].photos, undefined);
  assert.deepEqual(calls[0].slice(0,2), ['search','text-location']);
  assert.doesNotMatch(calls[0][4], /rating|photos|reviews|\*/);
  await assert.rejects(provider.search({query:'coffee',universityId:'__proto__'}));
  await assert.rejects(provider.search({query:'x'.repeat(201),universityId:'tamu'}));
  const picker = read('components/content/PlacePicker.tsx');
  assert.match(picker, /onChange\(query.trim\(\)\)/);
  assert.doesNotMatch(picker, /onChange\(place\./);
});

test('legacy search denies unauthenticated or malformed requests before contacting Google', async () => {
  let user = null, calls = 0;
  const api = compile('app/api/places/search/route.ts', {
    'next/server': { NextResponse: { json: Response.json } }, '@/data/universities': { universities: { tamu: {} } },
    '@/lib/providers/places/googlePlaces': { createGooglePlacesProvider: () => ({search: async () => { calls++; return []; }}) },
    '@/lib/providers/places/google': { placesConfigured: () => false },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({auth:{getUser:async()=>({data:{user}})}}) },
  });
  const request = suffix => new Request('https://campus.test/api/places/search' + suffix);
  assert.equal((await api.GET(request('?query=coffee&universityId=tamu'))).status,401);
  user = {id:'student'};
  assert.equal((await api.GET(request('?query=coffee&universityId=__proto__'))).status,400);
  assert.equal((await api.GET(request('?query=x&universityId=tamu'))).status,400);
  const response = await api.GET(request('?query=coffee&universityId=tamu'));
  assert.equal(response.status,503); assert.match(response.headers.get('cache-control'),/no-store/); assert.equal(calls,0);
});
test('durable records contain only deduplicated Google IDs and coarse owned area context', () => {
  assert.deepEqual(distinctPlaceIds(['ChIJ123', 'ChIJ123', null, 'places/name', 'ChIJ456']), ['ChIJ123', 'ChIJ456']);
  assert.deepEqual(identityRows(['ChIJ123', 'ChIJ123']), [{ google_place_id: 'ChIJ123' }]);
  assert.equal(placeAreaKey({ latitude: 30.623451, longitude: -96.334561 }), 'area:30.6:-96.3');
});
test('simultaneous components, rerenders, and navigation reuse the same session request', async () => {
  const store = createSessionRequestStore(); let calls = 0;
  const load = async () => { calls++; return { places: ['same'] }; };
  const [one, two] = await Promise.all([store.get('search:area:All', load), store.get('search:area:All', load)]);
  assert.equal(one, two);
  await store.get('search:area:All', load);
  await store.get('search:other:All', load);
  await store.get('search:area:All', load);
  assert.equal(calls, 2);
  store.invalidate('search:area:All'); await store.get('search:area:All', load); assert.equal(calls, 3);
  store.clear(); await store.get('search:area:All', load); assert.equal(calls, 4);
});
test('provider failure is retained until explicit retry, with no remount retry loop', async () => {
  const store = createSessionRequestStore(); let calls = 0;
  const fail = async () => { calls++; throw new Error('provider down'); };
  await assert.rejects(store.get('details:one', fail));
  await assert.rejects(store.get('details:one', fail));
  assert.equal(calls, 1);
  store.invalidate('details:one'); await assert.rejects(store.get('details:one', fail)); assert.equal(calls, 2);
});
test('server shares only in-flight requests, not completed provider content', async () => {
  const run = createSingleFlight(); let calls = 0, resolve;
  const load = () => { calls++; return new Promise(done => { resolve = done; }); };
  const a = run('nearby', load), b = run('nearby', load);
  await Promise.resolve(); assert.equal(calls, 1); resolve('ok');
  assert.deepEqual(await Promise.all([a,b]), ['ok','ok']);
  await run('nearby', async () => { calls++; return 'fresh'; }); assert.equal(calls, 2);
});
test('search deduplicates IDs and returns a usable rated list without details, photos, or reviews fanout', async () => {
  const place = { id: 'ChIJ123', displayName: { text: 'Lunch' }, formattedAddress: 'Main', location: origin, rating: 4.5, userRatingCount: 24 };
  const app = provider(async () => Response.json({ places: [place, place] }));
  const list = await app.googleNearby(origin, 'All', 'server-secret');
  assert.equal(list.length, 1); assert.equal(list[0].googlePlaceId, 'ChIJ123'); assert.equal(list[0].rating, 4.5);
  assert.equal(app.requests.length, 1); assert.equal(list[0].image, undefined);
  const mask = app.requests[0].init.headers['X-Goog-FieldMask'];
  assert.doesNotMatch(mask, /reviews|photos|editorialSummary|websiteUri|\*/);
  assert.equal(app.requests[0].init.cache, 'no-store');
  assert.deepEqual(app.logs.map(log => log.operation), ['search']);
  assert.equal(JSON.stringify(app.logs).includes('server-secret'), false);
  assert.equal(JSON.stringify(app.logs).includes('30.62'), false);
});
test('reviews are a separate explicitly measured request and never an eager details field', async () => {
  const app = provider(async () => Response.json({ id: 'ChIJ123', websiteUri: 'https://place.test', reviews: [] }));
  await app.googleDetails('ChIJ123', 'key'); await app.googleReviews('ChIJ123', 'key');
  assert.doesNotMatch(app.requests[0].init.headers['X-Goog-FieldMask'], /reviews|editorialSummary/);
  assert.match(app.requests[1].init.headers['X-Goog-FieldMask'], /reviews/);
  assert.deepEqual(app.logs.map(log => log.variant), ['contact-hours', 'reviews']);
});
test('photos resolve a fresh resource name lazily, expose no key/reference, and are measured separately', async () => {
  const app = provider(async url => url.includes('/media?') ? Response.json({ photoUri: 'https://lh3.googleusercontent.com/photo' }) : Response.json({ photos: [{ name: 'places/ChIJ123/photos/fresh_resource', googleMapsUri: 'https://maps.google.com/photo', authorAttributions: [{ displayName: 'Student', uri: 'https://maps.google.com/author' }] }] }));
  const photo = await app.googlePhoto('ChIJ123', 0, 'secret');
  assert.equal(photo.url, 'https://lh3.googleusercontent.com/photo'); assert.equal(photo.authors[0].name, 'Student');
  assert.doesNotMatch(JSON.stringify(photo), /fresh_resource|secret/);
  assert.deepEqual(app.logs.map(log => log.operation), ['details', 'photo']);
  await app.googlePhoto('ChIJ123', 0, 'secret'); assert.equal(app.requests.length, 4);
  const ui = read('components/discovery/NearbyDiscovery.tsx');
  assert.match(ui, /IntersectionObserver/); assert.match(ui, /rootMargin: "0px"/);
  assert.match(ui, /index=\$\{index\}`.*, visible\)/);
  assert.match(ui, /extraPhotos < 4/);
});
test('invalid photo hosts and provider failures never silently retry or expose provider errors', async () => {
  const failing = provider(async () => new Response('credential detail', { status: 403 }));
  await assert.rejects(failing.googleNearby(origin, 'All', 'key'), /Places provider unavailable/);
  assert.equal(failing.requests.length, 1); assert.equal(failing.logs[0].status, 403);
  const badPhoto = provider(async url => url.includes('/media?') ? Response.json({ photoUri: 'https://evil.test/photo' }) : Response.json({ photos: [{ name: 'places/ChIJ123/photos/fresh' }] }));
  await assert.rejects(badPhoto.googlePhoto('ChIJ123', 0, 'key'), /Invalid provider photo/);
});
test('paid routes require authenticated user and a server-discovered identity', async () => {
  let user = null, known = false, calls = 0;
  const bindings = { 'next/server': { NextResponse: { json: Response.json } }, '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }, '@/lib/providers/places/google': { placesConfigured: () => true, googleDetails: async () => { calls++; return {}; }, googleReviews: async () => { calls++; return {}; } }, '@/lib/providers/places/identity': { validPlaceId }, '@/lib/providers/places/registry': { knownPlace: async () => known } };
  const api = compile('app/api/places/[placeId]/route.ts', bindings);
  const context = { params: Promise.resolve({ placeId: 'ChIJ123' }) }, request = new Request('https://campus.test/api/places/ChIJ123');
  assert.equal((await api.GET(request, context)).status, 401);
  user = { id: 'user' }; assert.equal((await api.GET(request, context)).status, 404); assert.equal(calls, 0);
  known = true; assert.equal((await api.GET(request, context)).status, 200); assert.equal(calls, 1);
  assert.equal((await api.GET(new Request('https://campus.test/api/places/ChIJ123?view=all'), context)).status, 400); assert.equal(calls, 1);
});
test('no polling/storage cache and community tables cannot become a Google mirror', () => {
  const location = read('hooks/useNearbyLocation.ts');
  assert.doesNotMatch(location, /watchPosition|setInterval|addEventListener/); assert.match(location, /getCurrentPosition/);
  const session = read('lib/providers/places/session.ts');
  assert.doesNotMatch(session, /localStorage|sessionStorage|indexedDB/);
  const sql = read('supabase/migrations/20260928002900_place_identity.sql');
  assert.match(sql, /google_place_id text not null unique/);
  assert.match(sql, /from public, anon, authenticated, service_role/);
  for (const table of ['place_identity', 'place_areas', 'place_saves', 'place_student_reviews', 'place_student_photos']) assert.ok(sql.includes(`alter table public.${table} enable row level security`));
  assert.doesNotMatch(sql, /google_rating|google_review|photo_reference|photo_name|formatted_address/);
  assert.match(sql, /grant select, insert on public.place_identity, public.place_areas to service_role/);
  assert.doesNotMatch(sql, /grant .* on .*place_student_reviews.* to authenticated/);
});

test('global provider budget stops expense even when the frontend repeatedly asks', async () => {
  const app = provider(async () => { throw new Error('must not fetch'); }, false);
  await assert.rejects(app.googleNearby(origin, 'All', 'key'), /daily budget/);
  assert.equal(app.requests.length, 0); assert.equal(app.logs[0].status, 429);
});

test('registry reuses one Campus Mint record and never persists provider content', async () => {
  const tables = { place_identity: [], place_areas: [] }, writes = [];
  const admin = { from(table) {
    let filters = [];
    const query = {
      upsert(rows) {
        writes.push({ table, rows });
        for (const row of rows) {
          const exists = tables[table].some(old => table === 'place_identity' ? old.google_place_id === row.google_place_id : old.place_id === row.place_id && old.area_key === row.area_key);
          if (!exists) tables[table].push(table === 'place_identity' ? { id: `internal-${tables[table].length}`, ...row } : row);
        }
        return Promise.resolve({ error: null });
      },
      select() { return query; },
      in(field, values) { filters.push(row => values.includes(row[field])); return query; },
      then(resolve) { return Promise.resolve({ data: tables[table].filter(row => filters.every(filter => filter(row))), error: null }).then(resolve); },
    };
    return query;
  } };
  const registry = compile('lib/providers/places/registry.ts', { 'server-only': {}, '@/lib/supabase/server': { createSupabaseAdminClient: () => admin }, './identity': { identityRows, placeAreaKey } });
  const first = await registry.rememberPlaceIds(['ChIJ123', 'ChIJ123'], origin);
  const second = await registry.rememberPlaceIds(['ChIJ123'], origin);
  assert.equal(first.get('ChIJ123'), second.get('ChIJ123')); assert.equal(tables.place_identity.length, 1); assert.equal(tables.place_areas.length, 1);
  for (const write of writes) for (const row of write.rows) assert.deepEqual(Object.keys(row).sort(), write.table === 'place_identity' ? ['google_place_id'] : ['area_key', 'place_id']);
});
