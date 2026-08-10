-- Organization identity is intentionally separate from personal usernames.
-- Display-name uniqueness is university-scoped; handles are globally unique.

create function public.normalize_organization_name(value text)
returns text
language sql
immutable
strict
as $$
  select regexp_replace(lower(value), '[^a-z0-9]+', '', 'g');
$$;

create function public.normalize_organization_handle(value text)
returns text
language sql
immutable
strict
as $$
  select trim(both '-' from regexp_replace(lower(value), '[^a-z0-9]+', '-', 'g'));
$$;

alter table public.organizations
  add column normalized_name text generated always as (public.normalize_organization_name(name)) stored,
  add column handle text;

with handle_candidates as (
  select
    id,
    left(public.normalize_organization_handle(university_id || '-' || name), 55) as base_handle,
    row_number() over (
      partition by public.normalize_organization_handle(university_id || '-' || name)
      order by created_at, id
    ) as collision_number
  from public.organizations
), resolved_handles as (
  select
    id,
    case when collision_number = 1
      then base_handle
      else left(base_handle, 55) || '-' || collision_number::text
    end as handle
  from handle_candidates
)
update public.organizations organization
set handle = resolved.handle
from resolved_handles resolved
where resolved.id = organization.id;

alter table public.organizations
  alter column handle set not null,
  add constraint organizations_handle_format_check check (
    handle = public.normalize_organization_handle(handle)
    and char_length(handle) between 3 and 64
    and handle ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
  ),
  add constraint organizations_normalized_name_not_empty_check check (char_length(normalized_name) > 0);

alter table public.organization_submissions
  add column normalized_name text generated always as (public.normalize_organization_name(proposed_name)) stored,
  add column handle text;

update public.organization_submissions
set handle = left(
  public.normalize_organization_handle(university_id || '-' || proposed_name),
  50
) || '-' || left(id::text, 8)
where handle is null;

alter table public.organization_submissions
  alter column handle set not null,
  add constraint organization_submissions_handle_format_check check (
    handle = public.normalize_organization_handle(handle)
    and char_length(handle) between 3 and 64
    and handle ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
  ),
  add constraint organization_submissions_normalized_name_not_empty_check check (char_length(normalized_name) > 0);

create unique index organizations_university_normalized_name_active_unique_idx
  on public.organizations (university_id, normalized_name)
  where status = 'active';

create unique index organizations_handle_global_unique_idx
  on public.organizations (handle);

create unique index organization_submissions_university_name_pending_unique_idx
  on public.organization_submissions (university_id, normalized_name)
  where status = 'pending';

create unique index organization_submissions_handle_pending_unique_idx
  on public.organization_submissions (handle)
  where status = 'pending';

create function public.prevent_duplicate_organization_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  record_id uuid;
  record_university_id text;
  record_normalized_name text;
  record_handle text;
  record_is_pending boolean;
begin
  if tg_table_name = 'organizations' then
    record_id := new.id;
    record_university_id := new.university_id;
    record_normalized_name := public.normalize_organization_name(new.name);
    record_handle := public.normalize_organization_handle(new.handle);
    record_is_pending := new.status = 'active';
  else
    record_id := new.id;
    record_university_id := new.university_id;
    record_normalized_name := public.normalize_organization_name(new.proposed_name);
    record_handle := public.normalize_organization_handle(new.handle);
    record_is_pending := new.status = 'pending';
  end if;

  if not record_is_pending then return new; end if;

  perform pg_advisory_xact_lock(hashtextextended('organization-name:' || record_university_id || ':' || record_normalized_name, 0));
  perform pg_advisory_xact_lock(hashtextextended('organization-handle:' || record_handle, 0));

  if tg_table_name = 'organization_submissions' and exists (
    select 1 from public.organizations organization
    where organization.university_id = record_university_id
      and organization.normalized_name = record_normalized_name
  ) then
    raise exception 'This organization already exists.' using errcode = 'unique_violation';
  end if;

  if tg_table_name = 'organizations' and exists (
    select 1 from public.organization_submissions submission
    where submission.university_id = record_university_id
      and submission.normalized_name = record_normalized_name
      and submission.status = 'pending'
      and submission.id <> record_id
  ) then
    raise exception 'This organization already exists.' using errcode = 'unique_violation';
  end if;

  if tg_table_name = 'organization_submissions' and exists (
    select 1 from public.organizations organization where organization.handle = record_handle
  ) then
    raise exception 'That club handle is already in use.' using errcode = 'unique_violation';
  end if;

  if tg_table_name = 'organizations' and exists (
    select 1 from public.organization_submissions submission
    where submission.handle = record_handle
      and submission.status = 'pending'
      and submission.id <> record_id
  ) then
    raise exception 'That club handle is already in use.' using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

create trigger organizations_prevent_duplicate_identity
before insert or update of university_id, name, handle, status on public.organizations
for each row execute function public.prevent_duplicate_organization_identity();

create trigger organization_submissions_prevent_duplicate_identity
before insert or update of university_id, proposed_name, handle, status on public.organization_submissions
for each row execute function public.prevent_duplicate_organization_identity();

comment on column public.organizations.normalized_name is 'University-scoped club-name uniqueness key; independent from profiles.username.';
comment on column public.organizations.handle is 'Stable globally unique Club URL/mention handle; never stored in the personal username namespace.';
comment on column public.organization_submissions.normalized_name is 'Normalized proposed Club name used to prevent duplicate pending submissions.';
comment on function public.prevent_duplicate_organization_identity() is 'Cross-table duplicate defense for canonical Organizations and pending Organization submissions.';
