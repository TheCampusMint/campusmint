-- Campus Mint reusable campus data foundation.
-- Public catalog reads are limited to official and community-verified records.
-- No anonymous or authenticated writes are enabled until real authentication exists.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.data_confidence_level as enum (
  'official',
  'community_verified',
  'pending'
);

create type public.record_source_type as enum (
  'official_source',
  'community_submission',
  'development_seed',
  'manual'
);

create type public.sync_method as enum (
  'api',
  'rss',
  'json',
  'csv',
  'html',
  'manual'
);

create type public.refresh_interval as enum (
  'hourly',
  'daily',
  'weekly',
  'manual'
);

create type public.data_source_kind as enum (
  'academic_catalog',
  'course_catalog',
  'faculty_directory',
  'campus_facilities',
  'dining',
  'events',
  'transportation',
  'housing',
  'manual'
);

create type public.sync_run_status as enum (
  'running',
  'succeeded',
  'failed',
  'skipped'
);

create type public.program_status as enum (
  'active',
  'upcoming',
  'discontinued',
  'archived'
);

create type public.course_status as enum (
  'active',
  'upcoming',
  'discontinued',
  'archived'
);

create type public.section_status as enum (
  'scheduled',
  'cancelled',
  'completed',
  'archived'
);

create type public.campus_entity_status as enum (
  'planned',
  'under_construction',
  'open',
  'temporarily_closed',
  'closed',
  'demolished'
);

create type public.course_program_relation_type as enum (
  'required',
  'core',
  'recommended',
  'elective',
  'prerequisite_related',
  'commonly_taken'
);

create type public.community_submission_status as enum (
  'pending',
  'community_verified',
  'rejected',
  'accepted_as_official'
);

create table public.universities (
  id text primary key,
  name text not null,
  short_name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  primary_color text,
  secondary_color text,
  source_url text,
  source_type public.record_source_type not null default 'manual',
  confidence_level public.data_confidence_level not null default 'pending',
  effective_from date,
  effective_until date,
  last_verified_at timestamptz,
  is_development boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities(id) on delete cascade,
  name text not null,
  source_type public.data_source_kind not null,
  url text,
  sync_method public.sync_method not null,
  refresh_interval public.refresh_interval not null default 'manual',
  enabled boolean not null default false,
  adapter_key text not null,
  last_successful_sync timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, adapter_key)
);

create table public.data_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.data_sources(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.sync_run_status not null default 'running',
  added_count integer not null default 0 check (added_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  archived_count integer not null default 0 check (archived_count >= 0),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.academic_programs (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities(id) on delete cascade,
  external_id text,
  name text not null,
  degree_type text not null,
  department text,
  description text,
  status public.program_status not null default 'active',
  source_id uuid references public.data_sources(id) on delete set null,
  source_url text,
  source_type public.record_source_type not null,
  confidence_level public.data_confidence_level not null,
  effective_from date,
  effective_until date,
  last_verified_at timestamptz,
  is_development boolean not null default false,
  source_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (university_id, external_id, effective_from)
);

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities(id) on delete cascade,
  external_id text,
  code text not null,
  name text not null,
  starts_on date,
  ends_on date,
  registration_status text not null default 'open'
    check (registration_status in ('upcoming', 'open', 'closed', 'completed')),
  source_id uuid references public.data_sources(id) on delete set null,
  source_url text,
  source_type public.record_source_type not null,
  confidence_level public.data_confidence_level not null,
  effective_from date,
  effective_until date,
  last_verified_at timestamptz,
  is_development boolean not null default false,
  source_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (university_id, code, effective_from)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities(id) on delete cascade,
  external_id text,
  subject_code text not null,
  course_number text not null,
  title text not null,
  description text,
  credit_hours numeric(4, 2),
  department text,
  status public.course_status not null default 'active',
  source_id uuid references public.data_sources(id) on delete set null,
  source_url text,
  source_type public.record_source_type not null,
  confidence_level public.data_confidence_level not null,
  effective_from date,
  effective_until date,
  last_verified_at timestamptz,
  is_development boolean not null default false,
  source_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (
    university_id,
    subject_code,
    course_number,
    effective_from
  )
);

create table public.course_program_relations (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities(id) on delete cascade,
  program_id uuid not null references public.academic_programs(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  relation_type public.course_program_relation_type not null,
  recommended_term integer,
  notes text,
  source_id uuid references public.data_sources(id) on delete set null,
  source_url text,
  source_type public.record_source_type not null,
  confidence_level public.data_confidence_level not null,
  effective_from date,
  effective_until date,
  last_verified_at timestamptz,
  is_development boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, course_id, relation_type, effective_from)
);

create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities(id) on delete cascade,
  external_id text,
  display_name text not null,
  department text,
  title text,
  email text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  source_id uuid references public.data_sources(id) on delete set null,
  source_url text,
  source_type public.record_source_type not null,
  confidence_level public.data_confidence_level not null,
  effective_from date,
  effective_until date,
  last_verified_at timestamptz,
  is_development boolean not null default false,
  source_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (university_id, external_id, effective_from)
);

