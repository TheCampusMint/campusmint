# PLACES pause checkpoint — 2026-09-28

Paused at the user's request. No commit, migration or deployment was performed by this subtask.

## Completed in the current resumed review

- Added `tests/appAttestSecurity.test.mjs`: 18 passing tests and targeted ESLint before the final configuration assertion below. Tests use real P-256 signatures, the dependency's public historical Apple certificate fixture, and isolated PostgreSQL migration 030.
- Added a regression assertion that `APP_ATTEST_REQUIRED=true` remains required even when configuration is unavailable. Root implemented that flag change; this final assertion has not yet been rerun.
- Audited the older `/api/places/search` path and found it bypassed the newer Places enable switch and daily cost budgets.
- Exported the existing `googleRequest` helper from `lib/providers/places/google.ts` so text search now shares its timeout, distributed search budget and redacted metrics.
- Updated `lib/providers/places/googlePlaces.ts` to enforce enablement, validate query/campus, use minimal location fields, deduplicate IDs and concurrent identical calls, and return safe links. Removed eager hours/phone/ratings/photos and photo resource names.
- Updated the search route to authenticate internally, honor enablement, bound queries to 3–200 characters, reject prototype-key campuses, return generic errors, and use private/no-store responses.
- Reduced `PlaceProviderResult` to the minimal search contract and adjusted `ProviderPlaceCard` accordingly, preserving Google/third-party attribution and semantic theme colors. The touched files are syntactically coherent, but the Places changes have not yet had typecheck/lint/tests.

## Next exact steps

1. Add account-scoped in-memory search deduplication to `PlacePicker` and `DiningHub`, with explicit retries and stale-response protection. Pass `sessionKey={viewer.account.id}` from `CreateContentFlow` to `PlacePicker`. Neither client nor the composer integration was edited yet.
2. Preserve only the user's own typed location text when confirming a Google suggestion. Currently `PlacePicker` still copies Google's name/address into `eventLocation`, which drafts/posts retain. Root approved displaying Google confirmation transiently while publishing only user-authored text; this is **not implemented yet**. A durable Place-ID event attachment with live detail resolution remains a later contract checkpoint.
3. Update both clients' minimum length to three, maximum to 200, and new `message` error contract. Display all provider-required attribution in the picker. Keep results only in active page memory and clear on account changes/signout.
4. Add focused legacy search tests: internal authentication, disabled-provider gate, length/campus validation, shared expense denial, minimal masks, no photo references, safe links, deduplication and private responses. Run existing Places tests, attestation tests, targeted ESLint and TypeScript.
5. Append this older-path coverage and remaining activation constraints to `docs/places-architecture.md`. Paid provider remains disabled pending key/configuration and approved migrations.

App Attest review notes passed to root: optional provided proofs should be verified; required-but-misconfigured must fail closed; marked native sessions are extra evidence, not a way to distinguish every hostile web/API client. Root is handling proxy changes and documentation. No real-device Apple verification was claimed.
