# Security operations and launch gates

Latest evidence and outstanding live findings: [October 1 checkpoint](../checkpoints/2026-10-01-security-native-validation.md). Hosted configuration, backups and recovery remain unverified where marked below. CSP still permits inline scripts for compatibility; it is not yet a strict nonce policy.

Checkpoint **SEC-OPS-01** · 2026-09-27. These are labeled operational requirements, not claims that hosting or Supabase settings have been changed. Keep the web app available while the native client reuses the same account/database/API boundary.

| Checkpoint | State | Completion evidence |
| --- | --- | --- |
| SEC-OPS-KEYS | Repository/history/browser-output scan performed; no candidate exposed credential found in the initial scan. | Run scanner again after final build; store counts and findings without secret values. |
| SEC-OPS-LIVE-RLS | Pending live drift inspection and staged migration deployment. | Saved read-only policy/grant/bucket inventory and staging permission results. |
| SEC-OPS-ADMIN | Table and server gate prepared; no administrator automatically enrolled. | Separate operator Auth account, MFA enrolled, explicit least-privilege role and capability approved, successful AAL2 gate test. |
| SEC-OPS-LIMITS | Distributed quota RPC prepared. | Server secret configured, all abuse routes exercised; shared-limit and outage behavior verified across instances. |
| SEC-OPS-LOGS | Private append-only audit storage prepared. | Restricted log sink, request IDs, alert test and no secret/content payloads in logs. |
| SEC-OPS-RETENTION | Bounded 90-day audit and expired quota pruning RPC prepared. | Authorized daily scheduler, monitored failures and oldest-row lag below retention target. |
| SEC-OPS-BACKUP | **Not verified/configured.** | Dashboard plan/backup retention/PITR evidence plus separate private-object backup inventory. |
| SEC-OPS-RESTORE | **Not performed.** | Restore into isolated staging, measure recovery time/data loss, test identity ownership and Storage recovery. |
| SEC-OPS-ERASURE | **Not complete.** | Reviewed account-erasure retention policy and end-to-end deletion test including private objects, sessions and backup expiry. |
| SEC-OPS-NATIVE | Build-time configuration / native proof checks must finish before launch. | Real Team ID/bundle ID/Apple configuration, device attestation verification, replay denial and Keychain tests. |

## Credentials and rotation

Run `node scripts/security/scan-secrets.mjs --history`. It checks working-tree source, distinct historical Git blobs and existing browser build outputs. It reports only paths, line numbers and secret types. It also looks for configured server-secret literals in browser artifacts without printing them. This is pattern-based detection; a clean scan does not prove every external log, dashboard, old deployment or shared file is clean. Do not upload `.env` files into reports.

No rotation was performed without evidence of exposure. If a finding is confirmed:

1. Classify the credential and revoke/rotate it at its issuing service. For Supabase, distinguish publishable/anon keys from secret/service-role credentials and JWT signing secrets; use the provider's documented rotation process rather than treating all keys identically.
2. Set the replacement only in protected server deployment settings, redeploy the trusted server, verify authorized operations and then invalidate the compromised credential. If immediate compromise demands revocation first, record the temporary service impact.
3. Revoke affected sessions if signing/auth credentials were involved. Review access/audit logs and Storage object downloads for the exposure window. Remove leaked material from source/history/artifacts without assuming removal revokes it.
4. Re-run the browser-output scan and verify the old key is rejected. Record timestamps and key identifiers, never values.

