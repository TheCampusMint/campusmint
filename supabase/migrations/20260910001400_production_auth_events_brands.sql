-- Campus Mint production account, event, messaging, interaction, and media boundary.
-- Authentication is owned by Supabase Auth. account_type and verification status
-- are server-managed and are never inferred from a client-supplied user id.

create type public.campus_mint_account_type as enum ('student', 'brand', 'system');
create type public.brand_verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type public.brand_channel_status as enum ('active', 'suspended', 'archived');
create type public.campus_event_status as enum ('scheduled', 'updated', 'cancelled', 'completed');
create type public.campus_event_source_kind as enum ('university', 'city', 'tourism', 'venue', 'brand', 'student', 'organization', 'trusted_public');

alter table public.profile_identities
  add column account_type public.campus_mint_account_type not null default 'student',
  add column email_verified_at timestamptz,
  alter column university_id drop not null;

create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 160),
  username text not null check (username ~ '^[a-z0-9][a-z0-9._]{2,39}$'),
  username_normalized text not null,
  profile_image_storage_path text,
  bio text check (bio is null or char_length(bio) <= 1000),
  website_url text check (website_url is null or website_url ~ '^https?://'),
  contact_email text,
  business_category text,
  location_label text,
  service_radius_miles numeric check (service_radius_miles is null or service_radius_miles between 0 and 500),
  verification_status public.brand_verification_status not null default 'unverified',
  verified_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (username_normalized),
  check (username_normalized = lower(username)),
  check ((verification_status = 'verified' and verified_at is not null) or verification_status <> 'verified')
);

