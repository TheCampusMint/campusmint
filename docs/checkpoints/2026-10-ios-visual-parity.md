# IOS-VISUAL-01 — production parity, October 9, 2026

Source of truth: https://www.thecampusmint.com, inspected at 393 × 852 CSS pixels. Website code was not changed. This work supersedes the separate generic native visual treatment; it is not acceptance of the remaining screens.

## Implemented, awaiting physical visual acceptance

- Bundled official Geist Regular/Bold/Black and the upstream OFL license, matching the website font family rather than substituting SF typography.
- Added CampusDesign.swift: neutral light/dark surfaces, existing shared Colorful palette, selected brand/campus/curated accent computation and the same contrast/mixing algorithm as data/appearance.ts. All 20 current campus colors copied from the web catalog. The appearance picker/accent settings screen still needs its parity pass.
- Added the web-shaped leaf icon and reduced-motion-aware press feedback.
- Rebuilt account selection and existing-account email/code sign-in with 20pt side insets, 36pt black headings, 10pt tracked eyebrow, rounded 16pt borderless input surfaces and full-width capsule action. Text input keeps native autofill, keyboard, focus and Dynamic Type. Signup options explicitly open the existing web setup; native signup is not claimed implemented.
- Preserved Keychain, server verification, ATS and account identity behavior. Preserved the user's pre-existing Xcode signing, scheme and plist changes.

## Evidence and blockers

- Production measured sign-in: background #fafafa; text #171717/#595959; campus accent #500000; Geist 36/900 heading with -1.62px tracking; eyebrow 10/900 with 1.8px tracking; 20px horizontal inset; 54px email field; 52px primary action; 16px input radius. Native safe-area and keyboard placement still require physical comparison.
- Signed physical-device Debug build succeeded for the connected iPhone 17 Pro (Fawzan). Xcode showed the app running on Fawzan. This is execution evidence, not a completed visual comparison.
- 15 existing native security/contract checks passed. No website build/deployment needed for this native-only change.
- Production browser is signed out; the signed-in screens cannot yet be compared to the source of truth. User was asked to sign in in the opened Chrome tab.
- iPhone Mirroring requires first-time user setup. Xcode view capture found the app in a background scene and therefore captured the privacy cover, not a usable screen. The app's privacy cover was preserved; no bypass was introduced. Device Hub accessibility timed out twice.

## Screen acceptance register

| Screen | Production inspection | Native implementation | Physical side-by-side acceptance |
|---|---|---|---|
| Account / sign-in | Measured live at 393 × 852 | First visual pass built | Pending foreground phone / mirroring |
| Mint feed | Requires production sign-in | Existing basic screen; not migrated | Pending |
| Floating bottom notch | Requires production sign-in | Existing system tabs; not migrated | Pending |
| + composer | Requires production sign-in | Existing native sheet; not migrated | Pending |
| Profile | Requires production sign-in | Existing generic profile; not migrated | Pending |
| Search / discovery | Requires production sign-in | Native screen incomplete | Pending |
| Sports | Requires production sign-in | Native screen incomplete | Pending |
| Clubs | Requires production sign-in | Native screen incomplete | Pending |
| Events | Requires production sign-in | Native screen incomplete | Pending |
| Messages | Requires production sign-in | Existing functional screen; visual pass pending | Pending |
| Notifications | Requires production sign-in | Existing functional screen; visual pass pending | Pending |
| Marketplace | Requires production sign-in | Native screen incomplete | Pending |
| Settings / appearance | Requires production sign-in | Theme foundation only; screen pending | Pending |

No screen is marked migrated until the user-required physical iPhone comparison passes. No website push/deploy and no production database changes were made for this visual work.

## IOS-VISUAL-02 — October 12, 2026, signed-in first pass

The earlier sign-in and Mirroring blockers are resolved. Production was inspected while signed in at 393 × 852; physical iPhone Mirroring can capture the foreground app, but coordinate taps fail with `noWindowsAvailable`. The user is navigating the phone for the comparisons. Xcode Run installs and launches the signed build on Fawzan successfully.

### Implemented in the working tree

