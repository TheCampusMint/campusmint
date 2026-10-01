# iPhone checkpoint ledger

## October 1 validation update — supersedes the pause below

The latest app was built, installed and launched on iOS 27 / iPhone 18 Pro. Light and dark sign-in screenshots were inspected: no initial server-config or Keychain alert; no OTP sent. Evidence: `/private/tmp/campusmint-final-ios-light.png` and `/private/tmp/campusmint-final-ios-dark.png`.

The installation check discovered that a `CODE_SIGNING_ALLOWED=NO` build can compile and launch but cannot use the simulator's Keychain correctly. Use normal local simulator signing (`CODE_SIGN_IDENTITY=-`) for runnable builds. Debug now sets `ONLY_ACTIVE_ARCH=YES`, matching the local Swift package and avoiding an arm64/x86_64 linker mismatch when targeting a specific simulator. No Keychain protection was removed, and no paid entitlement or fake Team ID was added. The corrected signed simulator build passes. All 13 core checks pass again.

Keyboard/Dynamic Type/VoiceOver, real-account and physical-device checks remain open. Continue from [SEC-NATIVE-02](2026-10-01-security-native-validation.md); the historical pause below is retained as evidence only.

Updated: 2026-09-28. Scope: native client alongside the existing website.

## IOS-00 — project and identity foundation: complete locally

- SwiftUI Xcode project and dependency-free `CampusMintCore` package.
- `com.campusmint.app`; automatic signing; Personal Team selectable in Xcode; no committed Team ID.
- Same Supabase UUID and server APIs as the web product.
- Keychain sessions, TLS-only transport, no broad ATS exceptions, empty default entitlements, privacy manifest.

## IOS-01 — first native slice: implemented, live-account validation pending

- Existing Student email-code sign-in and restoration.
- Feed, image/video display, text post composer, profile, appearance selection and sign-out.
- Public sharing uses existing web share URLs.
- Revoked session/account mismatch removes local tokens and private feed state.

Validation completed locally:

- Xcode **27.0 (27A266a)** installed and selected.
- Generic **iOS 27 Simulator SDK** Debug build succeeded for arm64 and x86_64.
- **13** native security and API contract checks pass.
- iOS 27 **iPhone 18 Pro** simulator booted; `com.campusmint.app` installed and launched successfully.
- Initial installation screenshot inspected at `/private/tmp/campusmint-ios-signin.png`: sign-in screen renders, with the expected unavailable-server alert from the undeployed native configuration endpoint. No OTP requested and no real account used.
- The final local build defers that configuration request until sign-in is requested; it compiled successfully after installation began. Reinstall this latest build at the next checkpoint before further visual QA.

Validation still required:

- Reinstall the final build, then inspect keyboard/layout, dark mode and accessibility sizes.
- Real verified-account OTP, relaunch/refresh, signed-in feed, one text publication and sign-out against the deployed native API release.
- Personal Team physical-device installation. This needs the user to select their actual Apple team; no Team ID is assumed.

## IOS-02 — remaining screens: open

Gradually port media selection/upload, complete composer, drafts, comments/reactions, poll voting, DMs, Groups, Sports, discovery/marketplace and editable profiles. Validate each against existing APIs and preserve the website throughout. Native Colorful mode still needs the full semantic palette as these screens are introduced.

## IOS-03 — Apple capabilities: configuration-gated

Apple linking preparation and App Attest client code exist. Neither is a completed live feature. Default Personal Team builds request no paid entitlements. Apple linking stays hidden until the server can guarantee explicit same-account linking without automatic email merging. App Attest needs paid provisioning, server configuration, real-device evidence and replay/authorization review before enforcement.

## IOS-04 — App Store readiness: open

Production icon/launch assets, privacy manifest/App Store privacy review, account deletion UX, VoiceOver/Dynamic Type audit, background/foreground lifecycle tests, device performance, release archive/signing and dedicated security assessment remain required. Do not present IOS-01 as a complete native replacement for the web product or an App Store-ready release.

## Resume point

Paused at the user's requested stopping point on 2026-09-28. Build and tests are finished; no native commands remain running. The simulator is left booted with the initial app installation. Continue by installing the latest Debug build and completing visual QA, then coordinate live-account testing only after the native API release is approved and deployed.
