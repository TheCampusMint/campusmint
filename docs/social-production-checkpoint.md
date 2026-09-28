# Social production checkpoint

Source audit: September 27, 2026, following release `851e279`, updated for the composer/poll implementation in this working tree. Migrations `20260927002300_community_polls.sql` and `20260927002400_composer_context_read_access.sql` and deployment are still pending at this checkpoint. This is an implementation inventory and backlog, not a claim that every feature below is account-synced. Database tables and interface controls alone do not establish a working production path.

## Composer and poll implementation in this patch

- The primary `+` opens a floating, viewport-aware composer with three starting choices: Post, Poll, and Event. Plain text or media can publish as a Post. Poll requires a question and two to six distinct choices. Event offers a roll call around an existing event or a new hosted event with title, date, start time and place. A roll call does not require an extra caption.
- One bottom Post action publishes once the necessary fields are ready. Optional media, Camera, Club/Event context, location, privacy/duration, official club publishing, comments and Save draft stay behind a secondary `+`. Form controls are disabled while saving/publishing so the visible draft cannot change underneath a pending request.
- Searchable Club/Event selectors use the authenticated, campus-scoped `/api/mintz/context` catalog. Publication rechecks context on the server: linked events are replaced with canonical event details, ended/unavailable events are rejected, and Club publishing requires a server role. Merely tagging a Club grants no publishing or membership authority. Contextual post records are persisted through the existing Mint path; they are not RSVP or Group membership mutations.
- Poll definitions are stored with the Mint and cannot be edited after publication. `/api/mintz/[mintId]/poll` reads totals and saves one changeable choice per account through database functions that repeat visibility/block/privacy checks. The server binds the voter to the authenticated session. Responses expose totals and the viewer's own choice, not a voter list; development polls are explicitly previews with voting disabled.
- `MintPoll` refreshes when an active poll is opened, every 30 seconds while visible, and when focus/visibility returns. These are authenticated HTTP reads, **not Supabase realtime subscriptions**. Migration `02300` must be applied before deploying this version because the Mint feed also reads the new poll column. Migration `02400` grants narrowly scoped catalog reads to the trusted server.
- Drafts retain composer kind, poll choices, event mode, context, privacy, text, selected files and the publish request ID. Legacy host/linked-event drafts restore the relevant workflow. Drafts are explicit saved snapshots on this browser/device, not an account-synced autosave service. Successful posting removes its reopened draft when local cleanup succeeds; a lost-response retry retains the request ID for idempotency.

The source and tests implement these paths. Database application and live two-account/two-device verification remain release checks; this section does not claim they already ran.

## What already has an account-backed path

- Sign-in/profile restoration and edits: `/api/account/me`, `/api/account/complete`, `/api/account/profile`, and `lib/auth/profilePersistence.ts` read and write authenticated account data. This is separate from follows, blocks, friendships, and social preferences in `useProfiles`.
- Mint creation/feed: `lib/content/publishMint.ts` and `/api/mintz` prepare signed direct Storage uploads and finalize durable content before reporting success. The feed reads persisted posts. This does not make every mutation on a displayed post persistent.
- Poll creation/voting and canonical Event/Club attachments now have implemented server paths, subject to the pending migrations/deployment above. This does not complete comments, reactions, DMs or attendance.
- Brand Channel membership: `/api/brand/channels/[channelId]/membership` performs authenticated Supabase join/leave mutations. This is separate from campus Group and Club membership.
- Event and Sports source reads/refresh have server paths; that does not persist a student's RSVP or Event Moment.
- Drafts preserve text and media in account-scoped IndexedDB on one device. They intentionally remain device-local, including the upgraded composer.

These are source-path findings. Verify the applied schema, environment, authorization, and two-device behavior on the target deployment before marking any new feature complete.

## Persistence inventory

