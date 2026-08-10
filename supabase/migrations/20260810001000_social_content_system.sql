-- Campus Mint social content foundation: Mintz, upgraded Stories, usernames,
-- shared media/location/event metadata, engagement, and expiration processing.
-- The prototype remains local. No anonymous or authenticated client writes are enabled.

create type public.social_account_type as enum ('public', 'private');
create type public.social_discovery_scope as enum ('university', 'campus_network', 'community');
create type public.social_content_type as enum ('image', 'video', 'carousel', 'text');
create type public.social_post_type as enum ('personal', 'event');
create type public.social_content_status as enum ('active', 'expired', 'deleted', 'removed');
create type public.social_content_privacy as enum ('account', 'public', 'connections', 'private');
create type public.social_content_kind as enum ('mint', 'story');
create type public.social_media_type as enum ('image', 'video');
create type public.content_location_source as enum ('campus_entity', 'event', 'custom');
create type public.social_comment_status as enum ('active', 'deleted', 'removed');
create type public.story_reaction_type as enum ('like', 'love', 'laugh', 'wow', 'support');

alter table public.profiles
  add column username text not null,
  add column username_normalized text generated always as (lower(username)) stored,
  add column social_account_type public.social_account_type not null default 'public',
  add column social_discovery_scope public.social_discovery_scope not null default 'campus_network',
  add constraint profiles_username_format_check check (
    char_length(username) between 3 and 30
    and username ~ '^[A-Za-z0-9._]+$'
    and username !~ '^\.'
    and username !~ '\.$'
    and username !~ '\.\.'
    and lower(username) not in (
      'admin', 'administrator', 'campusmint', 'campus_mint', 'help',
      'moderator', 'official', 'security', 'support', 'system'
    )
  );

create unique index profiles_username_normalized_unique_idx
  on public.profiles (username_normalized);

create table public.content_locations (
  id uuid primary key default gen_random_uuid(),
  source public.content_location_source not null,
  campus_entity_id uuid references public.campus_entities(id) on delete set null,
  canonical_event_key text,
  label text not null check (char_length(label) between 1 and 240),
  details text check (details is null or char_length(details) <= 1000),
  created_by uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (source = 'campus_entity' and campus_entity_id is not null and canonical_event_key is null)
    or (source = 'event' and canonical_event_key is not null and campus_entity_id is null)
    or (source = 'custom' and campus_entity_id is null and canonical_event_key is null)
  )
);

create table public.content_event_details (
  id uuid primary key default gen_random_uuid(),
  canonical_event_key text,
  title text check (title is null or char_length(title) <= 240),
  event_date date,
  start_time time,
  end_time time,
  location_id uuid references public.content_locations(id) on delete set null,
  location_details text check (location_details is null or char_length(location_details) <= 1000),
  description text check (description is null or char_length(description) <= 5000),
  created_by uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (canonical_event_key is not null or title is not null or event_date is not null or start_time is not null or location_id is not null)
);

create table public.social_content (
  id uuid primary key default gen_random_uuid(),
  kind public.social_content_kind not null,
  author_id uuid not null references public.profiles(user_id) on delete cascade,
  university_id text not null references public.universities(id) on delete restrict,
  campus_network_id text not null references public.campus_networks(id) on delete restrict,
  content_type public.social_content_type not null,
  post_type public.social_post_type not null default 'personal',
  caption text not null default '' check (char_length(caption) <= 10000),
  location_id uuid references public.content_locations(id) on delete set null,
  event_details_id uuid references public.content_event_details(id) on delete set null,
  music_provider text,
  music_track_id text,
  music_track_title text,
  music_artist text,
  music_artwork_url text,
  music_preview_url text,
  comments_enabled boolean not null default true,
  likes_visible boolean not null default true,
  status public.social_content_status not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (post_type = 'personal' or expires_at is not null),
  check (expires_at is null or expires_at > created_at),
  check (post_type <> 'event' or expires_at <= created_at + interval '24 hours'),
  check (kind <> 'story' or (expires_at is not null and expires_at <= created_at + interval '48 hours')),
  check (kind <> 'mint' or post_type <> 'personal' or expires_at is null or expires_at <= created_at + interval '7 days')
);

