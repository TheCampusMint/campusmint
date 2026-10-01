# Google Places architecture — PLACES checkpoints

October 1: the legacy `/api/places/search`, event location picker and dormant DiningHub now share the provider budgets, safe minimal fields and account-scoped session deduplication. Query changes invalidate displayed results; retry is explicit. The picker stores user-authored text, never copies Google's returned labels into drafts. Both new and legacy paths are covered by the passing final suite. Search budget counts Nearby Search **and Text Search**.

Status: implemented behind `GOOGLE_PLACES_ENABLED=false`. No real Google request or remote schema update was performed for this work. The API key remains unconfigured by the owner's choice. The web client continues working; Food honestly shows “Nearby food is coming soon.”

## PLACES-01 — Durable identity: implemented, migration pending

Migration `20260928002900_place_identity.sql` creates:

| Table | Durable Campus Mint data | Access shipped now |
| --- | --- | --- |
| `place_identity` | Random internal UUID, unique Google Place ID, Campus Mint tags, creation time | Trusted server SELECT/INSERT |
| `place_areas` | Place UUID and coarse search-area key rounded to 0.1 degrees; no user identity or precise device coordinates | Trusted server SELECT/INSERT |
| `place_saves` | Account UUID, place UUID, save time | Closed writes; server SELECT only |
| `place_student_reviews` | Account/place/campus IDs, student-written review and rating, moderation status, times | Closed writes; server SELECT only |
| `place_student_photos` | Account/place/campus IDs, first-party storage path, moderation status, time | Closed writes; server SELECT only |

All tables enable RLS and revoke default grants from PUBLIC, anon, authenticated, and service_role before granting the listed minimum permissions. No browser can access these tables directly. Community writes remain disabled until verified-author, campus, moderation, upload validation, and deletion endpoints exist. There is no new storage bucket or broader Storage permission. These prepared tables do **not** mean community reviews, photos, or saves are live features.

`auth.users.id` remains the canonical account identity. Concurrent duplicate Place IDs use an `ON CONFLICT DO NOTHING` registration and read the existing UUID. The registry stores neither Google business coordinates nor a permanent restaurant search-result set. Area association is internal bookkeeping, not an access-control shortcut and not a promise that overlapping search circles share results.

## PLACES-02 — Request flow: implemented

1. Opening Food for the first time in an active browser page session requests `GET /api/discovery/nearby?kind=food&lat=…&lng=…&cuisine=…`. Rendering Food elsewhere in that session reuses the same in-memory request/result. No request runs merely because the app starts while another area is open.
2. The API authenticates the account. The shared API guard enforces distributed IP and account limits. The server makes one Nearby Search with a ten-mile circle and at most 20 results, then registers only their Place IDs and area links.
3. List fields are ID, display name, location, address, Google Maps link, rating/count, and required attributions. Ratings deliberately retain the Enterprise field tier because the product requires rating order. Reviews, editorial summaries, phone, hours, and photo names are excluded. The returned sample is sorted by rating/count, not claimed to be every restaurant within ten miles.
4. Opening one card's Details requests `GET /api/places/{googlePlaceId}?view=details` for website, phone and current hours only. The ID must already be in the trusted registry; a later request uses that ID directly rather than another discovery search.
5. Opening Google reviews requests `?view=reviews` separately. This is the optional, more expensive Atmosphere-tier call and displays only the reviews returned by Google, ordered by relevance. No historical review harvesting occurs.
6. All Google credentials stay in server request headers. All routes return `Cache-Control: private, no-store`; Google fetches also use `no-store`. The old arbitrary-photo-resource route returns 410.

The Native client can later reuse these authenticated endpoints with the same canonical Supabase identity. It must apply the same lifetime and attribution rules to its UI state.

## PLACES-03 — Session deduplication and refresh: implemented

The browser keeps resolved promises/results in memory for the active page session. Identical concurrent components share one promise, and returning to a cuisine/card or remounting the panel reuses it. Failures also remain until explicit Retry, preventing remount retry loops. Signout/account cleanup clears all Places data and remembered location; changing accounts clears the request store. Nothing is serialized to localStorage, sessionStorage, IndexedDB, Supabase, or a server response cache.

Server single-flight deduplication retains **only an in-progress request** and removes it after success/failure. It does not retain completed Google responses. This is per running server instance; different cold instances may each make a request. Distributed request and daily budget guards are the cross-instance safeguard.

