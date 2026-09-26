-- Forward-only launch account refinements. Creator authority stays additive,
-- review is service-only, and SMS remains disabled until the server flag and a
-- real provider are deliberately configured.

alter type public.account_capability add value if not exists 'creator_reviewer';

create type public.creator_screening_status as enum (
  'pending',
  'eligible',
  'needs_review',
  'ineligible'
);

create type public.phone_verification_status as enum (
  'unverified',
  'pending',
  'verified',
  'locked'
);

create type public.publisher_identity_kind as enum ('creator', 'brand');
create type public.publisher_community_kind as enum ('group', 'channel');

-- Public Creators may publish without being assigned a campus. Student-only
-- authorization continues to depend on profile_identities.verified_student.
alter table public.social_content
  alter column university_id drop not null,
  alter column campus_network_id drop not null;

alter table public.creator_applications
  drop constraint if exists creator_applications_claimed_follower_count_check,
  add constraint creator_applications_claimed_follower_count_nonnegative_check
    check (claimed_follower_count >= 0),
  add column additional_social_accounts jsonb not null default '[]'::jsonb,
  add column application_notes text check (application_notes is null or char_length(application_notes) <= 2000),
  add column screening_status public.creator_screening_status not null default 'pending',
  add column screening_summary text check (screening_summary is null or char_length(screening_summary) <= 2000),
  add column screened_at timestamptz,
  add constraint creator_applications_social_accounts_array_check
    check (jsonb_typeof(additional_social_accounts) = 'array');

create table public.creator_eligibility_policies (
  singleton boolean primary key default true check (singleton),
  external_follower_threshold bigint not null default 100000 check (external_follower_threshold >= 0),
  alternative_review_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.creator_eligibility_policies (
  singleton,
  external_follower_threshold,
  alternative_review_enabled
) values (true, 100000, true)
on conflict (singleton) do nothing;

alter table public.phone_verification_states
  rename column phone_e164 to phone_number_e164;

alter table public.phone_verification_challenges
  rename column phone_e164 to phone_number_e164;

alter table public.phone_verification_states
  drop constraint if exists phone_verification_states_phone_e164_key,
  add column status public.phone_verification_status not null default 'unverified',
  add column provider text,
  add column last_challenge_sent_at timestamptz,
  add column last_attempt_at timestamptz,
  add column resend_count integer not null default 0 check (resend_count between 0 and 1000);

create unique index phone_verification_states_verified_phone_unique_idx
  on public.phone_verification_states (phone_number_e164)
  where phone_number_e164 is not null and status = 'verified';

create table public.publisher_communities (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_kind public.publisher_identity_kind not null,
  community_kind public.publisher_community_kind not null,
  name text not null check (char_length(name) between 2 and 160),
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  description text check (description is null or char_length(description) <= 1000),
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, community_kind)
);

create trigger publisher_communities_set_updated_at
before update on public.publisher_communities
for each row execute function public.set_updated_at();

alter table public.creator_eligibility_policies enable row level security;
alter table public.publisher_communities enable row level security;

create policy publisher_communities_authenticated_read
on public.publisher_communities for select to authenticated
using (status = 'active' or owner_user_id = auth.uid());

-- Brand verification is an administrative trust decision. Brand profile edits
-- remain server mediated so an authenticated Brand cannot change its own
-- verification or suspension columns through the data API.
drop policy if exists "Brands update only their profile" on public.brand_profiles;
revoke update on public.brand_profiles from authenticated;

revoke all on public.creator_eligibility_policies from public, anon, authenticated;
revoke all on public.publisher_communities from public, anon, authenticated;

grant select on public.publisher_communities to authenticated;
grant select, insert, update, delete on public.creator_eligibility_policies,
  public.publisher_communities to service_role;

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

revoke all on function public.review_creator_application(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_creator_application(uuid, uuid, text, text) to service_role;

comment on table public.creator_eligibility_policies is
  'Server-owned Creator pre-screen policy. Thresholds prioritize human review and never grant Creator capability automatically.';
comment on table public.publisher_communities is
  'Creator and Brand communities. These are not official university organizations.';
comment on function public.review_creator_application(uuid, uuid, text, text) is
  'Atomic service-only human review transition. Approval grants additive Creator capabilities without replacing Student identity.';
