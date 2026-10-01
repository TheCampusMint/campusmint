# Campus Mint database security checkpoint

Latest validation and read-only live findings: [SEC-NATIVE-02](../checkpoints/2026-10-01-security-native-validation.md). The final combined suite passes 452 tests; the database suite now includes hosted trigger-helper permissions. Migrations remain unapplied to production.

Checkpoint: **SEC-DB-030** · source audit updated 2026-09-28 · migrations 001–030 reviewed and executed in isolated PostgreSQL; 028–030 prepared locally. **Production drift verification and migration application are not complete.** This is a source review plus executable local PostgreSQL tests, not a certification of the live project.

## Boundary

`auth.users.id` remains the one account key. Profile identities reference it, profiles reference identities, and dependent posts/social records reference those profiles or Auth directly. No replacement identity system is introduced. Username, email, school and public identifiers never authorize access.

The web and native clients may read the deliberately allowlisted RLS-filtered catalog/own-account projections. Account-owned mutations go through authenticated, authorized Campus Mint APIs. There are no direct client mutation grants after 028, including old column-level grants. The server uses its secret service credential only after route authorization. A service credential bypasses RLS; database policy cannot replace those route checks. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Findings resolved by 028

| ID | Finding | Change / evidence |
| --- | --- | --- |
| DB-01 | Historical Supabase defaults could activate mutation policies that only checked row ownership, permitting likes/attendance/private-message writes without current server permission, block, rate or payload checks. | Revoke table and column client ACLs across all 111 existing app tables; remove legacy non-SELECT policies. New tables/functions opt in explicitly. Runtime tests check every table and column ACL. |
| DB-02 | Direct marketplace listing reads bypassed the server's ten-mile and block filters and exposed `moderation_metadata` containing approximate listing area. Legacy status updates could bypass moderation state transitions. | Marketplace records are server-only. Existing server DTOs preserve campus, block, owner and location checks. |
| DB-03 | Brand profile read policy returned every active Brand's `contact_email`; completion writes the verified account email there. | Direct Brand profiles/channels are owner-only; non-owner API queries must authorize and project safe fields through the server. |
| DB-04 | Applicant SELECT included internal `review_notes` and reviewer identity. | Column grants expose only application identity/status/timestamps needed by account hydration. |
| DB-05 | Unilateral follow in poll permission SQL acted as consent to read private-author/connections content. | Accepted friendship authorizes that access; a follow alone does not. Blocks, expiry, archive, member-only audience and self access remain enforced. Officer membership included. |
| DB-06 | Organization request policy used unqualified `organization_id` inside a subquery, which could resolve to the inner role row and match unrelated organizations. Dormant RPCs accepted a caller-selected user and removal retained role records. | Own-request policy qualified by caller; no direct request-table grant. Dormant membership mutation RPCs revoked from every application role, including service, until a reviewed workflow exists. |
| DB-07 | Direct Storage writes could bypass signed-upload admission; avatars were public and old update policy lacked an explicit destination check. | All four app buckets private. Known client policies removed; a restrictive rule denies direct browser access even if an unexpected permissive rule remains. Signed admission/download through the authorized server stays available. |
| DB-08 | A normal account with the reviewer capability alone could conduct administrative review. | Separate server-owned `security_administrators` membership plus existing capability required. No seeded administrators. Self-review denied. Root route additionally requires verified AAL2/MFA assurance. |
| DB-09 | Foundation submissions, confirmations and campus reviews had unconstrained UUID ownership columns. | Three Auth foreign keys added `NOT VALID`: new writes enforce canonical identity, historical rows preserved pending orphan audit/validation. |
| DB-10 | Privileged code could accidentally reassign profile identity UUIDs. | Immutable `user_id` triggers on profile identities/profiles, including service-role updates. |
| DB-11 | In-memory throttles could be bypassed across instances; no bounded server audit storage. | Service-only atomic quota RPC and append-only audit table, private HMAC keys, bounded pruning and no browser table access. |
| DB-12 | Public-trusted catalog predicates did not consistently exclude development rows; default function EXECUTE and view privileges were implicit. | Restrictive development filter wherever the column exists; explicit RPC revokes and view ACLs; aggregate view uses invoker security and remains server-only. |