| Feature | Current client path | Existing foundation / missing connection |
| --- | --- | --- |
| Polls | `MintPoll` reads/saves via the authenticated poll endpoint and refreshes active visible polls every 30 seconds and on focus/visibility. | Migration `02300` implements durable per-account votes and privacy-safe totals. Apply/verify before deployment; scoped realtime remains future work. |
| Comments and replies | `hooks/useMintz.ts` adds comments to React state; replies use `parentCommentId`. Refresh loses new comments. | `content_comments` and `comment_mentions` exist. Add authenticated read/create/edit/delete APIs, parent/target validation, pagination, attachment Storage, and durable counts. |
| Comment likes/reposts/hiding | `useMintz` updates React state only. | `content_comment_likes` exists; repost/hide semantics still need durable owner-scoped records and unique constraints. |
| Mint appreciation / public endorsement | Account-keyed localStorage via `interactionStorageKey`; no server mutations. | `content_private_appreciations` and `content_public_endorsements` exist. Preserve private appreciation versus public endorsement boundaries; client likes are not a trusted counter. |
| Pins / saves / dwell | `useMintz` persists pins and dwell in account-keyed localStorage; legacy saves migrate into pins. | `mint_pins`, `content_saves`, and `feed_dwell_events` exist. Choose canonical pin/save semantics, persist idempotently, keep private records private. |
| Shares | Native Web Share or clipboard can work; `recordShare` increments in-memory records/counts. | `content_shares` exists. Record a successful supported handoff without claiming the external recipient received/read it; deduplicate retries. |
| Mint edits / delete / archive toggle | `updateOwnMint`, `deleteOwnMint`, and `toggleArchive` in `useMintz` change React state only. | Add owner-scoped server mutations and reconcile the feed. An archive flag is not a private media copy. |
| Follows / blocks / friendships | `hooks/useProfiles.ts` mutates React arrays; these are not saved by the profile API. | `profile_follows`, `profile_blocks`, and `friendships` exist. Server reads and writes must enforce relationship state across every relevant surface. |
| Profile privacy / social settings | `useProfiles` changes local state; production profile persistence covers editable profile fields, not these settings. | `profile_privacy_settings` exists. Persist settings and enforce them in server discovery/feed/message responses. |
| User/content/comment reports | `useProfiles` / `useMintz` append React-state records. No report submission reaches a review queue. | `profile_reports`, `content_reports`, review actions and appeals exist. Add submission receipts and a restricted operational queue. |
| DMs and reply context | `hooks/useDirectMint.ts` stores conversations/messages/order/pins in account-keyed localStorage. Sending immediately labels the local message `delivered`. | `direct_conversations`, `direct_messages`, `conversation_pins` exist. Add durable send/history, valid reply references, recipient access, receipts, retries, pagination, and blocking enforcement. Local `delivered` must not be treated as a delivery receipt. |
| DM attachments | `DirectMintThread.tsx` reads selected files as data URLs with a 4 MB local-preview cap. | Private `message-media` bucket exists, but recipient-authorized signed access and finalize/retry/cleanup paths are unwired. Local data URLs are not account-synced attachments. |
| Profile Notes / conversation state | `useDirectMint` saves the owner's Note, pin/order state and seen state locally. `ProfileNotesStrip` uses development fixtures for other people's Notes. | `profile_notes` and conversation tables exist. Add owner mutations and a privacy-filtered recipient/read path, expiry policy, and synced ordering/read state. |
| Notifications | `hooks/useCampusNotifications.ts` loads development fixture content or an empty production list; only fixture read timestamps are localStorage-backed. `pendingNotifications` in `useMintz` is memory only. | `notifications` and `pending_content_notifications` exist. Generate authorized server events, persist recipient read state, deduplicate and paginate. |
| Campus Group membership | `hooks/useCampusGroups.ts` saves the development membership store in localStorage. | Define canonical Group/Channel membership and request/approval APIs; do not substitute Brand Channel membership as completion. |
| Club membership / organization follows | `hooks/useOrganizations.ts` holds memberships, invitations, submissions, follows and membership-related conversations in React state. | Organization memberships, requests, roles and conversation tables exist. Server transitions must check actor authority and membership type. |
| Event attendance | `hooks/useEventMoments.ts` saves RSVPs in localStorage; counts are combined locally with event source data. | `event_attendance` exists. Persist RSVP/cancellation with server event identity, privacy and ended-event checks. The new durable roll-call post is discussion around a canonical event, not attendance registration. |
| Event Moments | `useEventMoments` saves eligibility evidence, prompts and placeholder-media Moments in localStorage; capture sets `isDevelopmentLocal` and a null media URL. | Add real media upload, consent/visibility, eligibility validation, retention and owner access. Development location simulation is not attendance proof. |
| Stories | `hooks/useStories.ts` holds added Stories, likes and comments in React state. | Story/content tables exist; connect durable creation, views/reactions, expiry and privacy before claiming cross-device Stories. |
| Realtime | No Supabase `channel` / `postgres_changes` subscriptions are wired in the audited social hooks. Poll totals use periodic/focus HTTP refresh. | Durable state comes first; then add private, narrowly scoped subscriptions and reconnect reconciliation. |

