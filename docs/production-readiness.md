# Campus Mint production-readiness boundaries

This document records work that must not be represented as live until its external dependencies and product rules are complete.

## Production Mint media

- Non-development accounts publish through authenticated `/api/mintz` preparation and finalization requests. Preparation grants short-lived signed upload access to owner-scoped paths in the private `mint-media` bucket; the browser sends file bytes directly to Supabase Storage. Only metadata passes through the application host, avoiding its request-body limit for large videos.
- Finalization verifies the signed, owner-bound upload ticket, stored object path, byte size, MIME type, and file signature before inserting content/ownership rows. It returns success with signed playback URLs only after the saved Mint can be read back. Development accounts still use local fixtures and do not prove production posting works.
- Migrations `01600`–`02000` and working Supabase public/server configuration are prerequisites for posting. Migration `20260927002100_profile_persistence.sql` is additionally required for the account/profile changes in this release. Verify the target database's migration history during release; a Git commit or website deployment does not apply database migrations by itself.
- Launch limits remain six media items, 12 MB per image, 100 MB per video, and 150 MB total. The default photo preparation fits the longest edge to 2048 pixels; the opt-in 4K/HD setting raises that to 3840 pixels. Preparation preserves aspect ratio and never enlarges small images. WebP conversion is used when it reduces bytes. The setting does not add a video transcoder or override file-size limits.
- MP4/WebM uploads are supported, but no transcoder, thumbnail worker, adaptive streaming pipeline, or completed cross-browser production video playback matrix exists. Storage acceptance alone does not guarantee that every phone can decode a particular video codec.
- Abandoned staged uploads receive cleanup jobs due after 24 hours; upload tickets expire after two hours. Successful publication cancels staged cleanup, and the existing worker checks published references before removing staged objects.
- `/api/mintz/cleanup` also expires content and processes the wider media cleanup queue. **No cleanup cron is scheduled by this release**: `vercel.json` schedules only Events and Sports. Authorized manual or existing maintenance must invoke this worker with `Authorization: Bearer $CRON_SECRET` (or the configured `CAMPUS_DATA_SYNC_SECRET` fallback). Until cleanup is deliberately scheduled and monitored, abandoned uploads and expired media may remain in storage and incur storage costs; expired posts are hidden from the feed.
- Exact Premium limits, quotas, original-media retention, and billing entitlements are undefined and remain inactive.

## Saved Drafts

- The composer exposes a Drafts section with reopen and delete actions plus an explicit Save draft action. Draft metadata and selected `File` objects are stored in IndexedDB under the current account identity; reopening restores composer fields and media previews.
- Failed publication attempts save a draft for retry. Successful publication removes the reopened draft when local cleanup succeeds; a local deletion error does not turn an already published Mint into a failed publish.
- Drafts are private to that browser/device and are not synchronized through Supabase. Clearing site data, browser storage eviction, or unavailable storage can remove or prevent saving drafts. Storage errors are surfaced while leaving the composer open. Migrated older drafts that stored filenames only ask the user to reselect the media.

## Account and identity persistence

- Student signup collects First name, Last name, and Username separately. A person entering only a first name keeps an empty last name; the application must not invent a duplicated surname. Migration `02100` permits that empty value and adds persisted editable profile details.
- Authenticated profile edits use the owner-scoped `/api/account/profile` endpoint and wait for database confirmation. Sign-in hydration reads the saved profile instead of treating browser-local edits as account persistence. Transient account-loading failures must remain retryable rather than restarting setup or replacing the saved identity.
- Automated tests cover profile normalization and request/response behavior. They do not replace a real account sign-out/sign-in check on the deployed database or a separate-device restoration check.

## Football results and refresh