## Every migration checkpoint

| Migration | Review scope | Disposition after 028 |
| --- | --- | --- |
| 001 | 16 catalog/source/submission tables, 11 catalog SELECT policies, update trigger | Trust filters retained; registry private; development filtered; two missing Auth links added. |
| 002 | University/source seed only | Real source metadata, no user/auth grants or secrets. |
| 003 | Nine dining/housing tables and read policies | Trusted public data retained; third-party content provenance boundary retained; review Auth link added. |
| 004 | Official dining/housing/source seed only | No privileged identity seed or permission changes. |
| 005 | Marketplace verification, listing, photos, offers, favorites, transactions, reports, two definer triggers and verifier RPC | Direct reads/writes replaced by server-only boundary; legacy deletion restrictions remain documented. |
| 006 | Campus network membership; additive marketplace policies and column ACLs | Network SELECT retained; listing/ticket mutations and column grants revoked. |
| 007 | Organizations, memberships, officers, announcements, submissions | Trusted directory SELECT and own-membership/submission SELECT retained; no client mutation. |
| 008 | Empty organization source placeholder | No objects or grants. |
| 009 | Identity/profile/privacy/classes/clubs/friend/follow/block/report ownership | Own SELECT retained; identities immutable; all writes server-only. |
| 010 | 20 social content/media/interaction tables, two invoker views, expiry RPC | Own SELECT retained where safe; views and cross-user content server-only; direct interaction writes denied. |
| 011 | Event timing and organization reference | FK and timing constraints retained. |
| 012 | Six organization/group tables, membership RPCs, conversation policies | Dormant membership mutation RPCs disabled; unsafe request predicate fixed. Group data not opened to browsers. |
| 013 | Club name/handle normalization and duplicate trigger | Data constraints retained; direct RPC execution denied to client roles. |
| 014 | Brand/event/sports/DM/notification/social policies and three buckets | Sensitive legacy policies removed; private Storage; Brand PII restricted; DM and notification reads/writes server-only. |
| 015 | Account completion service writes and hydration SELECT | Server grants preserved; hydration scoped by RLS. |
| 016 | Mint idempotency/media metadata and server grants | Server publishing/signed-upload path retained. |
| 017 | Creator, capability, phone challenge/state tables | Own safe status reads retained; phone challenge and privilege writes server-only. |
| 018 | Cleanup/archive/WebAuthn/provider/moderation tables and archive bucket | Archive own read retained; WebAuthn table becomes server-only; private bucket guard added; no scheduler is implicitly enabled. |
| 019 | Verified Brand policy boundary | Legacy direct mutations disabled; verified Brand decisions still checked in server routes. |
| 020 | Creator screening/review, SMS gate, publisher communities | Separate administrator check added; no automatic approvals or SMS. |
| 021 | Empty last name/profile details | Canonical user ID unchanged; user-editable details never grant membership. |
| 022 | Sports snapshot service access | Server-only; service grant preserved. |
| 023 | Poll validator, private votes, service-only poll RPCs | Follow privacy defect corrected; server-only voting preserved. |
| 024 | Composer organization/event server reads | Preserved. |
| 025 | Campus preview metadata seed | No privilege seed; pending-confidence schools are not promoted by 028. |
| 026 | Listing server grants and private listing messages | Preserved; no browser message grants. |
| 027 | Private feed preference table and aggregate view | Preserved; aggregate remains server-only. |
| 028 | This hardening migration | 114 app tables after adding three security tables; tested locally, not applied remotely. |
| 029 | Durable Google Place IDs and Campus Mint-owned community schema | Five tables, all RLS-enabled and browser-inaccessible. Service can register IDs/areas; unshipped community writes remain denied even to service. No provider display data columns. |
| 030 | Native session markers, App Attest public keys and challenges | Three private RLS tables. Service-only atomic registration/consumption RPCs, bounded pruning, ownership/counter/replay checks. 122 app tables after the full chain. |

Run `node scripts/security/database-inventory.mjs /private/tmp/campusmint-schema-inventory.json` to produce the full per-migration table, policy, grant, view, function and Auth-FK inventory with source hashes. This also includes later migrations so review checkpoints cannot silently disappear. The generated inventory contains SQL only, never database rows.

