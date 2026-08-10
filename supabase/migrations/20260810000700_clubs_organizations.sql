-- Clubs & Organizations v1 schema.
-- UI interactions remain local for now. No unauthenticated organization, membership,
-- officer, announcement, or submission writes are enabled.

alter type public.data_source_kind add value if not exists 'organizations';

create type public.organization_official_status as enum (
  'university_verified',
  'community_verified',
  'pending'
);

create type public.organization_membership_type as enum (
  'open',
  'application',
  'invitation',
  'restricted'
);

create type public.organization_membership_status as enum (
  'requested',
  'member',
  'officer'
);

create type public.organization_officer_role as enum (
  'president',
  'vice_president',
  'treasurer',
  'secretary',
  'social_chair',
  'recruitment',
  'other'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities(id) on delete cascade,
  campus_network_id text references public.campus_networks(id) on delete set null,
  external_id text,
  name text not null check (char_length(name) between 2 and 160),
  short_description text not null check (char_length(short_description) between 2 and 500),
  full_description text not null check (char_length(full_description) between 2 and 5000),
  category text not null check (category in (
    'Academic', 'Professional', 'Sports', 'Recreation', 'Cultural', 'Social',
    'Service', 'Greek Life', 'Religious', 'Student Government', 'Arts / Music',
    'Gaming', 'Entrepreneurship', 'Other'
  )),
  logo_url text,
  photo_url text,
  official_status public.organization_official_status not null default 'pending',
  membership_type public.organization_membership_type not null default 'restricted',
  website text,
  instagram text,
  contact_email text not null,
  meeting_location text not null,
  meeting_schedule text not null,
  member_count integer not null default 0 check (member_count >= 0),
  cross_campus boolean not null default false,
  keywords text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active', 'archived')),
  source_id uuid references public.data_sources(id) on delete set null,
  source_url text,
  source_type public.record_source_type not null,
  confidence_level public.data_confidence_level not null default 'pending',
  effective_from date,
  effective_until date,
  last_verified_at timestamptz,
  is_development boolean not null default false,
  source_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (university_id, external_id, effective_from)
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id text not null references public.universities(id) on delete restrict,
  status public.organization_membership_status not null,
  requested_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.organization_officers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  role public.organization_officer_role not null,
  custom_role text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((role = 'other' and custom_role is not null) or (role <> 'other' and custom_role is null))
);

create table public.organization_announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  body text not null check (char_length(body) between 2 and 5000),
  author_user_id uuid references auth.users(id) on delete set null,
  author_role public.organization_officer_role not null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_submissions (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities(id) on delete cascade,
  proposed_name text not null check (char_length(proposed_name) between 2 and 160),
  category text not null,
  description text not null check (char_length(description) between 2 and 5000),
  contact text not null check (char_length(contact) between 2 and 320),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  status public.community_submission_status not null default 'pending',
  confidence_level public.data_confidence_level not null default 'pending',
  canonical_organization_id uuid references public.organizations(id) on delete set null,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizations_university_category_name_idx
  on public.organizations (university_id, category, lower(name));
create index organizations_network_cross_campus_idx
  on public.organizations (campus_network_id, cross_campus)
  where cross_campus = true;
create index organizations_name_trgm_idx
  on public.organizations using gin (name gin_trgm_ops);
create index organization_memberships_user_status_idx
  on public.organization_memberships (user_id, status);
create index organization_announcements_org_published_idx
  on public.organization_announcements (organization_id, published_at desc);
create index organization_submissions_university_status_idx
  on public.organization_submissions (university_id, status, created_at desc);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();
create trigger organization_memberships_set_updated_at
before update on public.organization_memberships
for each row execute function public.set_updated_at();
create trigger organization_officers_set_updated_at
before update on public.organization_officers
for each row execute function public.set_updated_at();
create trigger organization_announcements_set_updated_at
before update on public.organization_announcements
for each row execute function public.set_updated_at();
create trigger organization_submissions_set_updated_at
before update on public.organization_submissions
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_officers enable row level security;
alter table public.organization_announcements enable row level security;
alter table public.organization_submissions enable row level security;

create policy "Public can read trusted organizations"
on public.organizations for select to anon, authenticated
using (
  status = 'active'
  and confidence_level in ('official', 'community_verified')
  and official_status in ('university_verified', 'community_verified')
);

create policy "Public can read officers for trusted organizations"
on public.organization_officers for select to anon, authenticated
using (exists (
  select 1 from public.organizations organization
  where organization.id = organization_id
    and organization.status = 'active'
    and organization.confidence_level in ('official', 'community_verified')
    and organization.official_status in ('university_verified', 'community_verified')
));

create policy "Public can read announcements for trusted organizations"
on public.organization_announcements for select to anon, authenticated
using (exists (
  select 1 from public.organizations organization
  where organization.id = organization_id
    and organization.status = 'active'
    and organization.confidence_level in ('official', 'community_verified')
    and organization.official_status in ('university_verified', 'community_verified')
));

create policy "Users can read their own organization memberships"
on public.organization_memberships for select to authenticated
using (user_id = auth.uid());

create policy "Users can read their own organization submissions"
on public.organization_submissions for select to authenticated
using (submitted_by = auth.uid());

revoke all on public.organizations, public.organization_memberships,
  public.organization_officers, public.organization_announcements,
  public.organization_submissions from anon, authenticated;

grant select on public.organizations, public.organization_officers,
  public.organization_announcements to anon, authenticated;
grant select on public.organization_memberships, public.organization_submissions
  to authenticated;

comment on table public.organizations is
  'University-scoped organization directory. Campus Network is optional and only supports intentional cross-campus invitations.';
comment on table public.organization_memberships is
  'No row represents membership status none. Membership writes require a future trusted authenticated server workflow.';
comment on table public.organization_submissions is
  'Pending organization suggestions. No client write policy exists; future writes must pass through authenticated review-aware server code.';
comment on table public.organization_announcements is
  'Organization announcements without engagement counters.';
comment on column public.organizations.external_id is
  'Stable source identifier. Local Event and Story models may reference the same organization identifier until canonical database content APIs are connected.';