create table public.mints (
  content_id uuid primary key references public.social_content(id) on delete cascade,
  privacy public.social_content_privacy not null default 'account',
  archived_at timestamptz
);

create table public.stories (
  content_id uuid primary key references public.social_content(id) on delete cascade,
  audience text not null check (audience in ('students-only', 'students-alumni', 'everyone'))
);

create table public.content_media (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.social_content(id) on delete cascade,
  media_type public.social_media_type not null,
  storage_path text not null,
  thumbnail_storage_path text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (content_id, sort_order)
);

create table public.content_likes (
  content_id uuid not null references public.social_content(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_id, user_id)
);

create table public.content_saves (
  content_id uuid not null references public.social_content(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_id, user_id)
);

create table public.content_shares (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.social_content(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  channel text not null check (channel in ('copy_link', 'direct_message', 'external')),
  created_at timestamptz not null default now()
);

create table public.content_comments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.social_content(id) on delete cascade,
  author_id uuid not null references public.profiles(user_id) on delete cascade,
  parent_comment_id uuid references public.content_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  status public.social_comment_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hashtags (
  normalized_value text primary key,
  display_value text not null,
  created_at timestamptz not null default now(),
  check (normalized_value = lower(normalized_value)),
  check (normalized_value ~ '^[a-z0-9_]+$')
);

create table public.content_comment_likes (
  comment_id uuid not null references public.content_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table public.content_hashtags (
  content_id uuid not null references public.social_content(id) on delete cascade,
  hashtag_normalized text not null references public.hashtags(normalized_value) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_id, hashtag_normalized)
);

create table public.content_mentions (
  content_id uuid not null references public.social_content(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_id, mentioned_user_id)
);

create table public.content_tags (
  content_id uuid not null references public.social_content(id) on delete cascade,
  tagged_user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_id, tagged_user_id)
);

create table public.comment_mentions (
  comment_id uuid not null references public.content_comments(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, mentioned_user_id)
);

