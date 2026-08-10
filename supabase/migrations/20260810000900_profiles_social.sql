-- Campus Mint Profiles v1 and social relationship foundation.
-- The current UI uses fictional in-memory records. These tables are ready for future
-- auth.users IDs, but intentionally expose no anonymous reads or client writes.
-- Cross-user discovery must later go through a trusted server function that applies
-- profile_privacy_settings before returning any field or search match.

create type public.campus_mint_user_role as enum (
  'student',
  'alumni',
  'supporter',
  'university-admin',
  'local-business'
);

create type public.profile_visibility as enum (
  'everyone',
  'students_only',
  'friends_only',
  'private'
);

create type public.friendship_status as enum (
  'requested',
  'friends',
  'blocked'
);

create type public.profile_report_status as enum (
  'pending',
  'reviewed',
  'resolved',
  'dismissed'
);

-- Server-managed account identity. Public profile edits must never update these claims.
create table public.profile_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  university_id text not null references public.universities(id) on delete restrict,
  role public.campus_mint_user_role not null,
  verified_student boolean not null default false,
  verified_alumni boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references public.profile_identities(user_id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  display_name text not null check (char_length(display_name) between 1 and 160),
  profile_photo_storage_path text,
  profile_photo_placeholder text,
  bio text check (bio is null or char_length(bio) <= 1000),
  major text check (major is null or char_length(major) <= 160),
  graduation_year integer check (graduation_year is null or graduation_year between 1900 and 2200),
  interests text[] not null default '{}'::text[],
  hometown text check (hometown is null or char_length(hometown) <= 160),
  instagram text,
  linkedin text,
  portfolio_url text,
  personal_website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_privacy_settings (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  bio public.profile_visibility not null default 'everyone',
  major public.profile_visibility not null default 'students_only',
  graduation_year public.profile_visibility not null default 'students_only',
  classes public.profile_visibility not null default 'friends_only',
  clubs public.profile_visibility not null default 'students_only',
  interests public.profile_visibility not null default 'everyone',
  hometown public.profile_visibility not null default 'private',
  instagram public.profile_visibility not null default 'friends_only',
  linkedin public.profile_visibility not null default 'everyone',
  portfolio_url public.profile_visibility not null default 'everyone',
  personal_website public.profile_visibility not null default 'everyone',
  updated_at timestamptz not null default now()
);

create table public.profile_classes (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table public.profile_organizations (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(user_id) on delete cascade,
  addressee_id uuid not null references public.profiles(user_id) on delete cascade,
  status public.friendship_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

create unique index friendships_unique_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table public.profile_follows (
  follower_id uuid not null references public.profiles(user_id) on delete cascade,
  following_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.profile_blocks (
  blocker_id uuid not null references public.profiles(user_id) on delete cascade,
  blocked_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.profile_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(user_id) on delete cascade,
  reported_id uuid not null references public.profiles(user_id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'impersonation', 'inappropriate_content', 'other')),
  details text check (details is null or char_length(details) <= 2000),
  status public.profile_report_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (reporter_id <> reported_id)
);

create index profiles_display_name_idx on public.profiles using gin (display_name gin_trgm_ops);
create index profile_identities_university_role_idx on public.profile_identities (university_id, role);
create index friendships_requester_status_idx on public.friendships (requester_id, status);
create index friendships_addressee_status_idx on public.friendships (addressee_id, status);
create index profile_follows_following_idx on public.profile_follows (following_id);
create index profile_blocks_blocked_idx on public.profile_blocks (blocked_id);
create index profile_reports_reported_status_idx on public.profile_reports (reported_id, status, created_at desc);

create trigger profile_identities_set_updated_at before update on public.profile_identities
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger profile_privacy_settings_set_updated_at before update on public.profile_privacy_settings
for each row execute function public.set_updated_at();
create trigger friendships_set_updated_at before update on public.friendships
for each row execute function public.set_updated_at();

alter table public.profile_identities enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_privacy_settings enable row level security;
alter table public.profile_classes enable row level security;
alter table public.profile_organizations enable row level security;
alter table public.friendships enable row level security;
alter table public.profile_follows enable row level security;
alter table public.profile_blocks enable row level security;
alter table public.profile_reports enable row level security;

create policy "Users can read their own profile identity"
on public.profile_identities for select to authenticated using (user_id = auth.uid());
create policy "Users can read their own profile"
on public.profiles for select to authenticated using (user_id = auth.uid());
create policy "Users can read their own profile privacy"
on public.profile_privacy_settings for select to authenticated using (user_id = auth.uid());
create policy "Users can read their own profile classes"
on public.profile_classes for select to authenticated using (user_id = auth.uid());
create policy "Users can read their own profile organizations"
on public.profile_organizations for select to authenticated using (user_id = auth.uid());
create policy "Participants can read their friendships"
on public.friendships for select to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "Users can read their own follows"
on public.profile_follows for select to authenticated using (follower_id = auth.uid());
create policy "Users can read blocks they created"
on public.profile_blocks for select to authenticated using (blocker_id = auth.uid());
create policy "Users can read reports they submitted"
on public.profile_reports for select to authenticated using (reporter_id = auth.uid());

comment on table public.profile_identities is 'Server-managed university, role, and verification identity; never changed by public profile edits.';
comment on table public.profile_privacy_settings is 'Field-level visibility evaluated by trusted server code before profile discovery or reads.';
comment on table public.friendships is 'Directional request with a single normalized pair; status may advance to friends or blocked.';
