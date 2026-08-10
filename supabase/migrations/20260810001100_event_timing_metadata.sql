-- Smart Event badge metadata. Scheduled Event time remains separate from
-- social_content.expires_at, which continues to control content visibility.

alter table public.content_event_details
  add column event_start_at timestamptz,
  add column event_end_at timestamptz,
  add column event_timezone text;

alter table public.content_event_details
  drop constraint if exists content_event_details_check;

alter table public.content_event_details
  add constraint content_event_details_has_timing_or_reference_check check (
    canonical_event_key is not null
    or title is not null
    or event_start_at is not null
    or event_date is not null
    or start_time is not null
    or location_id is not null
  ),
  add constraint content_event_details_time_order_check check (
    event_end_at is null
    or (event_start_at is not null and event_end_at > event_start_at)
  ),
  add constraint content_event_details_timezone_check check (
    event_timezone is null or char_length(event_timezone) between 1 and 80
  );

alter table public.social_content
  add column organization_id uuid references public.organizations(id) on delete set null;

create index content_event_details_start_idx
  on public.content_event_details (event_start_at)
  where event_start_at is not null;

create index social_content_organization_idx
  on public.social_content (organization_id, status, created_at desc)
  where organization_id is not null;

comment on column public.content_event_details.event_start_at is 'Actual scheduled Event start used by Event timing badges; never derived from content expiration.';
comment on column public.social_content.expires_at is 'Social content visibility deadline; independent from an Event scheduled start/end.';
comment on column public.social_content.organization_id is 'Optional Club/organization association independent from personal/event post type.';