The relevant database foundations are migrations `00900`, `01000`, `01200`, `01400`, and `01800`. Some initial policies intentionally allow only owner reads; some later tables have mutation policies. Neither is a substitute for a feature-specific authorization review. In particular, raw cross-user subscriptions must not broadcast private appreciation, reports, blocked-user activity, message attachments, or profile details.

## Recommended implementation order after the composer

1. **Relationships and safety.** Persist blocks, follows and privacy settings; submit reports to a server queue. Make feed/profile/comment/message authorization consume that state. Block enforcement must hold even when a client calls an endpoint directly.
2. **Post discussion and mutations.** Persist comments/replies, appreciation, comment likes, post edits/deletion, pins and share records. Use server-generated IDs and authoritative counts, unique actor/target keys, optimistic rollback and retry keys. Keep the explicit distinction between private appreciation and public endorsement.
3. **Messaging and notifications.** Wire durable DMs, reply references, participant-only attachment access, Notes, receipts and conversation state. Produce notifications from accepted server actions. Add recipient/conversation-scoped realtime, disconnect cleanup and catch-up reads.
4. **Community participation.** Persist Group/Club membership, RSVP/cancellation, and real Event Moments. Keep official organization roles, personal interest, and actual membership distinct. Handle rejected/withdrawn requests and expired events across devices.
5. **Remaining content lifecycle.** Complete Stories, private Archive copies, recovery/deletion, and video processing. Activate and monitor cleanup only under an explicit retention policy and authorized schedule.

Do not bulk-upload browser-local prototype records as if they were verified production history. A migration/import must bind each record to the signed-in owner, validate target visibility and current permissions, and reject unknown/development identities. Reset local state when account identity changes; account-keyed storage alone does not prevent an old in-memory view leaking into a new session.

## Completion tests for each vertical slice

- Account A creates a record on a laptop; the same account on a phone and an authorized Account B see the appropriate durable result. Reload and sign-out/sign-in preserve it. An unrelated or blocked Account C receives no unauthorized row, realtime event or signed media URL.
- A network failure, retried request, repeated tap and reconnect produce one durable mutation with a visible retry/error state. Optimistic counts match the server after reconciliation.
- Subscriptions are scoped to the active account/content/conversation, torn down on logout or navigation, and recover missed changes after reconnect. Realtime is an update signal, not the sole storage or authorization layer.
- Deletion, expiry, changed privacy and blocking invalidate future access. Attachment uploads are owner-bound, checked before publication, and removed only through the approved lifecycle.
- Reporting yields a receipt only after storage succeeds. Notification and message delivery labels reflect confirmed state. A successful local animation is not a persistence test.
- Test access rules directly as multiple authenticated users; development fixtures and service-role-only tests do not prove row-level access enforcement.

## Expressive media checkpoint