create table public.campus_entities (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities(id) on delete cascade,
  external_id text,
  entity_type text not null,
  name text not null,
  description text,
  status public.campus_entity_status not null default 'open',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  address text,
  source_id uuid references public.data_sources(id) on delete set null,
  source_url text,
  source_type public.record_source_type not null,
  confidence_level public.data_confidence_level not null,
  effective_from date,
  effective_until date,
  last_verified_at timestamptz,
  is_development boolean not null default false,
  source_fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (university_id, entity_type, external_id, effective_from)
);

create table public.buildings (
  id uuid primary key references public.campus_entities(id) on delete cascade,
  building_code text,
  expected_opening date,
  opened_on date,
  closed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_sections (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities(id) on delete cascade,
  external_id text,
  course_id uuid not null references public.courses(id) on delete cascade,
  term_id uuid not null references public.academic_terms(id) on delete cascade,
  section_number text not null,
  days text[] not null default '{}',
  start_time time,
  end_time time,
  location_entity_id uuid references public.campus_entities(id) on delete set null,
  location_text text,
  modality text not null default 'in_person'
    check (modality in ('in_person', 'online', 'hybrid')),
  status public.section_status not null default 'scheduled',
  source_id uuid references public.data_sources(id) on delete set null,
  source_url text,
  source_type public.record_source_type not null,
  confidence_level public.data_confidence_level not null,
  effective_from date,
  effective_until date,
  last_verified_at timestamptz,
  is_development boolean not null default false,
  source_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (course_id, term_id, section_number, effective_from)
);

create table public.section_instructors (
  section_id uuid not null references public.course_sections(id) on delete cascade,
  instructor_id uuid not null references public.instructors(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (section_id, instructor_id)
);

create table public.community_submissions (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities(id) on delete cascade,
  entity_type text not null,
  submitted_value text not null,
  normalized_value text not null,
  canonical_entity_id text,
  confirmation_count integer not null default 1 check (confirmation_count >= 1),
  status public.community_submission_status not null default 'pending',
  confidence_level public.data_confidence_level not null default 'pending',
  source_url text,
  submitted_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, entity_type, normalized_value)
);

create table public.community_submission_confirmations (
  submission_id uuid not null references public.community_submissions(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (submission_id, user_id)
);

create table public.aliases (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities(id) on delete cascade,
  entity_type text not null,
  alias_text text not null,
  normalized_alias text not null,
  canonical_entity_id text not null,
  canonical_label text not null,
  source_id uuid references public.data_sources(id) on delete set null,
  source_type public.record_source_type not null,
  confidence_level public.data_confidence_level not null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, entity_type, normalized_alias)
);

create table public.data_change_events (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities(id) on delete cascade,
  source_id uuid references public.data_sources(id) on delete set null,
  sync_run_id uuid references public.data_sync_runs(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  change_type text not null,
  previous_value jsonb,
  next_value jsonb,
  meaningful boolean not null default true,
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'ignored', 'processed')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index academic_programs_university_name_idx
  on public.academic_programs (university_id, lower(name));
create index academic_programs_name_trgm_idx
  on public.academic_programs using gin (name gin_trgm_ops);
create index courses_university_code_idx
  on public.courses (university_id, subject_code, course_number);
create index courses_title_trgm_idx
  on public.courses using gin (title gin_trgm_ops);
create index course_program_relations_program_idx
  on public.course_program_relations (program_id, relation_type);
create index instructors_university_name_idx
  on public.instructors (university_id, lower(display_name));
create index sections_course_term_idx
  on public.course_sections (course_id, term_id, status);
create index campus_entities_university_type_idx
  on public.campus_entities (university_id, entity_type, status);
create index community_submissions_lookup_idx
  on public.community_submissions (university_id, entity_type, normalized_value);
create index aliases_lookup_idx
  on public.aliases (university_id, entity_type, normalized_alias);
create index data_sync_runs_source_started_idx
  on public.data_sync_runs (source_id, started_at desc);
create index data_change_events_university_time_idx
  on public.data_change_events (university_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger universities_set_updated_at
before update on public.universities
for each row execute function public.set_updated_at();
create trigger data_sources_set_updated_at
before update on public.data_sources
for each row execute function public.set_updated_at();
create trigger academic_programs_set_updated_at
before update on public.academic_programs
for each row execute function public.set_updated_at();
create trigger academic_terms_set_updated_at
before update on public.academic_terms
for each row execute function public.set_updated_at();
create trigger courses_set_updated_at
before update on public.courses
for each row execute function public.set_updated_at();
create trigger course_program_relations_set_updated_at
before update on public.course_program_relations
for each row execute function public.set_updated_at();
create trigger instructors_set_updated_at
before update on public.instructors
for each row execute function public.set_updated_at();
create trigger campus_entities_set_updated_at
before update on public.campus_entities
for each row execute function public.set_updated_at();
create trigger buildings_set_updated_at
before update on public.buildings
for each row execute function public.set_updated_at();
create trigger course_sections_set_updated_at
before update on public.course_sections
for each row execute function public.set_updated_at();
create trigger community_submissions_set_updated_at
before update on public.community_submissions
for each row execute function public.set_updated_at();
create trigger aliases_set_updated_at
before update on public.aliases
for each row execute function public.set_updated_at();

alter table public.universities enable row level security;
alter table public.data_sources enable row level security;
alter table public.data_sync_runs enable row level security;
alter table public.academic_programs enable row level security;
alter table public.academic_terms enable row level security;
alter table public.courses enable row level security;
alter table public.course_program_relations enable row level security;
alter table public.instructors enable row level security;
alter table public.campus_entities enable row level security;
alter table public.buildings enable row level security;
alter table public.course_sections enable row level security;
alter table public.section_instructors enable row level security;
alter table public.community_submissions enable row level security;
alter table public.community_submission_confirmations enable row level security;
alter table public.aliases enable row level security;
alter table public.data_change_events enable row level security;

create policy "Public can read active universities"
on public.universities for select
to anon, authenticated
using (status = 'active' and confidence_level in ('official', 'community_verified'));

create policy "Public can read trusted academic programs"
on public.academic_programs for select
to anon, authenticated
using (confidence_level in ('official', 'community_verified'));

create policy "Public can read trusted academic terms"
on public.academic_terms for select
to anon, authenticated
using (confidence_level in ('official', 'community_verified'));

create policy "Public can read trusted courses"
on public.courses for select
to anon, authenticated
using (confidence_level in ('official', 'community_verified'));

create policy "Public can read trusted program relations"
on public.course_program_relations for select
to anon, authenticated
using (confidence_level in ('official', 'community_verified'));

create policy "Public can read trusted instructors"
on public.instructors for select
to anon, authenticated
using (confidence_level in ('official', 'community_verified'));

create policy "Public can read trusted campus entities"
on public.campus_entities for select
to anon, authenticated
using (confidence_level in ('official', 'community_verified'));

create policy "Public can read building details for trusted entities"
on public.buildings for select
to anon, authenticated
using (
  exists (
    select 1
    from public.campus_entities
    where campus_entities.id = buildings.id
      and campus_entities.confidence_level in ('official', 'community_verified')
  )
);

create policy "Public can read trusted course sections"
on public.course_sections for select
to anon, authenticated
using (confidence_level in ('official', 'community_verified'));

create policy "Public can read instructors on trusted sections"
on public.section_instructors for select
to anon, authenticated
using (
  exists (
    select 1
    from public.course_sections
    where course_sections.id = section_instructors.section_id
      and course_sections.confidence_level in ('official', 'community_verified')
  )
);

create policy "Public can read trusted aliases"
on public.aliases for select
to anon, authenticated
using (confidence_level in ('official', 'community_verified'));

comment on table public.community_submissions is
  'No public write policy exists. Submissions must pass through a trusted server endpoint after authentication is added.';
comment on table public.data_sources is
  'Server-only registry. Official sources must use reviewed, university-specific adapters.';
comment on table public.data_change_events is
  'Notification-ready audit events emitted by source synchronization; not a user notification delivery table.';
