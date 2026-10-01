-- PLACES-01: durable IDs and Campus Mint-owned content only.
-- No Google names, coordinates, addresses, ratings, reviews, hours, or photo references.
-- Forward-only. Apply only after explicit production permission approval.
create table public.place_identity (
  id uuid primary key default gen_random_uuid(),
  google_place_id text not null unique check (google_place_id ~ '^[A-Za-z0-9_-]{1,255}$'),
  campus_mint_tags text[] not null default '{}' check (cardinality(campus_mint_tags) <= 30),
  created_at timestamptz not null default now()
);
create table public.place_areas (
  place_id uuid not null references public.place_identity(id) on delete cascade,
  area_key text not null check (char_length(area_key) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (place_id, area_key)
);
create index place_areas_lookup on public.place_areas(area_key, place_id);
-- Community schema is prepared, not a claim that reviews/uploads are enabled in UI.
create table public.place_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.place_identity(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, place_id)
);
create table public.place_student_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.place_identity(id) on delete cascade,
  campus_id text not null,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 1 and 4000),
  moderation_state text not null default 'pending' check (moderation_state in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, place_id)
);
create table public.place_student_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.place_identity(id) on delete cascade,
  campus_id text not null,
  -- A future validated first-party upload key, never a Google photo URL/name.
  storage_object_path text not null check (storage_object_path !~ '^(https?://|places/)'),
  moderation_state text not null default 'pending' check (moderation_state in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.place_identity enable row level security;
alter table public.place_areas enable row level security;
alter table public.place_saves enable row level security;
alter table public.place_student_reviews enable row level security;
alter table public.place_student_photos enable row level security;
revoke all on public.place_identity, public.place_areas, public.place_saves, public.place_student_reviews, public.place_student_photos from public, anon, authenticated, service_role;
-- Only identity registration is shipped. Community writes remain closed until
-- verified-author/campus/moderation/upload endpoints receive a separate review.
grant select, insert on public.place_identity, public.place_areas to service_role;
grant select on public.place_saves, public.place_student_reviews, public.place_student_photos to service_role;
