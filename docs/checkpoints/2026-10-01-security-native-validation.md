# SEC-NATIVE-02 — validated local release checkpoint

Updated 2026-10-01. Supersedes the September 28 pause notes. Website and SwiftUI remain separate clients of the same Supabase account and Campus Mint API. This is a local milestone, not a production release or App Store certification.

## Implemented and validated

- Server authentication/authorization guard, distributed quotas, bounded request parsing, origin checks, private responses, security headers and restricted audit records.
- Reviewed migrations 001–030 in isolated PostgreSQL. Prepared 028 closes legacy table/column/function grants, makes Storage private, separates administrators and preserves immutable account IDs. 029 adds Place IDs without a Google-content mirror. 030 adds private native sessions and replay-resistant attestation records.
- SwiftUI first slice: existing-account OTP, Keychain restoration, feed, text posting, read-only profile, appearance and sign-out. Automatic signing and `com.campusmint.app`; no invented Apple Team ID. Website remains available and authoritative for unported features.
- App Attest client/server implementation with binding to account, method, path and exact body; atomic one-use challenges and counter checks. Disabled pending real-device, paid-team provisioning and independent review. Apple linking remains hidden until explicit same-account linking without email auto-merging can be guaranteed.
- Places budgets, minimal request fields, separate details/reviews, lazy photos, attribution, session/in-flight deduplication, no polling, no persistent Google labels/photo references. Legacy address picker and dining search now use the same protections. User-authored location text is the only location label written by the picker. No real Google request was made; key and enable flag remain off.
- New arbitrary avatar paths are rejected by signup/profile JSON. Existing stored paths can be preserved or cleared; a future validated avatar-upload finalizer must authorize new paths before signing them.

## Evidence on the final website code

| Check | Result |
| --- | --- |
| `npm run test:all` | 452 passed, 0 failed/skipped |
| `npm run lint` | Passed |
| `npm run build` | Passed, including TypeScript |
| Production dependency audit | 0 known vulnerabilities |
| Swift core checks | 13 passed |
| Xcode generic simulator build | Passed; signed device-target build and visual evidence are in `ios-checkpoint.md` |
| Secret scan | 482 working-tree paths, 1,096 historical blobs, 14 browser artifacts; no candidate findings |
| Diff whitespace check | Passed |

Tests include actual migration execution in PGlite with Supabase service contract fixtures, cross-account denials, mutation/Storage ACL checks, rate-limit behavior, real P-256 assertion validation and replay tests. They do not substitute for hosted Auth/Storage testing, live two-account QA, or real-device App Attest. No real OTP or production post was sent.

## Read-only production findings

Supabase connector inspection on October 1 confirmed:

- Production PostgreSQL reports **17.6**. Review the provider's September 25 security update and schedule the supported upgrade; no database upgrade was attempted. `ltree`/`btree_gist` are not installed. No application legacy-cipher encryption is introduced here.
- No existing public application table lacks RLS. This alone does not prove correct grants or policies.
- `avatars` is currently public; the other three application buckets are private. Prepared 028 makes all four private.
- Two organization normalization functions have mutable search paths; prepared 028 fixes them. Hosted-only `rls_auto_enable()` has unnecessary client EXECUTE; 028 conditionally revokes it. The same condition is tested using an event-trigger fixture.
- Other existing definer-function warnings are addressed by 028's explicit revokes. No-policy informational notices are expected for server-only tables; do not add permissive policies merely to silence them.
- `pg_trgm` lives in `public`, and leaked-password protection is disabled. Track the provider advisories as hosted configuration work; no extension relocation or Auth settings were silently changed.
- Migration history reaches 027 but omits **026**. Its `marketplace_messages` table already exists with no browser grants. **Do not rerun 026 or recreate its table.** Compare its schema, index and service grants, then reconcile migration history through the documented provider workflow before a migration push.

Sources: [PostgreSQL security update](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes), [function search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [extension schema advisory](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Explicit release gates / next work

1. Review the exact 028–030 SQL and approve live permission changes. Apply/test in an isolated hosted environment, including signed upload/download, account restoration, Brand membership and native refresh. Reconcile 026 history without overwriting existing data. Do not blindly push all local migrations.
2. Deploy the server only with the required database infrastructure and protected server configuration. Missing quota storage intentionally returns 503; deploying this server first would interrupt API access. Verify signed-in and signed-out routes before promotion.
3. Run the complete live drift inventory, direct Auth limits/CAPTCHA review, Storage HTTP checks, backup/PITR and private-object coverage, and a restore drill. These are not complete merely because runbooks exist.
4. Configure a separate MFA administrator account only with explicit assignment. No owner, username or capability was automatically promoted.
5. Perform a dedicated hostile-client review: takeover, IDOR, private messages, club membership, media URLs, quota bypass, replay, privilege escalation, account erasure and reverse engineering. Account erasure still needs orchestration around legacy restrictive foreign keys, Storage bytes and backup expiry.
6. Continue native screens in labeled increments; see `docs/ios-client.md`. Full native media/social features and App Store readiness remain open. Music stays absent; licensed providers remain unconfigured.

## Header limitation

The CSP protects framing, objects, base URLs and connection destinations but retains `unsafe-inline` for script/style compatibility with the current Next rendering and inline theme styles. It is **not** a strict nonce-based XSS mitigation. A nonce rollout needs a separate rendering/caching compatibility check before tightening it.

No credentials were rotated because the scan produced no exposure finding. A scan cannot certify old external logs/deployments; confirmed exposures require issuer-side rotation and session review.
