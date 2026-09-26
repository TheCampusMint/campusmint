-- Forward-only production authorization foundations for creators, future phone
-- verification, and owner-only campus testing. Nothing in this migration
-- activates SMS, creator approval, monetization, or owner permissions.

alter type public.campus_mint_account_type add value if not exists 'creator';

create type public.creator_application_status as enum (
  'pending',
  'under_review',
  'approved',
  'rejected'
);

create type public.creator_control_status as enum (
  'pending',
  'verified',
  'failed'
);

create type public.account_capability as enum (
  'creator',
  'create_groups',
  'create_channels',
  'owner_campus_tester',
  'future_monetization_eligible'
);

create table public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 160),
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._]{2,39}$'),
  bio text check (bio is null or char_length(bio) <= 1000),
  badge_tint text not null default 'currentColor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('youtube', 'instagram', 'tiktok', 'twitch', 'other')),
  external_handle text not null check (char_length(external_handle) between 1 and 160),
  external_profile_url text not null check (external_profile_url ~ '^https://'),
  claimed_follower_count bigint not null check (claimed_follower_count >= 100000),
  control_proof_method text not null default 'provider_review' check (control_proof_method in ('provider_oauth', 'provider_review')),
  control_status public.creator_control_status not null default 'pending',
  status public.creator_application_status not null default 'pending',
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text check (review_notes is null or char_length(review_notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'approved' and control_status = 'verified' and reviewer_user_id is not null and reviewed_at is not null) or status <> 'approved')
);

create unique index creator_applications_one_active_per_user_idx
  on public.creator_applications (user_id)
  where status in ('pending', 'under_review', 'approved');

create table public.account_capabilities (
  user_id uuid not null references auth.users(id) on delete cascade,
  capability public.account_capability not null,
  granted_by uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, capability),
  check (capability <> 'creator' or user_id <> granted_by)
);

create table public.phone_verification_settings (
  singleton boolean primary key default true check (singleton),
  enforcement_enabled boolean not null default false,
  sms_provider text,
  updated_at timestamptz not null default now()
);

insert into public.phone_verification_settings (singleton, enforcement_enabled)
values (true, false)
on conflict (singleton) do update set enforcement_enabled = false, sms_provider = null;

create table public.phone_verification_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_e164 text unique check (phone_e164 is null or phone_e164 ~ '^[+][1-9][0-9]{7,14}$'),
  verified_at timestamptz,
  failed_attempt_count integer not null default 0 check (failed_attempt_count between 0 and 20),
  locked_until timestamptz,
  recovery_review_required boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.phone_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^[+][1-9][0-9]{7,14}$'),
  otp_digest text not null,
  expires_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index phone_verification_challenges_user_idx
  on public.phone_verification_challenges (user_id, created_at desc);

create trigger creator_profiles_set_updated_at before update on public.creator_profiles
for each row execute function public.set_updated_at();
create trigger creator_applications_set_updated_at before update on public.creator_applications
for each row execute function public.set_updated_at();
create trigger phone_verification_states_set_updated_at before update on public.phone_verification_states
for each row execute function public.set_updated_at();

alter table public.creator_profiles enable row level security;
alter table public.creator_applications enable row level security;
alter table public.account_capabilities enable row level security;
alter table public.phone_verification_settings enable row level security;
alter table public.phone_verification_states enable row level security;
alter table public.phone_verification_challenges enable row level security;

create policy creator_profiles_owner_read on public.creator_profiles
for select to authenticated using (user_id = auth.uid());
create policy creator_applications_owner_read on public.creator_applications
for select to authenticated using (user_id = auth.uid());
create policy account_capabilities_owner_read on public.account_capabilities
for select to authenticated using (user_id = auth.uid() and revoked_at is null);
create policy phone_verification_states_owner_read on public.phone_verification_states
for select to authenticated using (user_id = auth.uid());

revoke all on public.creator_profiles from anon, authenticated;
revoke all on public.creator_applications from anon, authenticated;
revoke all on public.account_capabilities from anon, authenticated;
revoke all on public.phone_verification_settings from anon, authenticated;
revoke all on public.phone_verification_states from anon, authenticated;
revoke all on public.phone_verification_challenges from anon, authenticated;

grant select on public.creator_profiles, public.creator_applications,
  public.account_capabilities, public.phone_verification_states to authenticated;
grant select, insert, update, delete on public.creator_profiles,
  public.creator_applications, public.account_capabilities,
  public.phone_verification_settings, public.phone_verification_states,
  public.phone_verification_challenges to service_role;

comment on table public.creator_applications is 'Manual creator review queue. Browser claims never approve an application or grant capabilities.';
comment on table public.account_capabilities is 'Server-granted additive capabilities. Student identity remains independent of creator status.';
comment on table public.phone_verification_settings is 'SMS enforcement remains disabled until a real provider and explicit launch decision exist.';
