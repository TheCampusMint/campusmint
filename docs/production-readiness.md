# Campus Mint production-readiness boundaries

This document records work that must not be represented as live until its external dependencies and product rules are complete.

## Production Mint media

- The application now uses the authenticated `/api/mintz` contract for non-development accounts. The server validates media, uploads to the private `mint-media` bucket, inserts ownership/content rows, and returns short-lived signed URLs only after the saved record can be read back.
- Apply migrations `01600`–`02000` before exercising the new persistence and authorization paths in a deployed environment. No migration push is performed by this patch.
- Images are browser-optimized to WebP when that reduces bytes. MP4/WebM are validated and uploaded, but no transcoder, thumbnail worker, streaming rendition pipeline, or cross-browser production video test exists. Video must be treated as not live-tested.
- A scheduler must invoke `/api/mintz/cleanup` with `Authorization: Bearer $CRON_SECRET`. Until that worker is scheduled and monitored, expired records are hidden but object deletion is not operationally guaranteed.
- Exact Premium limits, quotas, original-media retention, and billing entitlements are undefined and remain inactive.

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
- Emoji uses normal text plus a small inline shortcut row. Music remains the labeled fictional provider-ready development catalog already documented by the picker.
- Mint sharing uses Web Share when available, then clipboard/copy fallback. Campus location attachment remains an explicit campus-entity or manual selection; precise device geolocation is not silently requested.

## Moderation and support

- Migration `01800` provides human review actions and appeals, with AI output limited to a non-authoritative triage signal.
- Launch requires reporting APIs/UI, reviewer permissions, queue tooling, notifications, evidence retention, takedown/restore operations, appeal handling, audit exports, and a documented repeat-infringer policy.
- No paid AI service is connected. The product must not imply automated moderation or legally conclusive copyright decisions.