- Replaced the system TabView with the 56pt campus header and a compact, five-control floating notch (Messages / Mint / + / Sports / Groups), using neutral surfaces, selected accent, no decorative outlines/shadows, and 44pt interaction targets. The first physical capture exposed a wrapping Messages label; corrected the individual slot widths to keep the label on one line.
- Reworked feed typography, 40pt author avatars, campus/time labels, borderless 24pt post surfaces, media aspect preservation, comments and share placement. Counts are decoded from the API; missing counts are not invented. This does **not** yet add native appreciation, saves, profile navigation, post menus, or full poll voting.
- Replaced the system text-composer sheet with a centered floating borderless composer, progressive privacy and duration choices, public/permanent defaults, outside dismissal and leaf publish button. Privacy is sent to the server. Expiration and retry identifiers remain stable during retries. There is no native media upload/poll/club/event attachment UI yet; those remain explicitly labeled website handoffs. `@` currently inserts text, not a resolved identity mention; hashtag discovery and account selectors remain pending. No draft storage or leaf-publishing animation is claimed.
- Added native Light/Dark/Colorful and brand/school/curated accent controls. Corrected mode previews to match the web's segmented colors and label-only selection, and shortened the Settings sheet. Other Settings sections are still a labeled website handoff.
- Reworked the profile surface, author typography, existing bio/major, verified indicator and own loaded posts. Editing remains on the website. Follower counts, all-post pagination and Tagged are not implemented.
- Restyled existing Messages, comments and notifications with smaller typography, neutral surfaces, reduced chrome and custom panel headers while preserving existing send/reply/read/delete/pin actions. These still need physical comparisons and production API verification. Native inbox search currently filters loaded conversations, not people lookup; Profile Notes are not migrated.
- Added authenticated, allowlisted GET resources and native read views for Sports, Clubs, nearby Food/Events and marketplace. Campus coordinates are copied from the existing campus catalog; no device-location permission is requested or enabled. Discovery guards against stale async responses. Nearby provider configuration/errors stay truthful; no Google integration is fabricated.
- Sports uses the existing school's catalog, full-year dates, in-season then active-favorite then campus order, at most three sports, and conservative record logic. It does not synthesize results. Rankings, native game details, paid catalog and campus testing controls remain pending.
- Clubs respects the server's returned visibility and membership fields. Creation/join/invitation/edit workflows remain website handoffs. Marketplace posting and seller messaging remain website handoffs. Restaurant photos/provider attribution UI and native location behavior remain pending.

### Validation and physical evidence

- Signed iOS Debug build succeeds after the latest spacing corrections. Logs: `/private/tmp/campusmint-parity-build.log`.
- 19 native security/contract checks pass, including four added checks for seasonal favorites, future-year game dates/incomplete records, privacy/expiry retry encoding, and allowlisted authenticated query transport. Logs: `/private/tmp/campusmint-parity-core.log`.
- `git diff --check` passes. No Next.js files, database policies, secrets, or deployed website code changed in this pass.
- Physical feed/header/notch captured. Geist and dark neutral surfaces render; first notch label wrapping was found and fixed, awaiting confirmation on the relaunched build.
- Physical Settings captured. User confirmed Dark + Forest works. Compared to the live mobile website and adjusted sheet height and label-only mode selection; latest geometry still needs recapture.
- Physical empty + composer captured: centered, dark, borderless, selected green preserved. Keyboard layout, privacy/duration interaction, nonempty publishing and full feature parity remain unverified.
- Production web's temporary theme was restored to its original **Light + School** selection after comparison. The phone's Forest selection was chosen by the user and preserved.
- The previous release's social API deployment gap remains: the social migration is live, but the local social-sync commits are not deployed. Earlier native Messages displayed a real availability error. Do not present that as an empty inbox or mark cross-device social QA complete.
- Production Sports previously switched a finalized game back to pending during refresh. Keep provider-result regression investigation separate from visual parity; no website score/provider changes were made here.

### Resume point

The corrected build has been launched through Xcode on the physical phone. User has been asked to open Sports after the feed returns. Capture that screen, confirm the revised notch, then continue screen-by-screen physical comparison. **No screen is marked fully migrated**: the functional omissions above and user-required physical checks are still open. Preserve pre-existing project signing/scheme/plist edits. All parity changes remain uncommitted; nothing was pushed or deployed.