## Full table inventory, grouped by access boundary

- Trusted catalog/source records (25): `universities`, `data_sources`, `data_sync_runs`, `academic_programs`, `academic_terms`, `courses`, `course_program_relations`, `instructors`, `campus_entities`, `buildings`, `course_sections`, `section_instructors`, `community_submissions`, `community_submission_confirmations`, `aliases`, `data_change_events`, `dining_locations`, `housing_entities`, `external_place_links`, `campus_reviews`, `housing_units`, `housing_rates`, `amenities`, `entity_amenities`, `entity_photos`. Only directory tables have public SELECT; source/sync/submission internals are private.
- Marketplace/network (12): `university_marketplace_policies`, `marketplace_verified_students`, `marketplace_listings`, `marketplace_listing_photos`, `marketplace_offers`, `marketplace_favorites`, `marketplace_transactions`, `marketplace_reports`, `campus_networks`, `campus_network_universities`, `marketplace_sports_ticket_details`, `marketplace_messages`. Only network metadata has client SELECT; listing/contact/verification access is through the server.
- Organization identity and groups (11): `organizations`, `organization_memberships`, `organization_officers`, `organization_announcements`, `organization_submissions`, `organization_roles`, `organization_membership_requests`, `conversations`, `organization_membership_contacts`, `conversation_participants`, `content_tagged_organizations`. Verified public directory and own-membership/submission reads only.
- Profile relationships (9): `profile_identities`, `profiles`, `profile_privacy_settings`, `profile_classes`, `profile_organizations`, `friendships`, `profile_follows`, `profile_blocks`, `profile_reports`. Existing owner/participant SELECT rules retained; no client authority mutation.
- Social content and feedback (27): `content_locations`, `content_event_details`, `social_content`, `mints`, `stories`, `content_media`, `content_likes`, `content_saves`, `content_shares`, `content_comments`, `hashtags`, `content_comment_likes`, `content_hashtags`, `content_mentions`, `content_tags`, `comment_mentions`, `story_views`, `story_reactions`, `content_reports`, `pending_content_notifications`, `mint_pins`, `content_private_appreciations`, `content_public_endorsements`, `feed_dwell_events`, `mint_poll_votes`, `feed_preferences`, `notifications`. Only established owner-read projections retained. Votes, dwell, private feedback and notifications are not cross-user client-readable.
- Brand, events, sports and DM (9): `brand_profiles`, `brand_channels`, `brand_channel_memberships`, `brand_channel_posts`, `campus_events`, `event_attendance`, `sports_program_snapshots`, `direct_conversations`, `direct_messages`. Brand owner hydration only; public/shared display projected by server.
- Private note/pin (2): `conversation_pins`, `profile_notes`. Server-only until complete synchronized APIs exist.
- Capability/verification (8): `creator_profiles`, `creator_applications`, `account_capabilities`, `phone_verification_settings`, `phone_verification_states`, `phone_verification_challenges`, `creator_eligibility_policies`, `publisher_communities`. Own safe hydration only; reviewer/phone/provider/capability writes server-only.
- Media/archive/review (8): `media_cleanup_jobs`, `archive_preferences`, `private_content_archives`, `private_archive_media`, `web_authn_credentials`, `media_provider_registrations`, `content_review_actions`, `content_review_appeals`. Owner archive/appeal reads; key material, provider registry and moderation actions server-only.
- New security (3): `security_administrators`, `security_rate_limits`, `security_audit_events`. No client grants. Service can read administrators, consume quota via RPC and append/read audit. It cannot assign administrators or directly alter audit records.
- Places (5): `place_identity`, `place_areas`, `place_saves`, `place_student_reviews`, `place_student_photos`. No client reads/writes. Service identity registration is available; community content mutation requires a future reviewed API and grant.
- Native (3): `native_auth_sessions`, `native_attest_keys`, `native_attest_challenges`. No client reads/writes/RPC execution. Enrolled key records contain public keys and Apple receipts, never the device's Secure Enclave private key. Service code cannot directly overwrite the key/counter or delete a challenge; enrollment and assertion consumption use the reviewed atomic RPCs.

## Server authorization compatibility audit

