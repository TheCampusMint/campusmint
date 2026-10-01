# SPORTS-CLUBS-01 — website release

Date: 2026-10-01. Builds on local security/native milestone `22200d0` and production base `263b828`. Native demo remains deferred to the owner; the website stays supported.

## Included

- Sports recommendations surface one to three available programs, ordered by current season, in-season favorites, then the school's curated importance order. Published schedule dates take precedence over fallback competition months. Unsupported programs never fill empty slots. Current catalogs are curated, not a claim to cover every varsity program nationwide.
- Texas A&M adds volleyball, equestrian, golf, softball and tennis; Harvard adds basketball, lacrosse and golf. Other configured campuses retain their source-backed catalogs. Refresh now visits the full configured catalog, independently preserving last verified data on provider failure. Football's January refresh uses the season that began the prior year.
- Full ISO dates keep January/February 2027 upcoming in fall 2026, even when a persisted status is stale. Schedule cards show a verified/derivable season record instead of Updated; incomplete past results return Record unavailable. Golf/rowing/track never invent a win/loss record from placements.
- Optional school-specific Sports interests at Student signup are validated against the campus catalog and stored in account profile details. Favorites only outrank other active sports while in season. No selection uses automatic ordering. Manual tab navigation survives background refresh.
- Post composer controls remove ornamental borders/shadows/selected outlines while preserving focus-visible accessibility cues.
- Real Clubs in production: Discover/My clubs, create private clubs, request/approve/decline membership, owner/admin/member hierarchy, editable pages, invitations accepted by recipients, name search and privacy-aware interest suggestions. Owner-only admin promotion/demotion and visibility changes. Members leaving/removal lose membership/publishing roles and existing group-chat participation. Campus preview stays read-only.
- Private club page fields are omitted from outsider API responses and public share pages; a restrictive policy protects direct reads. Existing curated organizations remain unchanged. Accepted memberships feed the post composer club selector.

## Validation

- 460 tests passed, no failures/skips, including actual PostgreSQL migrations and club privilege checks, HTTP auth/privacy checks, seasonal ranking, full-year date logic and posting regressions.
- Lint clean; production build including TypeScript passed; whitespace checks clean.
- Browser checks at 390×844 used synthetic intercepted account/club responses, never production writes. Create Club floated within the viewport; dark composer retained neutral dark surfaces; progressive Privacy/Duration/Event options rendered; controls had 0px borders and no box shadows. Focus indicators remain. This is UI evidence, not live multi-account membership or upload QA.
- Secret scan result and deployment confirmation are recorded below when complete.

## Database deployment

The owner explicitly approved migrations 028–030 and separately approved `20261001220254_private_clubs.sql` before application. All four applied successfully through the Supabase connector.

Live verification: no public application table without RLS; no anon/authenticated table or column mutation grants; no public application Storage buckets; club RPC denied to browsers and granted to service_role; zero automatically seeded global administrators; quota/native infrastructure present.

Connector-generated history timestamps were reconciled to the repository migration versions, without rerunning SQL. Missing migration 026 history was recorded only after checking the existing marketplace message columns, defaults, foreign keys, body constraint, thread index and service grants. No table was recreated and no existing rows were deleted. Do not replay these migrations.

## Explicit follow-ups

- Future paid tier: about three sports visible, swipe through the school's full supported catalog; up-to-8K uploads. Neither entitlement nor 8K was enabled.
- Broader source coverage remains an editorial/provider task. Do not equate curated ordering with measured popularity or fabricate records for missing data.
- Hosted PostgreSQL upgrade advisory, backup/PITR/Storage recovery drill, direct Auth configuration review, strict CSP/nonces, real two-account production QA and independent hostile-client review remain open from SEC-NATIVE-02.
- App Attest and Apple account linking remain disabled pending paid-team provisioning, real-device validation and review. Music and unlicensed provider catalogs remain absent. Google Places remains ready for a key but disabled.

Official catalog references: [Texas A&M](https://12thman.com/), [Harvard](https://gocrimson.com/).

## Published evidence

- Application commit: `7524134`; pushed to `origin/main` with the prior security/native commit included. Vercel reported success for [deployment 3oFnt3MgSTgtXQwHJ3KdC9QgAHTS](https://vercel.com/thecampusmints-projects/campusmint/3oFnt3MgSTgtXQwHJ3KdC9QgAHTS).
- Public website: https://www.thecampusmint.com. Homepage HTTP 200; native configuration HTTP 200 with Apple linking/App Attest disabled; account hydration correctly reports signed out; club access and cleanup reject anonymous requests with 401. Security headers, private API cache policy and request IDs are present.
- Clean anonymous browser reaches Choose your account; no browser errors reported. No real OTP, upload, account change or club invitation was sent during production verification.
- Secret scan: 492 working-tree files and 14 browser artifacts, no findings. Historical scan evidence remains in SEC-NATIVE-02; the release scan did not repeat Git history.
- Hosted migration history now matches repository versions through private_clubs. Post-migration advisor reports two remaining warnings: [pg_trgm in public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) and [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Its no-policy INFO notices are expected for deliberately server-only tables. Function-search-path warnings are resolved.
- Vercel connector access to the project returned 403. Git-based deployment succeeded and GitHub's Vercel commit status plus live HTTP/browser checks supplied release evidence; a Vercel runtime-log scan and drain inventory were not available.