- Texas A&M football uses the official `https://12thman.com/sports/football/schedule/season/{year}` schedule as its provider. The parser accepts explicit source-backed results, updates the season record and kickoff information, and retains stable game IDs and existing verified participant details. It does not infer a final score or live status from elapsed time.
- Authenticated `/api/sports` reads refresh Texas A&M football when its provider snapshot is at least five minutes old. The Sports screen polls while visible and refreshes when the tab regains focus. A daily Vercel cron calls `/api/sports/refresh` at 06:37 UTC using `CRON_SECRET` (with `CAMPUS_DATA_SYNC_SECRET` as the route's fallback); the deployed environment must configure a secret for cron authentication. The existing authorized snapshot-push POST endpoint remains available.
- Successful fetches are stored in `sports_program_snapshots`. Migration `20260927002200_sports_snapshot_server_access.sql` grants the server permission to read, insert, and update these snapshots; direct browser access remains restricted. Provider failures, malformed/partial schedules, or a missing previously verified final retain the old snapshot and its original freshness timestamps. The screen reports refresh failures. This is schedule/result refresh, not a licensed realtime play-by-play feed.
- The bundled fallback was checked against the official source on September 27, 2026: Texas A&M's record is 2–2, including Arizona State 48–20, Kentucky 21–31, and LSU 6–35. Other university programs and poll boards retain their own sources and timestamps; the football refresh does not make those datasets current.
- Provider parsing was checked against fetched official HTML and automated tests cover malformed data, missing results, duplicates, rescheduling, and stable identity. A successful local parser/test run does not establish that production cron authentication, database writes, and subsequent authenticated reads all succeeded; verify those after deployment.

## Creator authorization

- Creator applications stay `pending` until external-account control is verified and an authorized human reviewer records a decision. Follower counts and profile URLs supplied by a browser are claims, not proof.
- A reviewer tool, reviewer allowlist, platform OAuth/control-verification adapters, and audit workflow still need to be built. No AI or client request may approve an application.
- `account_capabilities` is additive: a verified Student can receive creator capability without losing university identity. Group/Channel creation and future monetization must check server-granted capabilities. Payments, rates, eligibility calculations, and payouts are inactive.
- The creator badge tint is data-configurable; badge display must derive from active server capability, never editable profile state.
- Human review transitions use the service-only `review_creator_application` database function through the reviewer-gated API. An administrator must explicitly grant `creator_reviewer`; no reviewer is seeded automatically.
- Approved Creator status adds `creator`, `create_groups`, `create_channels`, and future monetization eligibility without replacing an existing Student identity. Creator and Brand communities are not official university organizations.

## Phone verification

- SMS enforcement is explicitly disabled in `phone_verification_settings` and `STUDENT_SMS_VERIFICATION_REQUIRED=false`. Student email OTP remains the signup requirement until an SMS provider is selected and the server environment flag is deliberately activated.
- Before activation: select a provider, build send/verify routes, hash OTPs, redact phone/OTP values from logs, enforce resend and attempt limits, define duplicate-number and recovery policies, add abuse monitoring, and complete recovery support. Phone verification is not a guarantee of human identity.

## Owner campus testing

- The production control is gated by the server-owned `owner_campus_tester` capability. It changes presentation/test context only; server authorization continues to use the authenticated identity.
- No owner is granted automatically. Grant/revoke procedures require an authenticated administrative workflow and audit trail.
- Nine configured test contexts are available: Texas A&M, Blinn, Texas, LSU, Alabama, Oregon, Harvard, Michigan, and Miami. Contexts without provider-backed records stay honestly empty; no fake people, listings, events, or scores are added to fill them.

## Camera and device saving

- A web implementation may use `navigator.mediaDevices.getUserMedia()` only after the user opens a camera feature, then Canvas/WebCodecs-capable browser tools for supported previews, crops, and adjustments. Browser support and permission behavior must be tested per device.
- A web app cannot claim unrestricted access to Apple Camera or Photos. A native iOS capture/export implementation is required for a first-class native camera and reliable Photos-library save. “Save my captured posts to my device” remains off and unavailable until a real platform implementation exists.

## Private Archive

- Migration `01800` separates private archive records/media from expired or hidden public content and reserves an owner-only storage bucket. This is storage architecture, not a launched Archive.
- Launch requires an atomic archive-copy worker, success/failure notifications, retention/deletion jobs, owner APIs, and a real WebAuthn registration/assertion ceremony with a documented unsupported-platform fallback. A lock icon or local PIN is not acceptable authentication.
- The preference boundary defaults temporary auto-archive on, but no copy is claimed until the archive worker reports success. Permanent Mint archive/delete actions and retention policy still require product specification.

## Music, sounds, GIFs, and stickers

- Each provider remains unavailable unless `media_provider_registrations` records reviewed terms and permitted uses. API access alone is not synchronization, redistribution, remix, caching, or UGC distribution permission.
- Production launch requires provider accounts/credentials, current terms review, geographic/age constraints, attribution/branding requirements, takedown handling, and written music synchronization/UGC rights where applicable.
- Spotify, Apple Music, YouTube, GIF catalogs, and stock libraries must not be presented as attachable catalogs without the relevant agreement. Royalty-free or creator-authorized sources need stored license/provenance metadata.

## Social interaction preview boundaries

- Mint comments, comment replies, reactions, and Direct Mint conversations currently use the existing device-local development stores. They are optimistic local interactions, not server realtime or cross-device persistence.
- Direct Mint attachment previews use user-selected browser files/data URLs with a 4 MB preview cap. Camera uses an explicit file-input capture hint; it does not request camera permission on load or claim native Photos access.
- Direct Mint GIF entry accepts a user-selected GIF file. The Campus sticker choices are labeled development fixtures. No licensed GIF or sticker catalog is connected.
- Emoji uses normal text plus a small inline shortcut row. Music attachment controls and track displays are removed from Notes and posts pending provider rights. New Mint submissions ignore music metadata; historical records and audio inside uploaded videos are retained.
- Mint sharing uses Web Share when available, then clipboard/copy fallback. Campus location attachment remains an explicit campus-entity or manual selection; precise device geolocation is not silently requested.

## Moderation and support

- Migration `01800` provides human review actions and appeals, with AI output limited to a non-authoritative triage signal.
- Launch requires reporting APIs/UI, reviewer permissions, queue tooling, notifications, evidence retention, takedown/restore operations, appeal handling, audit exports, and a documented repeat-infringer policy.
- No paid AI service is connected. The product must not imply automated moderation or legally conclusive copyright decisions.