Checkpoint **SEC-API-READS**: reviewed every `createSupabaseServerClient` and browser client use, plus direct REST patterns, against migration 028's read allowlist. The only browser database operation found is uploading bytes with a server-issued signed Storage token. Account hydration/profile reads remain scoped to the authenticated account and retain the necessary column grants. Sports identity hydration remains valid. `member`, `officer`, and `leader` are actual membership enum values (007/012), not invented states.

The root integration pass must close these findings before deployment; a source review alone is not runtime evidence:

| Finding | Required integration behavior |
| --- | --- |
| API-01: `campus_events` direct SELECT is revoked, including existing user-scoped event API and Brand duplicate queries. | Authorized server queries must preserve campus/tester scope, event visibility, and fail on database errors instead of silently bypassing duplicate checks. |
| API-02: Brand channels become owner-only to direct clients; memberships/posts are server-only. | Joining and the channel page must use explicit server authorization. Only the owner or actual member receives posts. Never project Brand contact email. |
| API-03: Broader owner hydration no longer implicitly filters suspended Brands. | Publishing/joining/server channel views must explicitly require verified, unsuspended Brands and active channels. |
| API-04: The global API gate originally rejected logged-out `/api/account/me` before its session-state response. | Keep session introspection optional-auth: anonymous callers get the existing signed-out response; every private read still requires a verified user. Preserve idempotent sign-out. |

App Attest verifies enrolled native requests; it does not make the parallel website inaccessible to non-Apple clients. Client-selected native session markers alone cannot distinguish a modified app that authenticates through the web flow. Enforcement and product claims must preserve that limitation, with all ordinary authentication/authorization/rate limits still enforced server-side.

## Validation and remaining launch gates

`tests/securityDatabase.test.mjs` runs the real migration SQL through 030 in isolated PGlite PostgreSQL with Supabase-role/Auth/Storage contract fixtures, including old permissive defaults. **21 tests passed on 2026-09-28.** It checks all effective table/column mutation permissions, positive own-account/public-directory reads, cross-user denial, private polling, Storage denial despite an injected permissive policy, rate counts, audit retention and reviewer separation. Native checks cover single-use/expired/wrong-owner registration, uniqueness/device limits, assertion counter compare-and-swap interleavings, counter rollback when challenge consumption fails, revoked keys, pruning, and native-record account-deletion cascades. Places tests check ID uniqueness, invalid IDs and denial of unshipped community mutations. The read-only live drift script also executes successfully against the complete local schema. This does not emulate concurrent network sessions, Apple's cryptographic service, hosted Auth/Storage HTTP services or deployed Supabase configuration.

Repository/history/browser-output secret scan on 2026-09-28 inspected 476 working-tree paths, 1,096 historical blobs, and 14 existing browser artifacts: no candidate secret findings. A fresh final build must be rescanned; this result is not evidence about external dashboards, logs or old remote deployments.

Before production rollout:

1. Run [live-drift.sql](../../scripts/security/live-drift.sql) read-only against staging and production; compare every unexpected grant, policy, definer function, bucket and exposed schema. Repository review cannot discover dashboard-only policy drift.
2. Apply 028 to staging, exercise signed upload admission and signed download, Brand membership, account hydration, notifications and native token requests. Realtime direct-table clients must use authorized server projections or receive separately reviewed grants; none are silently enabled here.
3. Investigate legacy orphan counts before `VALIDATE CONSTRAINT` on the three new Auth FKs. No orphan rows are deleted automatically.
4. Complete account-deletion orchestration: marketplace seller/buyer/report/transaction and capability grantor `ON DELETE RESTRICT` constraints intentionally still prevent blanket Auth deletion. Decide retention/anonymization, revoke sessions/identities, delete private Storage bytes and handle signed-URL lifetime before enabling deletion. A relational cascade does not remove Storage bytes.
5. Tighten any remaining dormant `SECURITY DEFINER` function search paths when enabling its workflow; currently client EXECUTE is revoked and public-schema CREATE is denied. Service role is not a user-facing administrator.
6. Live secrets, backups, alerts, audit export, quota pruning schedule and MFA enrollment remain operational checkpoints in [operations.md](operations.md). Nothing here claims those settings were configured.
