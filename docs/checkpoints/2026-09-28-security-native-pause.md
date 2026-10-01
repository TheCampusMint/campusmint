# Resume here — security, SwiftUI and Places

**Superseded:** continue from [the October 1 validation checkpoint](2026-10-01-security-native-validation.md). The remaining steps below describe the earlier pause, not current completion status.

**Status: paused at the user's request on 2026-09-28.**
Repository: `/Users/fawzan/campusmint`, branch `main`.
Base commit: `263b828b2fbbcebf1b067e420914c7cfc6b14a9c`.
The current milestone is saved as local, uncommitted work. Nothing from this milestone has been pushed, deployed, or applied to the live database. Do not confuse a local checkpoint with a live release.

## Fixed architecture decisions

- Keep the Next.js website. Add SwiftUI alongside it, sharing Supabase and server APIs.
- `auth.users.id` remains the canonical immutable account key. No username/email-based authorization or second identity system.
- Xcode automatic signing; bundle ID `com.campusmint.app`; Personal Team now. Select the real team in Xcode; no invented Team ID.
- Default entitlements are empty. Apple linking and App Attest activation stay off pending provisioning and security validation.
- Apple must explicitly link to the authenticated, verified existing account. Supabase's default email auto-linking does not satisfy this requirement; the live Apple UI remains disabled.
- Google remains disabled until its key, rollout flag and policy review are ready. No Google provider-content mirror in Supabase.
- Production permission changes require explicit approval of the exact prepared migrations. No remote migration push has been authorized for 028–030.

## Completed locally

**SEC-01:** Next.js patched to 16.3.6; dependency audit reported zero vulnerabilities after updates. Central API guard adds distributed quotas, cookie-origin checks, verified bearer support, bounded request parsing, private responses and request audit events. Upload finalization retains server MIME/size/signature checks; legacy multipart parsing is bounded.

**SEC-02:** Source audit of migrations 001–027 and prepared migration 028 across all existing tables/policies/grants. Removes direct client mutation bypasses, narrows sensitive reads, privatizes Storage, separates administrators, adds rate/audit infrastructure and immutable account IDs. API compatibility fixes cover Events, Brand reads/mutations, signed-out account restoration and unilateral-follow private-content access.

**NATIVE-01:** SwiftUI project and native core exist under `ios/`. Xcode 27 generic iOS Simulator build passed. Native core security/session checks passed (13). Existing-account OTP, restoration, feed, text composer, profile and settings form the first slice. Remaining native feature ports are listed in `docs/ios-client.md`. The simulator runtime is now installed; see `ios-checkpoint.md` for the latest launch/screenshot status.

**NATIVE-02:** Prepared migration 030 and server native refresh/config/App Attest challenge/registration/assertion paths. Challenges bind user/key/method/path/body, expire, and are consumed atomically with counters. Required-but-misconfigured attestation fails closed; submitted optional proofs are checked. Normal authorized website access still exists, so App Attest is additional native evidence, not a universal guarantee that all callers run genuine iOS.

**PLACES-01:** Prepared migration 029 stores durable Place IDs and Campus Mint-owned data only. New Food search/details/reviews/photo paths have session/in-flight deduplication, one-shot location, explicit refresh, lazy photos, authentication and daily provider quotas. See `docs/places-architecture.md`.

## Validation already observed

- Website production build passed after the dependency update. Later small guard/route edits still need a final build.
- TypeScript and ESLint passed at earlier integration checkpoints; rerun after all pending edits.
- 39 publishing/profile/marketplace/poll regression tests passed after updating request-parser bindings and the friendship privacy expectation.
- 21 real PostgreSQL/PGlite database security tests passed through migrations 001–030.
- 18 App Attest cryptographic/database tests passed before subsequent configuration regressions were added.
- 9 HTTP security tests passed, including logged-out hydration, quotas, spoofed identities/origins, private-path guards and attestation enforcement.
- 12 Places architecture tests and related earlier boundary tests passed.
- Secret scan found no candidate exposure in tracked files/history/prior browser output. Rescan the final browser build. No credential rotation was warranted or performed based on that scan.
- A full-suite run initially found 26 failures caused by changed test-harness imports; targeted rerun fixed those. A final complete suite has not yet been run on the final combined state.

## Exact next steps

1. Read this checkpoint, `ios-checkpoint.md`, and `places-pause.md` if present. Inspect the local diff; preserve existing work.
2. Finish the **legacy Places location-picker path**: `/api/places/search`, `googlePlaces.ts`, PlacePicker/DiningHub currently need the same enable flag, daily budget, minimal fields, timeout, safe errors and session deduplication as the new provider paths. Avoid persisting provider labels/photo references in drafts/events; preserve user-authored location text. The assigned reviewer was preparing this when paused; inspect its checkpoint before changing anything.
3. Complete security integration review: validate newly supplied profile avatar paths against the account owner before any future private-avatar signer uses them; record CSP inline-script compatibility limitation; inventory every API's resource authorization. Keep separate administrator MFA and capability checks.
4. Add security/Places test scripts to package.json and make direct `cbor` usage an explicit dependency rather than relying on transitive installation. Complete root security/Apple linking/threat-model and release-checkpoint documentation.
5. Run the complete test suite, TypeScript, lint, final production build, dependency audit, secret scan and `git diff --check`. Fix actual failures; do not claim all checks passed based on earlier checkpoints.
6. Finish simulator visual checks without sending real OTPs or posting test content to production. Native sign-in cannot complete against the current live website until its new endpoints and migrations are released. Live account/upload checks remain unperformed.
7. Read-only live schema drift, hosted Auth rate/captcha settings, private Storage HTTP behavior, backup/PITR coverage and restore drill still need verification. Prepared runbooks are not proof these hosted settings are active.
8. Prepare one concrete reviewed release, request exact production migration approval for 028–030, then apply/deploy only when approved and compatible checks are ready. Commit validated work locally as a separate checkpoint before a release. No automatic privileged account grants.

## Remaining launch gates

Paid Apple provisioning and real-device App Attest review; safe manual Apple linking without email auto-merge; live two-account authorization testing; account erasure with legacy restrictive foreign keys and Storage deletion; monitored cleanup/audit retention; verified backups and recovery; full native feature migration. Music stays out of the live UI, and licensed media integrations remain unconfigured.

Temporary validation logs are under `/private/tmp/campusmint-*.log`. They are convenience evidence; this checkpoint and source-controlled tests are the durable handoff.