create table public.brand_channels (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null unique references public.brand_profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  description text check (description is null or char_length(description) <= 1000),
  status public.brand_channel_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brand_channel_memberships (
  channel_id uuid not null references public.brand_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  notifications_enabled boolean not null default true,
  primary key (channel_id, user_id)
);

create table public.brand_channel_posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.brand_channels(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  media jsonb not null default '[]'::jsonb,
  status public.social_content_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.universities
  add column campus_latitude numeric,
  add column campus_longitude numeric,
  add column event_discovery_radius_miles numeric not null default 10 check (event_discovery_radius_miles > 0 and event_discovery_radius_miles <= 100);

update public.universities set campus_latitude = 30.6187, campus_longitude = -96.3365, event_discovery_radius_miles = 10 where id = 'tamu';
update public.universities set campus_latitude = 30.6601, campus_longitude = -96.3908, event_discovery_radius_miles = 10 where id = 'blinn';
update public.universities set campus_latitude = 30.2849, campus_longitude = -97.7341, event_discovery_radius_miles = 10 where id = 'texas';
update public.universities set campus_latitude = 30.4120, campus_longitude = -91.1838, event_discovery_radius_miles = 10 where id = 'lsu';
update public.universities set campus_latitude = 33.2140, campus_longitude = -87.5391, event_discovery_radius_miles = 10 where id = 'alabama';

-- The five configured university identities are production configuration.
-- Development academic fixtures are intentionally absent from migrations.
update public.universities set
  source_type = 'official_source', confidence_level = 'official',
  is_development = false, last_verified_at = now(),
  source_url = case id
    when 'tamu' then 'https://www.tamu.edu/'
    when 'blinn' then 'https://www.blinn.edu/'
    when 'texas' then 'https://www.utexas.edu/'
    when 'lsu' then 'https://www.lsu.edu/'
    when 'alabama' then 'https://www.ua.edu/'
    else source_url
  end
where id in ('tamu', 'blinn', 'texas', 'lsu', 'alabama');

create table public.campus_events (
  id uuid primary key default gen_random_uuid(),
  campus_id text not null references public.universities(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 240),
  normalized_title text not null,
  brief_description text check (brief_description is null or char_length(brief_description) <= 600),
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null,
  all_day boolean not null default false,
  recurrence_key text,
  location_name text not null,
  address text,
  city text,
  latitude numeric,
  longitude numeric,
  organizer text,
  category text not null,
  audience text,
  source_kind public.campus_event_source_kind not null,
  source_name text not null,
  source_url text,
  source_event_id text,
  source_updated_at timestamptz,
  ingested_at timestamptz not null default now(),
  verified_at timestamptz not null,
  status public.campus_event_status not null default 'scheduled',
  image_url text,
  author_brand_id uuid references public.brand_profiles(id) on delete set null,
  author_user_id uuid references auth.users(id) on delete set null,
  is_campus_mint_system_post boolean not null default false,
  distance_from_campus_miles numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (source_url is not null or author_brand_id is not null or author_user_id is not null),
  check ((source_kind = 'brand' and author_brand_id is not null) or source_kind <> 'brand'),
  check ((is_campus_mint_system_post and author_user_id is null) or not is_campus_mint_system_post)
);

create unique index campus_events_source_identity_unique_idx
  on public.campus_events (source_kind, source_event_id);
create index campus_events_active_feed_idx on public.campus_events (campus_id, status, starts_at);
create index campus_events_normalized_dedupe_idx on public.campus_events (campus_id, normalized_title, starts_at, location_name);

create table public.event_attendance (
  event_id uuid not null references public.campus_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Provider-normalized Sports snapshots let verified server jobs advance scores,
-- schedules, polls, and box-score participation without shipping a code edit.
create table public.sports_program_snapshots (
  id uuid primary key default gen_random_uuid(),
  university_id text not null references public.universities(id) on delete cascade,
  dataset_key text not null default 'campus-athletics',
  payload jsonb not null,
  source_name text not null,
  source_url text not null check (source_url ~ '^https://'),
  season text not null,
  fetched_at timestamptz not null,
  verified_at timestamptz not null,
  stale_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, dataset_key)
);

create table public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  seen_at timestamptz
);

create table public.conversation_pins (
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.profile_notes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  body text check (body is null or char_length(body) <= 150),
  website_url text check (website_url is null or website_url ~ '^https?://'),
  music jsonb,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.mint_pins (
  content_id uuid not null references public.social_content(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (content_id, user_id)
);

create table public.content_private_appreciations (
  content_id uuid not null references public.social_content(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_id, user_id)
);

create table public.content_public_endorsements (
  content_id uuid not null references public.social_content(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_id, user_id)
);

create table public.feed_dwell_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.social_content(id) on delete cascade,
  dwell_milliseconds integer not null check (dwell_milliseconds between 0 and 3600000),
  created_at timestamptz not null default now()
);

create index direct_messages_conversation_idx on public.direct_messages (conversation_id, created_at desc);
create index notifications_recipient_idx on public.notifications (recipient_id, read_at, created_at desc);
create index feed_dwell_user_content_idx on public.feed_dwell_events (user_id, content_id, created_at desc);

create trigger brand_profiles_set_updated_at before update on public.brand_profiles for each row execute function public.set_updated_at();
create trigger brand_channels_set_updated_at before update on public.brand_channels for each row execute function public.set_updated_at();
create trigger brand_channel_posts_set_updated_at before update on public.brand_channel_posts for each row execute function public.set_updated_at();
create trigger campus_events_set_updated_at before update on public.campus_events for each row execute function public.set_updated_at();
create trigger sports_program_snapshots_set_updated_at before update on public.sports_program_snapshots for each row execute function public.set_updated_at();
create trigger direct_conversations_set_updated_at before update on public.direct_conversations for each row execute function public.set_updated_at();

alter table public.brand_profiles enable row level security;
alter table public.brand_channels enable row level security;
alter table public.brand_channel_memberships enable row level security;
alter table public.brand_channel_posts enable row level security;
alter table public.campus_events enable row level security;
alter table public.event_attendance enable row level security;
alter table public.sports_program_snapshots enable row level security;
alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.conversation_pins enable row level security;
alter table public.profile_notes enable row level security;
alter table public.notifications enable row level security;
alter table public.mint_pins enable row level security;
alter table public.content_private_appreciations enable row level security;
alter table public.content_public_endorsements enable row level security;
alter table public.feed_dwell_events enable row level security;

create policy "Brand profiles are readable when active" on public.brand_profiles for select to authenticated using (suspended_at is null);
create policy "Brands update only their profile" on public.brand_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Active Brand Channels are readable" on public.brand_channels for select to authenticated using (status = 'active');
create policy "Brands manage only their Channel" on public.brand_channels for all to authenticated using (exists (select 1 from public.brand_profiles brand where brand.id = brand_id and brand.user_id = auth.uid())) with check (exists (select 1 from public.brand_profiles brand where brand.id = brand_id and brand.user_id = auth.uid()));
create policy "Users manage their Channel memberships" on public.brand_channel_memberships for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Channel members read active Brand posts" on public.brand_channel_posts for select to authenticated using (status = 'active' and (exists (select 1 from public.brand_channel_memberships membership where membership.channel_id = brand_channel_posts.channel_id and membership.user_id = auth.uid()) or exists (select 1 from public.brand_channels channel join public.brand_profiles brand on brand.id = channel.brand_id where channel.id = brand_channel_posts.channel_id and brand.user_id = auth.uid())));
create policy "Brands publish only to their Channel" on public.brand_channel_posts for insert to authenticated with check (author_user_id = auth.uid() and exists (select 1 from public.brand_channels channel join public.brand_profiles brand on brand.id = channel.brand_id where channel.id = brand_channel_posts.channel_id and brand.user_id = auth.uid()));
create policy "Brands update posts only in their Channel" on public.brand_channel_posts for update to authenticated using (author_user_id = auth.uid() and exists (select 1 from public.brand_channels channel join public.brand_profiles brand on brand.id = channel.brand_id where channel.id = brand_channel_posts.channel_id and brand.user_id = auth.uid())) with check (author_user_id = auth.uid());
create policy "Brands delete posts only in their Channel" on public.brand_channel_posts for delete to authenticated using (author_user_id = auth.uid() and exists (select 1 from public.brand_channels channel join public.brand_profiles brand on brand.id = channel.brand_id where channel.id = brand_channel_posts.channel_id and brand.user_id = auth.uid()));

create policy "Authenticated users read active campus events" on public.campus_events for select to authenticated using (status in ('scheduled', 'updated', 'completed'));
create policy "Brands create own sourced events" on public.campus_events for insert to authenticated with check (source_kind = 'brand' and author_user_id = auth.uid() and exists (select 1 from public.brand_profiles brand where brand.id = author_brand_id and brand.user_id = auth.uid()));
create policy "Brands update only their events" on public.campus_events for update to authenticated using (source_kind = 'brand' and author_user_id = auth.uid() and exists (select 1 from public.brand_profiles brand where brand.id = author_brand_id and brand.user_id = auth.uid())) with check (source_kind = 'brand' and author_user_id = auth.uid());
create policy "Brands delete only their events" on public.campus_events for delete to authenticated using (source_kind = 'brand' and author_user_id = auth.uid() and exists (select 1 from public.brand_profiles brand where brand.id = author_brand_id and brand.user_id = auth.uid()));
create policy "Event attendance is private to attendee" on public.event_attendance for select to authenticated using (user_id = auth.uid());
create policy "Users manage own attendance" on public.event_attendance for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No client policy: snapshots are written/read through authenticated server
-- routes so a campus request cannot borrow another university's dataset.

create policy "Participants read direct conversations" on public.direct_conversations for select to authenticated using (auth.uid() in (user_a, user_b));
create policy "Students create one-to-one conversations" on public.direct_conversations for insert to authenticated with check (auth.uid() in (user_a, user_b) and exists (select 1 from public.profile_identities identity where identity.user_id = auth.uid() and identity.account_type = 'student'));
create policy "Participants read direct messages" on public.direct_messages for select to authenticated using (exists (select 1 from public.direct_conversations conversation where conversation.id = conversation_id and auth.uid() in (conversation.user_a, conversation.user_b)));
create policy "Participants send direct messages as themselves" on public.direct_messages for insert to authenticated with check (sender_id = auth.uid() and exists (select 1 from public.direct_conversations conversation where conversation.id = conversation_id and auth.uid() in (conversation.user_a, conversation.user_b)));
create policy "Pin owner only" on public.conversation_pins for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.direct_conversations conversation where conversation.id = conversation_id and auth.uid() in (conversation.user_a, conversation.user_b)));
create policy "Profile Note owner only" on public.profile_notes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Notification recipient only" on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy "Notification recipient may mark read" on public.notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create policy "Mint Pin owner only" on public.mint_pins for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Private appreciation owner only" on public.content_private_appreciations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Public endorsements readable" on public.content_public_endorsements for select to authenticated using (true);
create policy "Users manage own public endorsements" on public.content_public_endorsements for insert to authenticated with check (user_id = auth.uid());
create policy "Users remove own public endorsements" on public.content_public_endorsements for delete to authenticated using (user_id = auth.uid());
create policy "Dwell owner only" on public.feed_dwell_events for insert to authenticated with check (user_id = auth.uid());
create policy "Dwell never client-readable" on public.feed_dwell_events for select to authenticated using (false);

