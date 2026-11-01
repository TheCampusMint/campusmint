# NATIVE-PARITY-04 — November 1, 2026

This is an implemented, tested release checkpoint, **not a claim of complete website parity**. The user owns final phone verification and explicitly asked to skip visual inspection/device-tap pauses.

## Implemented in this checkpoint

- Explicit native Student signup, verified email code, resumable incomplete setup, separate First name / Last name / Username, optional university-specific Sports interests. The existing Supabase Auth UUID stays canonical; ordinary sign-in never silently creates an account. Brand/Creator onboarding remains a web handoff.
- Native profile editing, field/account privacy saving, people search, profile views, follows/unfollows, blocks/unblocks and saved-post reopening through account-authorized APIs. Saved posts load their own bounded IDs rather than only searching the current feed.
- Joined-club and Event composer context, filtered selectors, resolved @ mentions, deduplicated hashtags, camera photo/video capture, and retained draft context. Existing image/video preparation preserves shape, scoped uploads, stable retry IDs and server-confirmed leaf publication remain in use.
- Native Club creation/editing, request/cancel/leave, invitations, owner/admin approval/removal/role controls. Native marketplace listing creation, buyer/seller private threads, seller thread selection and sold/available controls, with status refreshed from the server.
- Foreground location selection with campus fallback, 10-mile discovery, lazy provider details/photos/reviews and source attribution. No Google Places key was added; missing-provider results remain honest.
- Native Notes use a centered themed panel with outside dismissal and own-account persistence; no music. Notification destinations open known message/profile/Club/Event targets. Native Event details and attendance use authorized existing APIs. A cancelled share does not create a share record; successful native sharing records an account-owned interaction.
- Post appreciation/endorsement/saves, visible-comment counts and closed-comment state use bounded trusted-server reads. Only visible post controls subscribe to refreshes, avoiding an entire feed of per-post polling. iOS 17 has a geometry fallback to iOS 18 scroll visibility.
- Native feed requests use the existing web ranking engine and saved preferences; Not interested reasons persist. Native Sports preferences and the capability-gated 20-campus Sports tester are available.
- Server feed-author projection now removes private profile fields before either client receives them. Graduation-year privacy maps to its actual database column on save/read. Publication/upload preparation binds the expected canonical owner across suspension/account switches.
- Camera/microphone/location purpose strings and privacy-manifest declarations were updated. Manifest review is still required before App Store submission. No tracking was enabled.

## Approved production database boundary

The user approved the prepared native-parity migration originally named `20261101164821_native_social_parity.sql`. The deployed migration service recorded it as **20261101174119 / native_social_parity**; the local file was renamed to match actual production history, avoiding a duplicate future apply.

The migration adds `read_social_details` and `update_profile_privacy`. Reads are bounded and verified-account scoped; post counts exclude deleted/blocked comments. Privacy writes accept only supported fields and lock the actor's own profile. Both functions have an empty search path, explicit PUBLIC/anon/authenticated revokes and service-role-only execution. No browser/table permissions were added and no existing rows were removed. A final tightening rejects SQL NULL privacy patches.

Applied successfully November 1. Live catalog checks confirmed both browser roles cannot execute either function and service_role can. Live synthetic missing-account probes reject both functions. The original direct social-table restrictions remain intact; this implementation uses authorized functions rather than expanding SELECT grants.

Security advisors retain the pre-existing extension-in-public and leaked-password-protection warnings, plus intentional RLS-with-no-browser-policy information for server-only tables. No mutable function search path or public function-execution regression was introduced. Existing warnings are not claimed resolved.

## Validation

- Full web/backend suite: 487 tests passing, including the final privacy-route cases and all 31 isolated SQL cases.
- 40 native security/contract checks pass, including signup identity, exact signed request bytes, owner switching, draft contexts, query bounds and typed notification destinations.
- Production Next.js build, lint and signed physical-iPhone build pass. iOS 17 deployment support retained.
- Secret scan: 541 working-tree files / 16 browser files, no pattern findings; this was not another historical or third-party-log audit.
- Live database checks above used synthetic nonexistent identities and made no real account/post/message changes. No real OTP, upload, comment, listing or Club was created by the agent for QA.
- Browser/device visual verification intentionally deferred to the user's checklist.

## Still open — do not mark the app a complete replica

1. Native DM attachments/GIF files, sticker/emoji tooling, complete profile-photo upload, own-post management and remaining web social controls. Some corresponding web controls still use legacy/local state; do not copy that limitation and label it account sync.
2. Remaining Settings content/notification/account/legal/safety screens, friend-request UI, moderation/report/appeal/reviewer workflows, and full Brand/Creator native account flows. Do not add inert toggles or fake production actions.
3. Global developer campus preview across every tab (current native tester is Sports-only), full Event Moments/Archive behavior, broad profile history and all deep-link destinations.
4. Native passive view/dwell learning and every web ranking-context input. Explicit likes/endorsements and Not interested are implemented; do not claim all exploration signals are collected natively.
5. Paid-team Apple capabilities, live App Attest/Sign in with Apple linking, provider keys/licenses, production video pipeline operations, paid Sports/8K entitlements and the remaining launch/security workload retain their separate gates. Nothing here enables music, billing, SMS or a commercial catalog.

Reference: Apple privacy-manifest data types https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatype ; Supabase server functions https://supabase.com/docs/guides/database/functions .