[Supabase API key security](https://supabase.com/docs/guides/api/api-keys)

## Administrator separation

A username, email suffix, client metadata flag or ordinary creator capability never grants operator access. Use a separate Auth account for administration, enforce MFA/AAL2, then assign `security_administrators` through an approved database administration session. The application service credential has SELECT only on this table, so an ordinary API cannot self-promote. Keep reviewer capability distinct from the administrative role; moderation requires both where appropriate. No existing user, including the campus-preview owner, is automatically an administrator.

For revocation, set `revoked_at`, revoke capability if applicable, revoke active administrator sessions and verify denial. Audit privileged decisions without storing report bodies, messages, OTPs, passwords or session tokens. Record a request ID, action, outcome and small allowlisted identifiers/codes. Avoid raw IP addresses; quota identifiers are action-scoped HMAC digests with a dedicated server secret.

## Quotas and audit retention

`consume_security_rate_limit(p_key_hash, p_limit, p_window_seconds)` is service-only. Its fixed windows are atomic across server instances, with a bounded counter, at most one bucket per HMAC key and a maximum one-day window. Include the action/window identity in the HMAC input. Combine user and trusted-edge IP limits where useful; do not trust arbitrary forwarded headers. Rate limiting does not replace authorization or body/upload validation.

Fixed windows can permit a burst across the boundary. For expensive provider calls, use a separate global/day budget and spending limits in the provider dashboard. Authentication limits also need the Supabase Auth/provider protections because clients can call the public Auth service directly; a website-only limiter cannot intercept those requests.

`security_audit_events` is append-only for the application service role, with 2 KB object metadata. The database administrator remains able to change it; export security events to a separately protected append-only sink for stronger tamper resistance. Configure denial/error spikes, repeated OTP failures, privilege changes, quota failures and cleanup failures as actionable alerts. Retain audit metadata for 90 days unless a reviewed incident retention policy requires otherwise. The pruning RPC deletes at most 5,000 expired quota buckets and 5,000 old audit events per invocation. Schedule it, rerun when capped, and alert when backlog exceeds retention; the migration itself starts no job.

## Backups and recovery

Verify the actual Supabase project plan, available backups and retention in its dashboard. Enable the appropriate database backups/PITR for the required recovery objective only with the owner's billing authorization. Record the chosen recovery point objective and recovery time objective rather than promising instant/no-loss recovery.

Database backups do not include the underlying Storage file bytes. Back up private `mint-media`, `message-media`, `mint-archive` and avatars separately using a least-privilege operator process. Keep the object index/version metadata needed to reconnect restored rows with restored objects, encrypt backups, restrict access and define expiry/deletion handling. [Supabase backups](https://supabase.com/docs/guides/platform/backups)

Before launch and periodically afterward, restore to an isolated project with production emails/SMS/webhooks/jobs disabled. Verify account IDs, profile ownership, RLS, messages, group membership, signed media, quota/audit objects and active migration versions. Verify that a deleted account cannot be recreated by restoring stale application data into a live Auth project. Record the restore timestamp, checksum/object coverage, elapsed time, failures and follow-up owner. Do not run a destructive restore against production to test this.

## Staged rollout and rollback

1. Apply reviewed migrations to an isolated staging project, never directly through a client app. Run the full migration/permission suite and `scripts/security/live-drift.sql` there.
2. Configure server secrets, limiter policy and cron authorization before enabling dependent routes. Verify bearer tokens and cookie sessions resolve to the same Supabase user ID. Validate signed upload and private download against actual hosted Storage, since local database tests do not implement its HTTP layer.
3. Check logged-out, owner, stranger, blocked, unverified, member/non-member, moderator and revoked-administrator identities. Include direct Supabase REST/RPC attempts, not just UI tests.
4. Use a reviewed release window for production schema/server deployment and smoke tests. Preserve the migration ledger and release commit. Do not re-enable broad client grants as an emergency UI fix.
5. Roll back application code only to a version compatible with the new restrictive grants. Prefer forward fixes for database policy issues. Preserve records and audit evidence.

## Pre-App-Store security review

Test account takeover and explicit Apple account linking without email auto-merge; IDOR; private-message and signed-URL leakage; membership revocation; forged user/campus/role claims; oversized bodies and misleading upload MIME; quota bypass across clients/instances; expired or replayed attestation challenges and counter rollback; MFA/admin escalation; deletion/backups; and reverse-engineered native requests. Run with two distinct ordinary users and a separate administrator. Record a pass/fail artifact for each case and close high-risk findings before launch. App Attest supplements authentication/authorization; browser requests remain subject to server controls and native attestation cannot be claimed solely by a header.
