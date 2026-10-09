# BUILD-2026-10 — production completion workload

Started October 8, 2026; resumed October 9. Baseline `cfc51de` is deployed. The website remains supported alongside SwiftUI. This register is a delivery checklist, not a declaration that planned features work.

| # | Requested work | Baseline / next gate |
|---|---|---|
| 1 | SwiftUI screens | Sign-in, basic feed/profile/text composer exist. Remaining screens need shared APIs and native QA. |
| 2 | Social persistence | Clubs/polls/posts/profile/listing messages persist. Main DMs, comments, likes, follows, notifications, attendance need client/server wiring. |
| 3 | Scoped realtime | Implement per-account invalidation without broadcasting private content. |
| 4 | Notch/composer cleanup | Border cleanup deployed; vertical options, controls and clipping need another check. |
| 5 | Leaf publish animation | Inspect existing motion; animate only server-confirmed publication, support reduced motion. |
| 6 | Sports | Seasonal/favorite ranking and full-date checks deployed; continue provider coverage and regressions. |
| 7 | Campus clubs expansion | Private clubs deployed; verified campus registry expansion and ~50-campus source coverage remain. |
| 8–9 | Places | Key-disabled architecture and protections exist; verify quotas, deduplication, lazy photos, logging and caching. |
| 10 | Video | Upload validation exists; durable processing worker/variants/thumbnails and monitored cleanup remain. |
| 11 | Security | Hardening baseline deployed; continue regression audit and hosted operational checks. |
| 12 | App Attest | Architecture and server verification exist, intentionally disabled pending paid-team/hardware validation. |
| 13 | Native sessions | Keychain/refresh/logout exist; deep links and cancellation/revocation QA remain. |
| 14 | Disaster recovery | Runbook exists; safe restore harness and automated verification remain. |
| 15 | Moderation | Tables and reviewer boundary exist; reporting/appeals APIs and reviewer UI remain. |
| 16–17 | Legal & Safety | Draft five policies against actual behavior; label drafts for owner review and provide Settings UI. |
| 18 | Abuse tests | 460 baseline tests; expand with each implemented boundary. |
| 19 | Performance/iPhone QA | Add bounded local load harness and simulator tests; no unapproved live load. |
| 20 | Apple linking | Preparation exists; keep disabled, no email-based merging. |
| 21 | Store preparation | Add metadata templates, screenshot slots, privacy disclosure/release checklist. |
| 22–23 | Paid sports/8K | Prepare server-owned, disabled-by-default entitlements; no billing or free-plan increase. |
| 24 | Creator/Brand review | Capability boundary exists; human review tools remain. |
| 25 | SMS | Remains off; provider-neutral interfaces and contract checks needed. |

Each milestone must record changed files, validation, migration status and unresolved live checks. Do not mark scaffolding as implemented functionality. Never automatically turn on Apple capabilities, paid entitlements, provider credentials, SMS, or destructive retention jobs. New production permission changes require exact review under the existing database-change spec.

## SOCIAL-01 — October 9 implementation checkpoint

Implemented locally (not a completion claim for the 25-item program):

- Service-authorized social read/write API and migration `20261009162606_social_account_sync.sql`. Existing records remain intact. Server checks cover verified identity, post visibility, comments being open, reply scope, bilateral blocks, conversation participation and authorship. Retry IDs deduplicate comments/messages/shares; boolean set operations converge.
- Account-owned Realtime revision rows expose no message or post bodies. Web consumers refetch through authorized APIs, coalesce notifications, cancel stale account requests, fall back to foreground polling, and clear data on authorization rejection.
- Web text comments/replies/likes/deletion; text DMs/replies/read receipts/pins; own profile notes; notifications/read state. Inbox peers no longer depend on loading the other person's complete profile through the feed. History APIs and web controls paginate rather than permanently hiding older comments/messages.
- SwiftUI Messages, message thread/replies, Comments/likes/deletion, and Notifications/read state, using the same server API. Native older-history controls, opaque UUID request targets, encoded query parameters, App Attest mutation hooks, and account-bound scene identity. Native screens currently refresh on opening/pull-to-refresh; native Realtime is not yet implemented.
- Composer options now vertical, #/@ controls easier to tap, text/media remain inside the floating card. Server-confirmed leaf publication feedback supports reduced motion. Successful publication remains disabled while draft cleanup completes.
- A strictly development-only `/dev/preview` route supports isolated sample-data visual checks. Production returns 404. Fixed explicit Next.js public fixture flag evaluation and the database-disabled preview's account check; neither change authorizes real mutations.

Validation so far:

- 469 JavaScript/PostgreSQL tests passing; lint and production build passing.
- 15 native security/contract checks passing; iPhone 18 Pro simulator build passing.
- Secret scanner: 507 working-tree files, 1,235 historical blobs, 16 browser files; zero pattern findings. This does not prove third-party logs or every historical deployment are clean.
- Browser: isolated 390×844 composer in light/dark; whitespace-only entry keeps Publish disabled; substantive text reveals privacy; extras are vertical; sample success is announced before dismissal. This uses local sample publication, not a live upload.
- User explicitly approved this migration in-thread. Production application and real two-account/device QA still need release evidence below.

Known remaining work in this checkpoint/program:

- Private file attachments for DMs/comments are not yet synced; attempts preserve the draft and show an explicit error. Sticker glyphs can be sent as text. No music or commercial GIF provider was enabled.
- Follows/blocks, appreciation/endorsement/save/share, event attendance have authorized backend actions but remaining legacy web hooks still need migration. Friendship approvals, comment reposts, reports and event moments remain separate work.
- Complete account state aggregation needs a bounded selective/paginated read before large-scale use. Native account/social screens need live two-account checks, native realtime, richer composition and the rest of the screen migration.
- Profile notes currently sync the owner's note; discovery/display of other people's notes remains a separate privacy-aware read.
- Message ordering is a local presentation preference; conversation pins are server-backed. Message-file storage, unread badge completeness on long histories, background push, and recovery/erasure operations remain unverified.
- Full 25-item workload above remains active: campus expansion, video workers, moderation/admin workflows, legal drafts, recovery tooling, store preparation, and disabled future capabilities are not declared finished.

### SOCIAL-01 production database evidence

The user approved the social-sync migration explicitly. Applied successfully October 9 to project `rwcrglxahdkiiuvywror`; SQL SHA-256 `8a4ed7785b10414c9bde504d68ee0746cea36382f23818bdf45255930c229ec3`. The connector recorded version `20261009170529`; its ledger entry was reconciled to the CLI-created local version `20261009162606` without replaying SQL. Live checks confirmed revision-table RLS, own-account SELECT predicate, publication membership, service-only social mutations, no browser read RPC, no direct browser private-message SELECT and no browser revision writes. This is database deployment evidence, not live two-account UI or Storage validation.