Refresh is explicit, or follows a newly requested location fix that differs by at least half a mile. `useNearbyLocation` uses `getCurrentPosition` only after “Use my location”; no watch, interval, focus listener, or location request on app open. Coordinates live only in memory. Events and Sell keep the ten-mile filter around the displayed campus or selected device origin. Small GPS jitter does not run another paid discovery search. Exact device location is not persisted by Places. A failed/inaccurate fix preserves the last useful origin and states the error.

The Events clock still updates its on-screen “Now” label; that timer does not fetch Google or device location. Food performs no automatic polling or background restaurant refresh job. After a full browser reload, volatile UI state is gone and opening Food can make a fresh search. This is intentional; indefinite/offline storage of Google content is not introduced.

## PLACES-04 — Photos and attribution: implemented

Only a visible card's first photo triggers `GET /api/places/{id}/photo?index=0`. IntersectionObserver has zero look-ahead margin. No off-screen image request starts. Browsers without IntersectionObserver receive a Photo control rather than eager fetching. Additional images (up to four) require opening Details and pressing More photos, and remain viewport-gated.

Each photo operation obtains a fresh photo name through a minimal `id,photos` Place Details request and immediately exchanges it for a provider image URL. The resource name never leaves that server operation, enters a database, or becomes a session cache key. Photo URLs are checked for HTTPS and Google image hosts. The current image URL/UI state is held in volatile page memory; failures require explicit Retry photo. An expiring photo is never retried indefinitely.

Google Maps attribution is visible in the same card; photo authors/source links and review author/avatar/source links are preserved. Required source attribution is not treated as disposable product microcopy. Campus Mint community data will have separate presentation and attribution once enabled.

## PLACES-05 — Cost guardrails: implemented; deployment configuration pending

Each actual upstream call (after in-flight coalescing) consumes a distributed daily bucket through security migration 028. Defaults are intentionally conservative:

| Server variable | Default | Counted operation |
| --- | ---: | --- |
| `GOOGLE_PLACES_SEARCH_DAILY_LIMIT` | 100 | Nearby Search |
| `GOOGLE_PLACES_DETAILS_DAILY_LIMIT` | 1000 | Card details, review details, and fresh photo-name lookups |
| `GOOGLE_PLACES_PHOTO_DAILY_LIMIT` | 400 | Photo media calls |

Buckets reset at UTC day boundaries. This is a call ceiling, not a monetary quote. Daily counts may include attempts Google rejects; provider billing remains authoritative. Missing rate-limit infrastructure fails closed before a paid fetch. User/IP route limits add burst protection. There are no automatic retries. Structured `places.provider.request` logs contain operation, variant, HTTP status and elapsed milliseconds only — never API keys, user IDs, exact locations, review content or photo resource names. Aggregate these by operation/variant and alert on provider failures/budget denials. Configure Cloud-side quotas and billing alerts as an additional independent ceiling.

## PLACES-06 — Remaining activation checkpoints

- Approve and apply forward-only security migration 028 and Places migration 029. **No remote migration was run.** Migration 029 adds the exact permissions listed in PLACES-01; it does not change existing accounts/posts or campus permissions.
- Configure a server-only restricted Places API (New) key, Google Cloud quotas/alerts, and the three budget limits. Set `GOOGLE_PLACES_ENABLED=true` only after these checks.
- Complete publicly accessible Terms/Privacy documents and confirm the applicable Google Maps Platform agreement permits the chosen transient UI-state behavior. Place IDs have an explicit durable-storage exception; there is no claim that Google permits a general-purpose content/photo cache.
- Run a real-key acceptance test: 20-result list at most, visible first images only, Details/reviews measured separately, repeated opens do not add provider calls, explicit refresh does, signout clears data, attribution correct, budget denies without expense. Current tests use controlled provider responses because no key is configured.
- Before shipping community reviews/photos/saves, implement their scoped API/UI, verified authorship, moderation, upload checks, and storage deletion lifecycle. They are a separate checkpoint, not silently enabled by this foundation.

## Validation and primary sources

Focused `tests/placesArchitecture.test.mjs` exercises duplicate identity handling, session and in-flight deduplication, no rerender/navigation retries, explicit invalidation, failure retention, lazy-photo gating, separate provider field masks/metrics, registered-ID authorization, safe photo hosts, and global expense denial. Run with `node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/placesArchitecture.test.mjs`. Targeted ESLint passes. Repository-wide TypeScript/tests/build are performed at the combined release checkpoint.

Official references checked 2026-09-27:

- [Policies and attribution](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Nearby Search fields and billing tiers](https://developers.google.com/maps/documentation/places/web-service/nearby-search)
- [Place Details fields](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Photo resource lifetime and attribution](https://developers.google.com/maps/documentation/places/web-service/place-photos)