### End-of-pass update — October 12

- User explicitly changed the verification workflow: finish independently and provide one checklist; they will do further phone QA. Stop asking them to navigate every screen.
- Physical Sports showed real Football/Volleyball/Equestrian data and a 3–3 record matching production at inspection. The revised notch labels fit on one line. A subsequent patch matches the website's compact game rows, grouped Sports surface, record placement, selected sport pill and next-game summary. This final layout patch builds; recapture remains for user QA.
- Physical Clubs showed the same empty result as production. Added the missing selected Discover pill, tightened spacing, and explicitly themed placeholder text after comparison.
- Physical Search/Food matches the main category layout and honest provider-unavailable state. Its placeholder contrast correction is in the final build.
- Composer height now respects the keyboard-reduced viewport while keeping its scrollable floating surface. Keyboard interaction still needs user QA.
- Final checklist: `docs/checkpoints/2026-10-12-iphone-checklist.md`. It lists known missing native flows separately from the visual tests, so a partial pass cannot be mistaken for finished migration.
- Final signed iOS build succeeds and diff whitespace checks pass. No website code was modified, and no push/deployment or new database migration was performed.


## October 13 — accepted visual baseline and native posting checkpoint

The user reported all items in the October 12 checklist passed on the build they tested. This accepts those available screens/behaviors; it does not mark the known unfinished features complete.

New implementation:
- Native floating composer with PhotosPicker, up to six photos/videos, borderless poll editor (two to six unique answers), caption-optional media/poll posts, vertical privacy/duration options, visible Drafts and Save draft actions.
- Autosave on edits/dismissal; account-UUID-scoped, iOS Complete File Protection local drafts, excluded from backups. Tokens and upload capabilities are never stored in draft metadata. Drafts remain device-local, not cloud-synced. Reopening retains the publication retry ID; content edits create a new one. Removing a draft removes its local attachments.
- Photos are oriented/re-encoded without original EXIF/GPS, fitted without cropping/upscaling to 2048px by default or 3840px opt-in. Video exports to MP4, 1080p by default or 4K opt-in; actual exported dimensions are recorded. HD / 4K defaults off. Limits remain 12 MB/photo, 100 MB/video, 150 MB total and six attachments. GIF animation is explicitly unsupported, never silently flattened.
- Direct scoped Supabase uploads use existing prepare/upload/publish API and cleanup jobs. Native requests preserve App Attest exact-body binding. Storage receives only its upload capability, never an account bearer token. Host/path/owner/request/order/file-size validation and no-redirect transport remain enforced. Existing server validation remains authoritative. `/api/native/config` adds only the public Storage origin, no keys.
- Native poll voting uses existing authenticated poll API and server-returned totals/selection. No optimistic success claims. Leaf publication animation and haptic run only after server success; Reduced Motion uses a fade.

Validation: 25 native contract/security checks pass, 473 web/database tests pass, lint and production web build pass, signed iOS build passes. Secret scan: 525 working-tree files and 16 browser files, no pattern findings (not a complete historical secret audit). Final screenshot/device posting QA remains user-owned, as requested. Xcode launch encountered a locked physical iPhone. No real posts, uploads or votes were created in the user's account by the agent.

Release: remote main was still cfc51de when inspected. Social migration remains already applied and was not replayed. Vercel project access returned 403; no installed Vercel CLI, browser sign-in also expired. User sign-in requested while implementation continued. Record the final commit/push/deployment evidence separately; a successful local build or commit is not a deployment.

Still open: native club/event attachments, resolved mentions/hashtag discovery, cloud draft sync, video preview/thumbnails/streaming worker, full camera/location flow, private message attachments, native scoped realtime, remaining settings/profile/club/marketplace actions and broader production workload. Music remains absent; no GIF/sticker provider or paid tier enabled.

Final device evidence: Xcode subsequently confirmed “Running Campus Mint on Fawzan” for the final reviewed build (PID 8995). iPhone Mirroring reported the phone in use, so no new composer screenshot or live posting was claimed.