create policy "Students update their own public profile" on public.profiles for update to authenticated using (user_id = auth.uid() and exists (select 1 from public.profile_identities identity where identity.user_id = auth.uid() and identity.account_type = 'student')) with check (user_id = auth.uid());
create policy "Users create own likes" on public.content_likes for insert to authenticated with check (user_id = auth.uid());
create policy "Users remove own likes" on public.content_likes for delete to authenticated using (user_id = auth.uid());
create policy "Users create own saves" on public.content_saves for insert to authenticated with check (user_id = auth.uid());
create policy "Users remove own saves" on public.content_saves for delete to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('mint-media', 'mint-media', false, 104857600, array['image/jpeg','image/png','image/webp','video/mp4','video/webm']),
  ('message-media', 'message-media', false, 26214400, array['image/jpeg','image/png','image/webp','video/mp4'])
on conflict (id) do nothing;

create policy "Users upload their own avatars" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update their own avatars" on storage.objects for update to authenticated using (bucket_id = 'avatars' and owner_id = auth.uid()::text);
create policy "Authenticated users read avatars" on storage.objects for select to authenticated using (bucket_id = 'avatars');
create policy "Users upload their own Mint media" on storage.objects for insert to authenticated with check (bucket_id = 'mint-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users read their own Mint media" on storage.objects for select to authenticated using (bucket_id = 'mint-media' and owner_id = auth.uid()::text);
create policy "Users upload their own message media" on storage.objects for insert to authenticated with check (bucket_id = 'message-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users read their own message uploads" on storage.objects for select to authenticated using (bucket_id = 'message-media' and owner_id = auth.uid()::text);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages') then alter publication supabase_realtime add table public.direct_messages; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then alter publication supabase_realtime add table public.notifications; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'brand_channel_posts') then alter publication supabase_realtime add table public.brand_channel_posts; end if;
end $$;

comment on column public.profile_identities.account_type is 'Server-managed privilege boundary: student, brand, or Campus Mint system.';
comment on column public.brand_profiles.verification_status is 'Mailbox ownership is separate; only verified grants an official Brand badge.';
comment on table public.brand_channels is 'Brand-owned broadcast/follow channel; intentionally distinct from peer Groups.';
comment on table public.campus_events is 'Normalized, sourced events eligible for campus-radius discovery.';
comment on table public.sports_program_snapshots is 'Server-verified provider snapshot; intentionally has no direct client RLS policy.';
comment on table public.content_private_appreciations is 'Private interaction; other users cannot enumerate it.';
