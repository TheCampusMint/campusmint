# Campus Mint iPhone testing checklist — October 12, 2026

This is a **first visual parity checkpoint**, not the completed native migration. The production mobile website remains the design reference and was not changed. The user will perform the remaining phone checks, per their October 12 instruction. No live content was published for these checks.

## Already checked

- Signed iPhone build succeeds; 19 native security/contract checks pass.
- Physical phone: signed-in feed/header, compact notch, Settings, dark Forest composer, Sports and Clubs, and Search/Food were captured.
- Dark + Forest worked on the phone, confirmed by the user. Composer remained dark and borderless.
- The Messages notch label initially wrapped; corrected widths were observed on the phone with all labels on one line.
- Native Sports read real campus data: Football, Volleyball, Equestrian and football's 3–3 record at the time of checking. Do not treat that record as timeless.
- Sports density, Settings label selection/sheet height, Clubs selected pill/spacing, and dark search prompt contrast received follow-up corrections. The final build includes those corrections; their full visual acceptance is still pending.

## Your phone checks

- [ ] **Appearance:** switch Light → Dark → Colorful. Try School and Forest. Check the header, notch, selected controls, profile, Search, Sports and composer. No white flash or unreadable selected text in dark mode. Close/reopen the app and confirm the chosen appearance persists.
- [ ] **Navigation:** tap Messages, Mint, +, Sports and Groups. Labels should remain on one line at normal text size; + is a bare icon. Content should scroll above the notch and no controls should be hidden behind the home indicator.
- [ ] **Composer:** open +, tap outside to close, reopen and type. Spaces alone must not enable Publish. Text reveals Privacy; choosing privacy reveals Duration. Check the keyboard, long text, expanded options, scrolling and close button on your phone. The leaf must use the accent and no selected option should gain a border.
- [ ] **Posting:** if you choose to publish a test, explicitly select Only me, then use the leaf. Confirm the post really saves, respects privacy and survives reopening. Check a temporary post separately if needed. Text publishing is available; media/poll creation and other attachments still require the website.
- [ ] **Feed/profile:** compare text size, card spacing and avatar treatment with the mobile website. Check image/video shape, comments opening, share sheet and the public shared link. Profile should restore the same account after reopening. Native profile editing, follower counts and Tagged are not complete.
- [ ] **Sports:** confirm up to three sports, switch between them, scroll the full schedule and compare records/results with the website. Future-year games must remain Upcoming. Refresh and report any result reverting to Awaiting result. Open an official source. Check that the last game remains reachable above the notch.
- [ ] **Clubs:** Discover/My clubs selection should have a compact accent pill. Search should be readable in dark mode. Check populated clubs when available; the current account had no clubs to exercise detail content. Creation, membership, invites and management are not yet native.
- [ ] **Search:** switch Food → Events → Sell and back quickly, filter food categories, type a query and refresh. Results from the previous category should not leak into the new one. Check long titles, empty states, links and native sharing. Food legitimately says “Nearby food is coming soon” while the provider key is absent. This native pass uses campus coordinates, not device location.
- [ ] **Messages/comments/notifications:** check screen spacing, close/back controls, keyboard position and loading/error states. Full send/reply/like/pin/read checks remain blocked by the social API release gap below; an availability error is not evidence that messages were lost.
- [ ] **iPhone usability:** increase text size, enable VoiceOver or Reduce Motion if you use them, rotate the phone, and check with the keyboard open. Note clipping, overlapping controls, unreadable text, and taps that do nothing.

## Known unfinished work — not bugs to rediscover

- Native composer media uploads, polls, club/event attachments, resolved mentions, searchable selectors, drafts and publishing animation remain unfinished. The current @ control inserts text; it does not resolve a user identity.
- Native appreciation/save/post menus and complete poll voting are not yet implemented. Feed counters reflect the current API response and are not a complete native interaction state implementation.
- Other Settings sections and profile editing are website handoffs. Native signup is also a website handoff.
- Club creation/join/approval/invites/admin tools and marketplace listing/contact flows are website handoffs. Existing club details use the club's real web handle URL.
- Native Sports rankings, in-app game details, paid catalog browsing and developer campus selection remain unfinished.
- Native device-location access, restaurant photos/reviews/attributions, public event share routes and complete listing details need more work. Food/provider configuration is unchanged.
- Social-sync migration is already live, but local social API commits have not been deployed. The phone previously showed “Campus Mint is unavailable. Try again.” for Messages. Do not mark account-synced social flows verified until that release is deployed and tested.
- No native screen is marked fully migrated yet. Some typography/layout is now matched, but complete behavior and physical acceptance are still pending.

## How to report an issue

Screen + theme + exact steps + expected/actual result. A screenshot is useful for spacing/color problems. For posting or session issues, describe the error without sharing tokens, codes or private credentials.

## October 13 user acceptance

The user reports that everything on this checklist passed on the installed build. This records user acceptance of the tested visual/available behavior. The known unfinished implementation and production release gaps above remain separate; this is not evidence those features were added or deployed.
