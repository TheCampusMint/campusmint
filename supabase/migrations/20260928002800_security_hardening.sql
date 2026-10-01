-- CHECKPOINT SEC-DB-028: forward-only hardening, no account/post deletion.
-- Apply only after the API guards are deployed in a staging environment and
-- scripts/security/database-runtime.sql passes there. No administrator is seeded.
begin;

-- Supabase grants and RLS are separate gates. New objects must opt in explicitly.
revoke create on schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges revoke execute on functions from public, anon, authenticated;

-- Exact app-owned inventory through migration 027. Extension-owned objects are
-- intentionally excluded. Revoke column ACLs too: table-level REVOKE is not enough.
do $hardening$
declare
  relation_name text;
  column_names text;
  policy_row record;
begin
  foreach relation_name in array array[
    'universities', 'data_sources', 'data_sync_runs', 'academic_programs',
    'academic_terms', 'courses', 'course_program_relations', 'instructors',
    'campus_entities', 'buildings', 'course_sections', 'section_instructors',
    'community_submissions', 'community_submission_confirmations', 'aliases', 'data_change_events',
    'dining_locations', 'housing_entities', 'external_place_links', 'campus_reviews',
    'housing_units', 'housing_rates', 'amenities', 'entity_amenities',
    'entity_photos', 'university_marketplace_policies', 'marketplace_verified_students', 'marketplace_listings',
    'marketplace_listing_photos', 'marketplace_offers', 'marketplace_favorites', 'marketplace_transactions',
    'marketplace_reports', 'campus_networks', 'campus_network_universities', 'marketplace_sports_ticket_details',
    'organizations', 'organization_memberships', 'organization_officers', 'organization_announcements',
    'organization_submissions', 'profile_identities', 'profiles', 'profile_privacy_settings',
    'profile_classes', 'profile_organizations', 'friendships', 'profile_follows',
    'profile_blocks', 'profile_reports', 'content_locations', 'content_event_details',
    'social_content', 'mints', 'stories', 'content_media',
    'content_likes', 'content_saves', 'content_shares', 'content_comments',
    'hashtags', 'content_comment_likes', 'content_hashtags', 'content_mentions',
    'content_tags', 'comment_mentions', 'story_views', 'story_reactions',
    'content_reports', 'pending_content_notifications', 'content_tagged_organizations', 'organization_roles',
    'organization_membership_requests', 'conversations', 'organization_membership_contacts', 'conversation_participants',
    'brand_profiles', 'brand_channels', 'brand_channel_memberships', 'brand_channel_posts',
    'campus_events', 'event_attendance', 'sports_program_snapshots', 'direct_conversations',
    'direct_messages', 'conversation_pins', 'profile_notes', 'notifications',
    'mint_pins', 'content_private_appreciations', 'content_public_endorsements', 'feed_dwell_events',
    'creator_profiles', 'creator_applications', 'account_capabilities', 'phone_verification_settings',
    'phone_verification_states', 'phone_verification_challenges', 'media_cleanup_jobs', 'archive_preferences',
    'private_content_archives', 'private_archive_media', 'web_authn_credentials', 'media_provider_registrations',
    'content_review_actions', 'content_review_appeals', 'creator_eligibility_policies', 'publisher_communities',
    'mint_poll_votes', 'marketplace_messages', 'feed_preferences'
  ] loop
    execute format('alter table public.%I enable row level security', relation_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', relation_name);
    select string_agg(quote_ident(attname), ', ') into column_names
    from pg_attribute where attrelid = format('public.%I', relation_name)::regclass
      and attnum > 0 and not attisdropped;
    execute format('revoke select (%s), insert (%s), update (%s), references (%s) on public.%I from public, anon, authenticated',
      column_names, column_names, column_names, column_names, relation_name);
    -- Historic mutation policies cannot become bypasses when grants change later.
    for policy_row in select policyname from pg_policies
      where schemaname = 'public' and tablename = relation_name and cmd <> 'SELECT'
    loop
      execute format('drop policy %I on public.%I', policy_row.policyname, relation_name);
    end loop;
    if exists (select 1 from pg_attribute where attrelid = format('public.%I', relation_name)::regclass and attname = 'is_development') then
      execute format('create policy campusmint_exclude_development on public.%I as restrictive for select to anon, authenticated using (not is_development)', relation_name);
    end if;
  end loop;
end;
$hardening$;

-- Public source-backed directory reads keep their existing trust/status RLS.
grant select on public.universities, public.academic_programs, public.academic_terms,
  public.courses, public.course_program_relations, public.instructors,
  public.campus_entities, public.buildings, public.course_sections,
  public.section_instructors, public.aliases, public.dining_locations,
  public.housing_entities, public.external_place_links, public.campus_reviews,
  public.housing_units, public.housing_rates, public.amenities,
  public.entity_amenities, public.entity_photos, public.organizations,
  public.organization_officers, public.organization_announcements to anon, authenticated;

-- Owner-scoped reads retain RLS. Cross-account feeds, marketplace rows, DMs,
-- notifications and membership moderation are projected by authenticated APIs.
grant select on public.profile_identities, public.profiles, public.profile_privacy_settings,
  public.profile_classes, public.profile_organizations, public.profile_follows,
  public.profile_blocks, public.profile_reports, public.friendships,
  public.organization_memberships, public.organization_submissions,
  public.social_content, public.mints, public.stories, public.content_locations,
  public.content_event_details, public.content_likes, public.content_saves,
  public.content_shares, public.content_comments, public.content_comment_likes,
  public.story_views, public.story_reactions, public.content_reports,
  public.pending_content_notifications, public.creator_profiles,
  public.account_capabilities, public.phone_verification_states,
  public.archive_preferences, public.private_content_archives, public.private_archive_media,
  public.content_review_appeals, public.campus_networks, public.campus_network_universities,
  public.brand_profiles, public.brand_channels to authenticated;

-- Applicants see their status, not private administrative review notes.
grant select (id, user_id, platform, external_handle, status, control_status, created_at, updated_at)
  on public.creator_applications to authenticated;
-- Verified email in a Brand profile is account data, not a public directory field.
drop policy if exists "Brand profiles are readable when active" on public.brand_profiles;
create policy brand_profile_owner_read on public.brand_profiles for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Verified active Brand Channels are readable" on public.brand_channels;
create policy brand_channel_owner_read on public.brand_channels for select to authenticated
  using (exists (select 1 from public.brand_profiles brand
    where brand.id = brand_channels.brand_id and brand.user_id = (select auth.uid())));

-- Private-key material is never an account-hydration field, even for its owner.
-- web_authn_credentials remains server-only. Aggregate feed view stays server-only.
revoke all on public.active_mints, public.active_stories, public.feed_view_counts from public, anon, authenticated;
revoke all on sequence public.feed_dwell_events_id_seq from public, anon, authenticated;
alter view public.feed_view_counts set (security_invoker = true);

-- Close unrestricted RPC execution inherited from PostgreSQL's PUBLIC default.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.is_verified_marketplace_student(text) from public, anon, authenticated;
revoke all on function public.sync_marketplace_favorite_count() from public, anon, authenticated;
revoke all on function public.sync_marketplace_offer_count() from public, anon, authenticated;
revoke all on function public.enforce_marketplace_listing_network_membership() from public, anon, authenticated;
revoke all on function public.enforce_marketplace_sports_ticket_category() from public, anon, authenticated;
revoke all on function public.is_verified_marketplace_network_member(text) from public, anon, authenticated;
revoke all on function public.mark_expired_social_content() from public, anon, authenticated;
revoke all on function public.can_access_organization_chat(uuid, uuid) from public, anon, authenticated;
revoke all on function public.accept_organization_membership_request(uuid) from public, anon, authenticated;
revoke all on function public.reject_organization_membership_request(uuid) from public, anon, authenticated;
revoke all on function public.remove_organization_membership(uuid, uuid) from public, anon, authenticated;
revoke all on function public.normalize_organization_name(text) from public, anon, authenticated;
revoke all on function public.normalize_organization_handle(text) from public, anon, authenticated;
alter function public.normalize_organization_name(text) set search_path = '';
alter function public.normalize_organization_handle(text) set search_path = '';
-- Supabase may provision this event-trigger helper outside application history.
-- Event triggers continue working; browser RPC execution is unnecessary.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
revoke all on function public.prevent_duplicate_organization_identity() from public, anon, authenticated;
revoke all on function public.review_creator_application(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.valid_mint_poll_definition(jsonb) from public, anon, authenticated;
revoke all on function public.prevent_mint_poll_definition_edit() from public, anon, authenticated;
revoke all on function public.can_read_mint_poll(uuid, uuid) from public, anon, authenticated;
revoke all on function public.read_mint_poll(uuid, uuid) from public, anon, authenticated;
revoke all on function public.vote_mint_poll(uuid, uuid, text) from public, anon, authenticated;

-- Dormant membership RPCs assume a user-session uid and are not safe service
-- commands; retain them for history but grant no executable application path.
revoke all on function public.accept_organization_membership_request(uuid),
  public.reject_organization_membership_request(uuid),
  public.remove_organization_membership(uuid, uuid) from service_role;

-- Existing server workflows and constraints keep their intended execution path.
grant execute on function public.mark_expired_social_content(),
  public.review_creator_application(uuid, uuid, text, text),
  public.valid_mint_poll_definition(jsonb), public.can_read_mint_poll(uuid, uuid),
  public.read_mint_poll(uuid, uuid), public.vote_mint_poll(uuid, uuid, text),
  public.normalize_organization_name(text), public.normalize_organization_handle(text)
  to service_role;

-- The earlier organization-request policy had an unqualified organization_id
-- inside the role subquery. No browser may enumerate another club's requests.
drop policy if exists "Users can read their own organization requests" on public.organization_membership_requests;
create policy "Users can read their own organization requests" on public.organization_membership_requests
for select to authenticated using (user_id = (select auth.uid()));

-- All Storage objects are delivered by the authorized server or a narrow signed
-- upload token. Restrictive policy also defeats unexpected permissive live rules.
update storage.buckets set public = false where id in ('avatars', 'mint-media', 'message-media', 'mint-archive');
drop policy if exists "Users upload their own avatars" on storage.objects;
drop policy if exists "Users update their own avatars" on storage.objects;
drop policy if exists "Authenticated users read avatars" on storage.objects;
drop policy if exists "Users upload their own Mint media" on storage.objects;
drop policy if exists "Users read their own Mint media" on storage.objects;
drop policy if exists "Users upload their own message media" on storage.objects;
drop policy if exists "Users read their own message uploads" on storage.objects;
drop policy if exists "Owners read their private Archive media" on storage.objects;
create policy campusmint_server_only_buckets on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id not in ('avatars', 'mint-media', 'message-media', 'mint-archive'))
with check (bucket_id not in ('avatars', 'mint-media', 'message-media', 'mint-archive'));

-- Complete three early foundation ownership links without rewriting historical
-- rows. NOT VALID protects new writes now; live-drift.sql checks legacy orphans
-- before a separate VALIDATE CONSTRAINT checkpoint.
alter table public.community_submissions add constraint community_submissions_account_fk
  foreign key (submitted_by) references auth.users(id) on delete set null not valid;
alter table public.community_submission_confirmations add constraint community_confirmations_account_fk
  foreign key (user_id) references auth.users(id) on delete cascade not valid;
alter table public.campus_reviews add constraint campus_reviews_account_fk
  foreign key (reviewer_user_id) references auth.users(id) on delete set null not valid;

-- Prevent accidentally changing the canonical account key through privileged
-- profile updates. Supabase Auth remains the sole account identifier authority.
create function public.preserve_campusmint_account_id() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Account identifiers are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_campusmint_account_id() from public, anon, authenticated;
create trigger profile_identity_id_immutable before update of user_id on public.profile_identities
  for each row execute function public.preserve_campusmint_account_id();
create trigger profile_account_id_immutable before update of user_id on public.profiles
  for each row execute function public.preserve_campusmint_account_id();

-- Browser capability claims never grant administrative access. Seed separately
-- after an operator verifies a distinct administrator identity with MFA.
create table public.security_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('security_admin', 'moderator', 'operator')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.security_administrators enable row level security;
revoke all on public.security_administrators from public, anon, authenticated, service_role;
grant select on public.security_administrators to service_role;

-- Only HMAC digests reach this table. No raw IP, email, token or password.
create table public.security_rate_limits (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  expires_at timestamptz not null,
  request_count integer not null check (request_count between 1 and 1000001),
  check (expires_at > window_started_at)
);
create index security_rate_limits_expiry on public.security_rate_limits(expires_at);
alter table public.security_rate_limits enable row level security;
revoke all on public.security_rate_limits from public, anon, authenticated, service_role;

create table public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action ~ '^[a-z][a-z0-9_.:-]{1,79}$'),
  outcome text not null check (outcome in ('allowed', 'denied', 'error')),
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 2048),
  created_at timestamptz not null default now()
);
create index security_audit_events_created on public.security_audit_events(created_at);
create index security_audit_events_actor_created on public.security_audit_events(actor_id, created_at desc);
alter table public.security_audit_events enable row level security;
revoke all on public.security_audit_events from public, anon, authenticated, service_role;
grant select, insert on public.security_audit_events to service_role;

