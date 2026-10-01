# SEC-API-01 — server route authorization inventory

October 1, 2026. Routes below are current source boundaries, not claims of live penetration-test completion. The default proxy policy requires a verified Supabase user, distributed IP/account quotas and same-origin cookie mutations. Bearer callers are verified by Supabase, not by decoding untrusted claims. Sensitive native requests additionally enforce configured App Attest. Bounded parsing is followed by each route's schema and permission validation.

| Route family | Authentication and resource authorization |
| --- | --- |
| `account/me`, `account/logout` | Optional-auth session introspection and idempotent logout; private account response only for verified caller; revoke only caller's session |
| `account/complete`, `account/profile` | Verified caller; trusted account type, eligible verified Student identity for setup; edits scoped to same UUID; no arbitrary new Storage path |
| `student-verification/request`, `student-verification/verify` | Public OTP bootstrap; per-IP and normalized-email quotas; eligibility/server verification, no client-granted capabilities |
| `native/config`, `native/session/refresh` | Public configuration contains no secrets; refresh validates token, returned user identity and native-session binding; token-digest quota |
| `native/attest/challenge`, `native/attest/register` | Verified account; key ownership, bounded enrollment, cryptographic chain/app binding; single-use expiring challenge; atomic persistence |
| `admin/creator-applications/[applicationId]/review` | Verified MFA/AAL2 plus separate administrative role and review capability; self-review rejected; database repeats administrator requirement |
| `creator/apply` | Current verified Student account and policy eligibility; application owner comes from authenticated UUID |
| `communities` | Verified unsuspended Brand or explicit Creator/community-creation capabilities; owner assigned by server |
| `brand/channel/posts`, `brand/events` | Authenticated owner of verified unsuspended Brand; active channel/event audience and campus checks; explicit safe projections |
| `brand/channels/[channelId]/membership` | Verified Student identity; active channel and verified unsuspended Brand; membership mutation scoped to caller |
| `mintz` | Read permissions enforce author/privacy, accepted connections, campus, membership, blocks and expiry; mutation validates author/capabilities/context and upload admission/finalization; object paths and bytes checked server-side |
| `mintz/context` | Verified caller's campus; active public catalog; club choices filtered to accepted membership and publishing permission |
| `mintz/[mintId]/poll` | Caller must be allowed to view Mint; vote option validated; same ownership/block/privacy checks repeated by service-only SQL |
| `feed/preferences` | Verified caller's private preference records; post access checked before interaction mutations |
| `marketplace`, `marketplace/messages` | Verified campus/network eligibility; distance and bilateral block filtering; listing owner/buyer/sender scope; no browser table access |
| `events` | Handler requires verified caller and campus/authorized preview scope; server projection excludes privileged fields |
| `sports` | Public schedule results; signed-in identity determines additional authorized campus-preview behavior |
| `discovery/nearby`, `discovery/photo`, `places/search`, `places/[placeId]`, `places/[placeId]/photo` | Verified caller; validated coordinates/query/IDs, configured provider; registry check for details/photos; shared paid-call budgets and safe provider projection |
| `campus-data/sync`, `events/refresh`, `sports/refresh`, `mintz/cleanup`, `security/cleanup` | Server-held scheduler secret, constant-time proxy validation; no ordinary account or native capability authorizes maintenance |

Public share pages are separate from these API routes. They remain read-only public-content projections; possession of an internal UUID does not authorize private data access. Apple login/link endpoints are not shipped or enabled.

No account-owned browser mutation policy should bypass these boundaries after migration 028. Unported local-state social UI is not represented as server persistence. When adding its APIs, require object-level and bilateral-block checks and add two-account tests before enabling writes or realtime subscriptions.

Remaining operational checks: live cross-account requests, revoked-session behavior through hosted Auth, signed Storage token lifetime, provider-hosted OTP abuse controls, reverse-engineered native requests, and deletion/recovery paths. See [operations](operations.md) and [the release checkpoint](../checkpoints/2026-10-01-security-native-validation.md).