create table public.story_views (
  story_id uuid not null references public.stories(content_id) on delete cascade,
  viewer_id uuid not null references public.profiles(user_id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table public.story_reactions (
  story_id uuid not null references public.stories(content_id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  reaction public.story_reaction_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(user_id) on delete cascade,
  content_id uuid references public.social_content(id) on delete cascade,
  comment_id uuid references public.content_comments(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'misleading', 'inappropriate_content', 'other')),
  details text check (details is null or char_length(details) <= 2000),
  status public.profile_report_status not null default 'pending',
  created_at timestamptz not null default now(),
  check ((content_id is not null)::integer + (comment_id is not null)::integer = 1)
);

create table public.pending_content_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(user_id) on delete cascade,
  actor_id uuid not null references public.profiles(user_id) on delete cascade,
  content_id uuid not null references public.social_content(id) on delete cascade,
  reason text not null check (reason in ('mention', 'tag')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (recipient_id, content_id, reason)
);

create index social_content_feed_idx on public.social_content (status, created_at desc);
create index social_content_author_idx on public.social_content (author_id, status, created_at desc);
create index social_content_campus_idx on public.social_content (university_id, campus_network_id, status, created_at desc);
create index social_content_expiration_idx on public.social_content (expires_at) where status = 'active' and expires_at is not null;
create index content_comments_content_idx on public.content_comments (content_id, status, created_at);
create index content_hashtags_discovery_idx on public.content_hashtags (hashtag_normalized, content_id);
create index content_tags_user_idx on public.content_tags (tagged_user_id, content_id);
create index pending_content_notifications_recipient_idx on public.pending_content_notifications (recipient_id, delivered_at, created_at desc);

create trigger content_event_details_set_updated_at before update on public.content_event_details
for each row execute function public.set_updated_at();
create trigger social_content_set_updated_at before update on public.social_content
for each row execute function public.set_updated_at();
create trigger content_comments_set_updated_at before update on public.content_comments
for each row execute function public.set_updated_at();
create trigger story_reactions_set_updated_at before update on public.story_reactions
for each row execute function public.set_updated_at();

create view public.active_mints with (security_invoker = true) as
select content.*, mint.privacy, mint.archived_at
from public.social_content content
join public.mints mint on mint.content_id = content.id
where content.status = 'active'
  and mint.archived_at is null
  and (content.expires_at is null or content.expires_at > now());

create view public.active_stories with (security_invoker = true) as
select content.*, story.audience
from public.social_content content
join public.stories story on story.content_id = content.id
where content.status = 'active'
  and content.expires_at > now();

create function public.mark_expired_social_content()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.social_content
  set status = 'expired', updated_at = now()
  where status = 'active' and expires_at is not null and expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.mark_expired_social_content() from public, anon, authenticated;
grant execute on function public.mark_expired_social_content() to service_role;

alter table public.content_locations enable row level security;
alter table public.content_event_details enable row level security;
alter table public.social_content enable row level security;
alter table public.mints enable row level security;
alter table public.stories enable row level security;
alter table public.content_media enable row level security;
alter table public.content_likes enable row level security;
alter table public.content_saves enable row level security;
alter table public.content_shares enable row level security;
alter table public.content_comments enable row level security;
alter table public.content_comment_likes enable row level security;
alter table public.hashtags enable row level security;
alter table public.content_hashtags enable row level security;
alter table public.content_mentions enable row level security;
alter table public.content_tags enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.story_views enable row level security;
alter table public.story_reactions enable row level security;
alter table public.content_reports enable row level security;
alter table public.pending_content_notifications enable row level security;

-- Owner-only reads are sufficient for the future settings/editor surface.
-- Cross-user feed/profile reads must use a trusted server function that applies
-- account type, relationships, blocks, discovery scope, and per-content privacy.
create policy "Authors can read their own social content"
on public.social_content for select to authenticated using (author_id = auth.uid());
create policy "Authors can read their own Mint rows"
on public.mints for select to authenticated using (exists (
  select 1 from public.social_content content where content.id = content_id and content.author_id = auth.uid()
));
create policy "Authors can read their own Story rows"
on public.stories for select to authenticated using (exists (
  select 1 from public.social_content content where content.id = content_id and content.author_id = auth.uid()
));
create policy "Creators can read their own content locations"
on public.content_locations for select to authenticated using (created_by = auth.uid());
create policy "Creators can read their own event details"
on public.content_event_details for select to authenticated using (created_by = auth.uid());
create policy "Users can read their own content likes"
on public.content_likes for select to authenticated using (user_id = auth.uid());
create policy "Users can read their own content saves"
on public.content_saves for select to authenticated using (user_id = auth.uid());
create policy "Users can read their own content shares"
on public.content_shares for select to authenticated using (user_id = auth.uid());
create policy "Users can read comments they authored"
on public.content_comments for select to authenticated using (author_id = auth.uid());
create policy "Users can read their own comment likes"
on public.content_comment_likes for select to authenticated using (user_id = auth.uid());
create policy "Users can read their own Story views"
on public.story_views for select to authenticated using (viewer_id = auth.uid());
create policy "Users can read their own Story reactions"
on public.story_reactions for select to authenticated using (user_id = auth.uid());
create policy "Users can read content reports they submitted"
on public.content_reports for select to authenticated using (reporter_id = auth.uid());
create policy "Users can read their pending content notifications"
on public.pending_content_notifications for select to authenticated using (recipient_id = auth.uid());

comment on column public.profiles.username_normalized is 'Database-enforced case-insensitive global Campus Mint username key.';
comment on view public.active_mints is 'Defense-in-depth expiration filter; scheduled cleanup is not required for correctness.';
comment on function public.mark_expired_social_content() is 'Service-role-only function intended for a future scheduled expiration job.';