-- One atomic, bounded UPSERT serializes requests across server instances. The
-- caller supplies server-owned action limits and an action-scoped HMAC digest.
create function public.consume_security_rate_limit(p_key_hash text, p_limit integer, p_window_seconds integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  started timestamptz;
  observed timestamptz := clock_timestamp();
  counter public.security_rate_limits%rowtype;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$'
    or p_limit is null or p_limit not between 1 and 1000000
    or p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate-limit parameters' using errcode = '22023';
  end if;
  started := to_timestamp(floor(extract(epoch from observed) / p_window_seconds) * p_window_seconds);
  insert into public.security_rate_limits as buckets(key_hash, window_started_at, expires_at, request_count)
  values (p_key_hash, started, started + make_interval(secs => p_window_seconds), 1)
  on conflict (key_hash) do update set
    window_started_at = excluded.window_started_at,
    expires_at = excluded.expires_at,
    request_count = case when buckets.window_started_at = excluded.window_started_at
      then least(buckets.request_count + 1, p_limit + 1) else 1 end
  returning * into counter;
  return jsonb_build_object('allowed', counter.request_count <= p_limit,
    'remaining', greatest(0, p_limit - counter.request_count),
    'retry_after_seconds', greatest(1, ceil(extract(epoch from counter.expires_at - observed))::integer));
end;
$$;
revoke all on function public.consume_security_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text, integer, integer) to service_role;

