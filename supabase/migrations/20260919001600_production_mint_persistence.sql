-- Production Mint persistence boundary.
-- The application server authenticates the caller, writes with service_role,
-- and returns short-lived signed URLs for the private mint-media bucket.

alter table public.social_content
  add column client_request_id uuid;

create unique index social_content_author_request_unique_idx
  on public.social_content (author_id, client_request_id)
  where client_request_id is not null;

alter table public.content_media
  add column mime_type text,
  add column byte_size bigint,
  add constraint content_media_mime_type_check check (
    mime_type is null or mime_type in (
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/webm'
    )
  ),
  add constraint content_media_byte_size_check check (
    byte_size is null or byte_size between 1 and 104857600
  );

grant select on table
  public.campus_network_universities,
  public.profile_identities,
  public.profiles,
  public.profile_privacy_settings,
  public.friendships,
  public.profile_follows,
  public.profile_blocks,
  public.organization_memberships,
  public.organization_roles,
  public.social_content,
  public.mints,
  public.content_media,
  public.content_locations,
  public.content_event_details,
  public.hashtags,
  public.content_hashtags,
  public.content_mentions,
  public.content_tags,
  public.content_tagged_organizations,
  public.pending_content_notifications
to service_role;

grant insert, update, delete on table
  public.social_content,
  public.mints,
  public.content_media,
  public.content_locations,
  public.content_event_details,
  public.hashtags,
  public.content_hashtags,
  public.content_mentions,
  public.content_tags,
  public.content_tagged_organizations,
  public.pending_content_notifications
to service_role;

comment on column public.social_content.client_request_id is
  'Client-generated idempotency key. Unique per author so retries cannot create duplicate Mintz.';
comment on column public.content_media.mime_type is
  'Validated upload MIME type retained for safe signed-media delivery.';
comment on column public.content_media.byte_size is
  'Validated uploaded object size in bytes.';
