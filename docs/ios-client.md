# Campus Mint iPhone client

Checkpoint: **IOS-01 — native foundation and first working screens**, 2026-09-28.

The website remains the complete product. `ios/` contains a separate SwiftUI client of the same Campus Mint server APIs and Supabase account system. An account's existing `auth.users.id` remains its immutable identity. The app does not create another account database or copy production credentials.

## Open and run

1. Open `ios/CampusMint.xcodeproj` in Xcode.
2. Select the **CampusMint** scheme and an installed iPhone Simulator.
3. Run. The project uses iOS 17 or newer and was compiled with Xcode 27.0 / iOS 27 Simulator SDK.
4. For a physical iPhone, select your **Personal Team** under **Signing & Capabilities**. Automatic signing is already enabled. The bundle identifier is **`com.campusmint.app`**. No Team ID is invented or committed.

The default API address is `https://www.thecampusmint.com`. The server-side native endpoints and their database migrations must be deployed before a real account can complete native sign-in. A successful Simulator build alone does not establish that live sign-in or publishing is available.

For a separate HTTPS staging server, copy `ios/CampusMint/Config/Local.xcconfig.example` to the gitignored `Local.xcconfig` and set the public server address and, if needed, your Team ID. ATS stays enabled; do not add an HTTP exception for convenience. No secret keys belong in these configuration files.

## Current screens and contracts

| Screen or function | Current implementation | Validation boundary |
| --- | --- | --- |
| Sign in | Existing Student account, email OTP, no implicit signup | Native contract checks; live OTP/account check still required |
| Session restoration | Device-only Keychain, token refresh, canonical UUID checks | Revocation, refresh, identity mismatch and sign-out checks |
| Mint | Feed, text, image/video display, read-only poll results, native share sheet | Compiles; signed-in visual and live data check still required |
| Create | Text-only floating sheet, public permanent default, stable retry ID | Request contract checks; live publication still required |
| Profile | Existing name, username, bio and major | Read-only; no second profile system |
| Appearance | Light, Dark, Colorful/system surfaces and green interactive accent | Full native semantic palette remains a later screen migration |
| Sign out | Server session revocation request, local secrets and feed always cleared | Includes offline sign-out regression check |
| Apple account linking | Secure nonce preparation only; no live button | Disabled until explicit linking can be guaranteed server-side |
| App Attest | Registration/assertion client bound to body, path, method and user | Disabled in default Personal Team configuration; real-device review required |

New-account setup uses the existing website. Media uploads, editable profiles, comments/reactions, DMs, Groups, Sports, nearby discovery, drafts, poll voting and the complete progressive composer remain web features until their native checkpoints are implemented and validated. They are not simulated or labeled complete in this client.

## Security boundary

- Access/refresh tokens live in `KeychainSessionVault`, with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` and no iCloud synchronization. Only appearance preferences use `UserDefaults`.
- API requests use HTTPS, an ephemeral cookie-free session, bearer authentication and no authenticated redirects. The app rejects insecure or credential-bearing server URLs.
- Refresh responses and profiles must retain the same Supabase user UUID. Revoked/invalid sessions are removed; transient network failures can retry. Sign-out clears private in-memory content even if the network is unavailable.
- The client supplies no authorization decisions. The server verifies tokens, student status, object access, rate limits and request validation before sensitive actions.
- App Attest signs the exact serialized request bytes. It does not replace authentication or object permissions. Unsupported devices do not silently fabricate proof.
- The app hides its screen when inactive and does not persist feed data or media in its session vault.

## Personal Team now, organization enrollment later

The default entitlement file is empty so paid capabilities are not accidentally requested during Personal Team development. `PaidCapabilities.entitlements.example` is a reference only; it is not attached to the build. Keep Apple login hidden and App Attest server enforcement off until the paid team's identifiers, provisioning, server settings and device validation are complete.

After enrollment, configure the real Team ID and registered bundle ID, intentionally attach supported entitlements, and validate App Attest on hardware. Apple linking must begin in the authenticated, verified Campus Mint account, verify Apple's stable subject on the server, and resolve to the same `auth.users.id`. Do not activate provider email auto-merging or expose a standalone Apple signup flow as a substitute. See the server security checkpoints before enabling either capability.

## Repeatable checks

```sh
xcodebuild -project ios/CampusMint.xcodeproj -scheme CampusMint \
  -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 18 Pro' \
  -derivedDataPath /private/tmp/campusmint-ios-derived CODE_SIGN_IDENTITY=- build

swift run --package-path ios/CampusMintCore \
  --scratch-path /private/tmp/campusmint-swift-core CampusMintCoreChecks
```

The Swift checks cover secure origins, cookie-free bearer restoration, immutable account identity, token rotation, invalid-session cleanup, temporary refresh failure, offline sign-out, post defaults/retry IDs, no implicit signup, cryptographic nonces and assertion payload binding. These use controlled transport responses; they are not a production penetration test.

Apple's primary references: [Keychain](https://developer.apple.com/documentation/security/using-the-keychain-to-manage-user-secrets), [App Transport Security](https://developer.apple.com/documentation/security/preventing-insecure-network-connections), and [App Attest](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity).