-- Bounded cleanup, no automatic scheduler or billable backup is created here.
-- Keep security event metadata at most 90 days; rate buckets one day after expiry.
create function public.prune_security_records() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare buckets integer; events integer;
begin
  with expired as (select key_hash from public.security_rate_limits
    where expires_at < now() - interval '1 day' order by expires_at limit 5000 for update skip locked)
  delete from public.security_rate_limits target using expired where target.key_hash = expired.key_hash;
  get diagnostics buckets = row_count;
  with expired as (select id from public.security_audit_events
    where created_at < now() - interval '90 days' order by created_at limit 5000 for update skip locked)
  delete from public.security_audit_events target using expired where target.id = expired.id;
  get diagnostics events = row_count;
  return jsonb_build_object('rate_buckets_deleted', buckets, 'audit_events_deleted', events);
end;
$$;
revoke all on function public.prune_security_records() from public, anon, authenticated;
grant execute on function public.prune_security_records() to service_role;

-- A follow is not consent to read private posts. Accepted friendships are.
create or replace function public.can_read_mint_poll(target_content_id uuid, viewer_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.social_content content
    join public.mints mint on mint.content_id = content.id
    join public.profile_identities viewer on viewer.user_id = viewer_id
    join public.profiles author_profile on author_profile.user_id = content.author_id
    where content.id = target_content_id and content.kind = 'mint'
      and content.poll_definition is not null
      and content.status = 'active' and mint.archived_at is null
      and (content.expires_at is null or content.expires_at > now())
      and not exists (
        select 1 from public.profile_blocks blocked
        where (blocked.blocker_id = viewer_id and blocked.blocked_id = content.author_id)
           or (blocked.blocker_id = content.author_id and blocked.blocked_id = viewer_id)
      )
      and (content.author_id = viewer_id or (
        (author_profile.social_account_type = 'public' or (
          exists (select 1 from public.friendships friendship where friendship.status = 'friends' and (
            (friendship.requester_id = viewer_id and friendship.addressee_id = content.author_id)
            or (friendship.addressee_id = viewer_id and friendship.requester_id = content.author_id)))
        )) and
        (content.organization_audience <> 'members' or content.organization_id is null or exists (
          select 1 from public.organization_memberships membership
          where membership.organization_id = content.organization_id and membership.user_id = viewer_id
            and membership.status in ('member', 'officer', 'leader')
        )) and (
          mint.privacy = 'public'
          or (mint.privacy = 'account' and content.university_id = viewer.university_id)
          or (mint.privacy = 'connections' and (
            exists (select 1 from public.friendships friendship where friendship.status = 'friends' and (
              (friendship.requester_id = viewer_id and friendship.addressee_id = content.author_id)
              or (friendship.addressee_id = viewer_id and friendship.requester_id = content.author_id)))
          ))
        )
      ))
  );