| Capability | Present behavior | Remaining production work |
| --- | --- | --- |
| Photo/video picker | Real Mint file selection and signed direct upload; local previews in comments/DMs. | Durable comment/DM attachment flow, progress/cancellation/retry, per-device format checks, and permission/error UX. |
| Camera | Explicit file-input `capture="environment"` hint in the new composer and DMs, opened only by the Camera action. Composer captures use the same media preparation/upload path. | Device/browser testing and richer capture controls; browsers may present their picker instead of a camera. No claim of unrestricted native camera/Photos access. |
| Emoji | Text entry and small inline shortcut rows. | Search/categories/recent choices and keyboard/screen-reader behavior if expanding the picker. |
| GIFs | User-selected GIF files for local comments/DMs. | A real selected provider with current rights/terms, credentials, attribution, allowed caching and restrictions. No pretend search results or licensed catalog claims. |
| Stickers | Small development glyph choices. | Owned assets or an approved provider, attribution/provenance and durable attachment handling. Label or hide development-only choices appropriately. |
| Reactions / reply-to-message | Like/heart animation, comment interactions, local DM replies. | Durable validated records and synchronized state as above; preserve keyboard alternatives and reduced motion. |
| Location / contextual attachments | Searchable campus Event/Club catalog and server-validated contextual post attachments are implemented in this patch; custom location remains manually entered. | Deploy/verify migrations and canonical-context behavior. Request precise geolocation only when the user chooses it. An Event/Club attachment is context, not proof of attendance/membership. |
| Sharing | Web Share plus clipboard fallback. | Authorization-aware links, durable internal shares if offered, and honest cancellation/failure handling. |
| Music | Removed from live Notes/posts controls and track displays. | Keep out of live UI until a licensed/provider solution is selected and implemented. Do not delete historical media or strip audio from users' uploaded videos. |

## Older production work remains open

- **Video:** original MP4/WebM Storage is not a transcoding service. Add asynchronous thumbnail/transcode jobs, failure/retry state, format compatibility and adaptive playback/streaming as required. The 4K/HD preference currently changes image preparation, not video encoding.
- **Cleanup:** `/api/mintz/cleanup` and a retry queue exist, including abandoned-upload protection. `vercel.json` does not schedule it. Finish scheduling authorization, job claiming/concurrency recovery, failure alerts and monitoring; preserve referenced media. No new cleanup job was enabled by this audit.
- **Archive:** migration `01800` creates owner-only archive storage/records. A verified copy/recovery API and worker, success/failure reporting, retention rules and safe deletion are still required. Local archive toggles must not imply a recoverable copy exists.
- **WebAuthn / native authentication:** credential tables are foundations only. Implement server challenges, registration/assertion verification, platform support and recovery before presenting a working protected Archive/auth flow.
- **Creator review:** application submission and the capability-gated `/api/admin/creator-applications/[applicationId]/review` endpoint exist. Authorized reviewer onboarding, external-account control verification, review queue UI and operational audit handling remain. No automatic approval or fabricated reviewer grants.
- **Moderation:** review/appeal tables are foundations; durable report intake, authorized queue UI, actions/appeals, evidence retention and notifications remain. AI triage must not be presented as human review or a final moderation decision.
- **Third-party providers:** provider-registration tables are not active integrations. Store approved provenance/permissions and connect actual provider APIs only after terms and configuration are complete; do not claim commercial media parity from placeholders.
- **SMS:** policy remains disabled. Only enable after provider selection and actual send/verify, abuse limits, recovery and support are implemented. Existing email OTP remains the current student verification path.

## Border and shadow audit notes

The bottom notch already uses semantic surface/accent colors and has no rendered decorative border or shadow. This pass removes its obsolete shadow transition, replaces fixed-color collapsed dots, removes inverse back/close icon drop-shadows, makes header icons/notification badges use semantic tokens, and removes the hard-coded white/bordered/shadowed Note bubble. Full tap targets and focus outlines remain.

Many older component class strings still contain `shadow-*`/border utilities, but the application shell explicitly suppresses decorative shadows and container borders. Source-string matches alone do not prove a visible defect. Portals and standalone workspaces must receive the same tokens/reset rules; check computed styles and keyboard focus in Light, Dark and Colorful before closing the visual audit. Form boundaries, structural separators and focus indicators remain functional UI.
