# NATIVE-PARITY-06 — November 2, 2026

## Delivered

- Profile posts load from an author-filtered server query instead of filtering whichever posts happen to be in the home feed. Both your profile and other people's profiles can load older history.
- Native home feed and profile history expose More posts, progress, empty and retry states. The server scans at most 100 candidates per request, orders by full database timestamp plus UUID, and returns a next cursor even if privacy removes every candidate. Ranking remains within each candidate batch, not an unbounded global sort.
- Page cursors use Node's AES-256-GCM with a domain-separated server key, fresh nonces, authenticated account/filter scope, a 24-hour lifetime, and bounded input. They conceal private scan positions. No cursor replaces authorization: every request applies blocks, account/post privacy, membership, expiry and archive checks again. Microsecond timestamps survive without JavaScript date rounding.
- Native realtime refresh reauthorizes already-loaded history, removes inaccessible posts and respects updated Not interested preferences. Refresh/next-page responses are generation guarded; account changes reset visible history and reading state. Errors in reconciliation clear stale content.
- Fixed server ranking dropping accepted friendships after the permission filter. Private-account and connections-only posts now retain eligibility through ranking; removing friendship revokes that access. No unilateral follow is treated as a privacy grant.
- Foreground native feed reading now uses the web's positive dwell formula: 8 seconds before a dwell signal, logarithmic weighting, a 120-second dwell cap, and combined appreciation/endorsement weight capped at 4. Skips never create negative feedback. Own posts are excluded.
- Reading pauses when the app leaves the foreground, the feed leaves the screen, the composer/header panel opens, or a post's profile/comments/context is open. At least half of the card's visible-height target must be in the viewport; tall cards use the viewport as their target. Stalled timer intervals are discarded.
- At most 500 posts of session memory and 50 signals per batch. Foreground retries run every 30 seconds; failed batches stay bounded in memory, account changes erase them, successful acknowledgments preserve newer observations. This is session learning, not durable offline telemetry. Force-quitting before sync can discard pending signals. No background tracking or third-party analytics added.
- Existing authenticated `/api/feed/preferences` remains authoritative: it derives author/topics, checks access, preserves explicit dismissal, and stores account-owned signals. Aggregate meaningful-view counts come from that existing storage. Passive writes don't trigger an immediate UI reordering.

## Validation

- Full web/backend suite: 491 passed; after the final friendship fix the affected 17 route tests passed again.
- Native contract/security runner: 46 passed.
- Production Next build and signed generic-iPhone build passed; iOS 17 support retained.
- Lint and diff whitespace checks passed.
- Secret-pattern scan: 547 working-tree files / 16 browser files, no findings. Git history was not scanned.
- Live read-only ACL checks confirmed existing server access to content/preferences and no authenticated browser access to preferences. Direct event-attendance table reads remain disallowed; no permissions were broadened.
- No migration, production test posts/messages, or changes to real user preferences were needed for QA.
- Physical-device launch/visual checks remain user-owned. The preceding developer-profile trust blocker has not been claimed resolved.

## Still open

This is a continuation checkpoint, not complete web/native parity. DM media/stickers, profile-photo uploads, own-post editing/archive/deletion, reports/appeals/review tools, friend requests, remaining Settings/legal flows, broader native deep links, global campus preview, Event Moments/Archive and remaining provider/Apple/launch operations still require work. Ranking still lacks some organization/event-directory/attendance context; it is not claimed to duplicate every web ranking input. Existing paid-capability/provider gates remain unchanged.

Sources checked: Supabase changelog (2026-11-02), JavaScript order and OR documentation. The coming TLS cipher deprecation requires modern TLS clients; the app retains ATS and the current native HTTPS stack.
