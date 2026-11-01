# SOCIAL-03 — native foreground sync, October 31, 2026

Baseline: `7e440a04d3f2f4fdb35d4ef15e118cb1ff36ffca`, released October 13. This supersedes the older SOCIAL-01/02 notes that still said their app code was undeployed. This checkpoint completes native foreground invalidation for the existing social screens; it does not complete the full production backlog.

## Implemented

- One foreground iPhone WebSocket connection per signed-in account. It subscribes only to `public.social_sync_revisions`, filtered to the canonical authenticated UUID. The existing live own-row SELECT policy/publication were checked read-only. No database migration, grant, or policy change is required.
- Realtime carries revision hints. Messages, comments, notifications and feed data still come from authenticated Campus Mint APIs with their existing authorization rules.
- Messages, open conversations, comments, notifications and feed refresh automatically. One buffered refresh survives changes arriving during a read; bursts do not launch parallel page reads. Local social writes also invalidate the other open consumers.
- Returning to the foreground refreshes; a 30-second foreground fallback continues if realtime is unavailable. The socket and fallback stop when the scene becomes inactive. This is not APNs/background push delivery.
- Heartbeats, missed-heartbeat/join detection, capped reconnect backoff with jitter, session-token refresh, and socket cancellation. Tokens remain inside the networking layer and the existing Keychain session infrastructure.
- Account changes end the old observer streams; stale account callbacks cannot invalidate the new account. A delayed social mutation failure cannot clear a replacement account.
- Loaded message/comment/notification pages are re-read so edits, deletions and access changes reconcile older history, instead of periodically replacing it with only the newest page or keeping stale deleted rows.
- `/api/native/config` adds optional public realtime configuration. It excludes service-role/secret keys and rejects insecure/foreign/credential-bearing destinations. Old servers remain compatible through HTTP fallback. Existing Apple capabilities remain disabled.

## Main files

- `ios/CampusMintCore/Sources/CampusMintCore/SocialRealtime.swift`: narrow protocol/transport, lifecycle, invalidation hub.
- `ios/CampusMintCore/Sources/CampusMintCore/SocialPageSnapshot.swift`: authoritative paginated reconciliation.
- `ios/CampusMintCore/Sources/CampusMintCore/CampusAPI.swift`: account-bound token refresh and reconnect.
- `ios/CampusMint/App/CampusMintApp.swift`, `SocialScreens.swift`, `RootView.swift`: foreground lifecycle and visible consumers.
- `lib/security/nativeRealtimeConfig.ts`, `app/api/native/config/route.ts`: client-safe connection configuration.
- `RealtimeTests.swift`, `tests/nativeRealtimeConfig.test.mjs`: destination/key filtering, account/table filtering, cancellation, heartbeat failure, revocation, buffering, history reconciliation and old-config compatibility.

## Validation before release

- 475 web/database tests passed.
- 32 native security and contract checks passed.
- Signed iOS build succeeded with automatic Personal Team signing and `com.campusmint.app`.
- Web production build and lint passed.
- Working-tree secret scan: 530 source files, 16 browser files, zero findings; this is not a new full-history credential audit.
- No device visual checks performed, per the user's updated instruction. Real two-account/device behavior remains for the user checklist.
- Supabase protocol/changelog checked, including upcoming TLS cipher removal. Native URLSession/ATS protections remain enabled. References: https://supabase.com/docs/guides/realtime/protocol and https://supabase.com/changelog/cbc-tls-ciphers-deprecated.

## Release and remaining work

Commit/push/deploy evidence is recorded separately in the project mirror's release report once the production release completes; do not infer deployment from a local commit or successful build. New signed binaries still need installation on a paired phone; publishing the website does not update an installed iOS binary.

User checklist: `2026-10-31-iphone-functional-checklist.md`.

Still separate: bounded native/web reads and UI wiring for all likes/saves/follows/blocks/attendance; native club management, marketplace posting/contact and profile editing; richer DM attachments; native device-location discovery; APNs notifications; media processing workers; operational security/backup/moderation work. Existing core APIs or website handoffs are not full native parity. No provider key, paid Apple capability, billing, music, SMS, or destructive cleanup job was enabled.
