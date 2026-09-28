# Nearby discovery and feed preferences

## Interface copy

Removed or shortened more than 120 helper passages across settings, onboarding, profiles, clubs, groups, dining, housing, sports, messages and discovery. Essential field labels, errors, source credits and brief local-preview/privacy notices remain. The post menu has no Back or Close row; clicking outside or pressing Escape dismisses it, with keyboard focus restored to the trigger.

## Release order

Apply `supabase/migrations/20260928002700_feed_preferences.sql` before deploying this release. The feed reads its aggregate view-count view. The migration creates account-private recommendation records and a server-only aggregate view; browser roles have no direct access. Production application is pending the owner's explicit approval.

## Google Places setup

Food is intentionally unavailable until `GOOGLE_PLACES_API_KEY` is configured in the hosting environment. Enable Places API (New) for that key, restrict it to the required API, and keep it server-only. Redeploy after adding the environment variable. Never use a `NEXT_PUBLIC_` key. The same server credential can serve the existing location selector.

The food adapter requests up to 20 nearby results per cuisine, filters them to ten miles, and sorts the returned results by rating and review count. This is not an exhaustive list of every restaurant or public review. Photos, ratings, reviews and required source/author attributions come from Google; nothing is fabricated when the provider is unavailable. Provider responses are not stored in the database. Check the app's public Terms/Privacy information and Google project configuration before enabling the provider.

## Location and event coverage

Browsing coordinates stay in memory. Previously granted location permission enables an active-page watch; otherwise the interface offers a location button and explicitly falls back to the campus center. Results refresh on movement, return to the app and a five-minute interval. Hidden pages stop watching location.

Events combine geocoded public calendar records with Destination Bryan's current calendar entries for the Bryan area. The regional adapter uses a bounded first-page import, cached for 30 minutes. Other regions need their own trustworthy event sources; this release does not claim nationwide coverage of every event. Source links remain available, including on the standalone guest page.

Sell retains the existing campus-network and messaging permissions. Other people's listings must be within ten miles and have a shared area. Sellers can opt into an approximate area (coordinates rounded to two decimal places); otherwise their listing is visible only to them. Exact coordinates are not returned to buyers. Existing listings without an area are not guessed into nearby results.

## Sharing and recommendations

Public post, poll, media, club and event links open as standalone read-only pages without sign-in. Private accounts, restricted posts, archived/expired content and member-only club content fail closed. Private media receives a short-lived URL only after the public-share policy passes.

Existing feed rules remain. Meaningful dwell and appreciation add capped interest boosts; skipped posts stay eligible. Popularity and exploration slots preserve variety. Not interested immediately hides that post; Creator and Content also strongly suppress related recommendations. Topic matching uses available captions/hashtags, not visual recognition. Account preferences sync on focus and periodically while visible, with local retry support; this is not a realtime social-feature migration.

## Validation

388 tests, lint and the production build passed. Mobile checks covered concise settings, off-campus events, guest event links, source time zones and persistent Not interested choices without hiding the viewer's own posts. Google live results remain untested until the owner adds a key. Authenticated production upload/account checks remain with the owner as requested.