$$;

-- Human review requires a separate administrator record and reviewer capability.
create or replace function public.review_creator_application(
  target_application_id uuid,
  reviewer_id uuid,
  review_action text,
  internal_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  application public.creator_applications%rowtype;
begin
  if reviewer_id is null or not exists (
    select 1 from public.security_administrators administrator
    where administrator.user_id = reviewer_id and administrator.role in ('security_admin', 'moderator') and administrator.revoked_at is null
  ) or not exists (
    select 1 from public.account_capabilities capability
    where capability.user_id = reviewer_id
      and capability.capability::text = 'creator_reviewer'
      and capability.revoked_at is null
  ) then
    raise exception 'Creator reviewer authorization is required';
  end if;

  select * into application
  from public.creator_applications
  where id = target_application_id
  for update;

  if application.id is null then
    raise exception 'Creator application not found';
  end if;

  if application.user_id = reviewer_id then
    raise exception 'Administrators cannot review their own application' using errcode = '42501';
  end if;

  if review_action = 'verify_control' then
    update public.creator_applications
    set control_status = 'verified',
        status = case when status = 'pending' then 'under_review' else status end,
        reviewer_user_id = reviewer_id,
        review_notes = nullif(trim(internal_notes), ''),
        updated_at = now()
    where id = target_application_id;
  elsif review_action = 'approve' then
    if application.control_status <> 'verified' then
      raise exception 'External account control must be verified before approval';
    end if;
    if application.status not in ('pending', 'under_review') then
      raise exception 'Only a pending application can be approved';
    end if;
    update public.creator_applications
    set status = 'approved', reviewer_user_id = reviewer_id,
        reviewed_at = now(), review_notes = nullif(trim(internal_notes), ''),
        updated_at = now()
    where id = target_application_id;

    insert into public.account_capabilities (user_id, capability, granted_by, granted_at, revoked_at)
    values
      (application.user_id, 'creator', reviewer_id, now(), null),
      (application.user_id, 'create_groups', reviewer_id, now(), null),
      (application.user_id, 'create_channels', reviewer_id, now(), null),
      (application.user_id, 'future_monetization_eligible', reviewer_id, now(), null)
    on conflict (user_id, capability) do update
    set granted_by = excluded.granted_by,
        granted_at = excluded.granted_at,
        revoked_at = null;
  elsif review_action = 'reject' then
    if application.status not in ('pending', 'under_review') then
      raise exception 'Only a pending application can be rejected';
    end if;
    update public.creator_applications
    set status = 'rejected', reviewer_user_id = reviewer_id,
        reviewed_at = now(), review_notes = nullif(trim(internal_notes), ''),
        updated_at = now()
    where id = target_application_id;
  else
    raise exception 'Unsupported creator review action';
  end if;

  select * into application from public.creator_applications where id = target_application_id;
  return jsonb_build_object(
    'id', application.id,
    'userId', application.user_id,
    'status', application.status,
    'controlStatus', application.control_status,
    'reviewedAt', application.reviewed_at
  );
end;
$$;

notify pgrst, 'reload schema';
commit;
