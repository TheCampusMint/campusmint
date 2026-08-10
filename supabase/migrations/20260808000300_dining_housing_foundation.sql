-- Dining and housing extend the canonical campus_entities model.
-- External reviews and Campus Mint reviews remain separate by design.

create type public.discovery_photo_source_type as enum (
  'university_official',
  'google_places',
  'campus_mint_user',
  'business_owner',
  'development'
);

create table public.dining_locations (
  id uuid primary key references public.campus_entities(id) on delete cascade,
  campus_id text not null,
  campus_area text not null,
  dining_scope text not null check (dining_scope in ('on_campus', 'off_campus')),
  categories text[] not null default '{}',
  regular_hours jsonb not null default '[]'::jsonb,
  special_hours text,
  open_now boolean,
  temporarily_closed boolean not null default false,
  today_menu_url text,
  wait_time_minutes integer check (wait_time_minutes is null or wait_time_minutes >= 0),
  daily_recommendation text,
  phone text,
  website text,
  distance_miles numeric(7, 2) check (distance_miles is null or distance_miles >= 0),
  price_level smallint check (price_level is null or price_level between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.housing_entities (
  id uuid primary key references public.campus_entities(id) on delete cascade,
  campus_id text not null,
  campus_name text not null,
  housing_scope text not null check (housing_scope in ('on_campus', 'off_campus')),
  housing_type text not null check (
    housing_type in ('residence_hall', 'university_apartment', 'apartment', 'shared_housing')
  ),
  official_description text,
  website text,
  phone text,
  distance_miles numeric(7, 2) check (distance_miles is null or distance_miles >= 0),
  capacity integer check (capacity is null or capacity >= 0),
  eligibility_restrictions text[] not null default '{}',
  pet_policy text,
  parking text,
  furnished boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.external_place_links (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.campus_entities(id) on delete cascade,
  provider text not null,
  external_place_id text not null,
  provider_uri text,
  attribution_label text not null,
  last_refreshed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_place_id),
  unique (entity_id, provider)
);

create table public.campus_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.campus_entities(id) on delete cascade,
  reviewer_user_id uuid,
  review_type text not null check (review_type in ('restaurant', 'dining_hall', 'housing')),
  overall_rating numeric(2, 1) not null check (overall_rating between 1 and 5),
  category_ratings jsonb not null default '{}'::jsonb,
  review_text text,
  status public.community_submission_status not null default 'pending',
  source_type public.record_source_type not null default 'community_submission',
  confidence_level public.data_confidence_level not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.housing_units (
  id uuid primary key default gen_random_uuid(),
  housing_entity_id uuid not null references public.housing_entities(id) on delete cascade,
  name text not null,
  bedroom_count integer check (bedroom_count is null or bedroom_count >= 0),
  bathroom_count numeric(4, 1) check (bathroom_count is null or bathroom_count >= 0),
  occupants_per_bedroom integer check (occupants_per_bedroom is null or occupants_per_bedroom > 0),
  furnished boolean,
  status text not null default 'active' check (status in ('active', 'upcoming', 'discontinued', 'archived')),
  effective_from date,
  effective_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (housing_entity_id, name, effective_from)
);

create table public.housing_rates (
  id uuid primary key default gen_random_uuid(),
  housing_unit_id uuid not null references public.housing_units(id) on delete cascade,
  term_label text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'USD',
  cadence text not null check (cadence in ('semester', 'month', 'year')),
  source_id uuid references public.data_sources(id) on delete set null,
  source_url text,
  source_type public.record_source_type not null,
  confidence_level public.data_confidence_level not null,
  effective_from date,
  effective_until date,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (housing_unit_id, term_label, effective_from)
);

create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entity_amenities (
  entity_id uuid not null references public.campus_entities(id) on delete cascade,
  amenity_id uuid not null references public.amenities(id) on delete cascade,
  source_id uuid references public.data_sources(id) on delete set null,
  confidence_level public.data_confidence_level not null default 'pending',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (entity_id, amenity_id)
);

create table public.entity_photos (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.campus_entities(id) on delete cascade,
  source_type public.discovery_photo_source_type not null,
  source_url text,
  external_photo_reference text,
  storage_url text,
  alt_text text not null,
  attribution_text text,
  attribution_url text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_type <> 'google_places' or storage_url is null)
);

create index dining_locations_scope_category_idx
  on public.dining_locations (dining_scope, campus_id);
create index housing_entities_scope_type_idx
  on public.housing_entities (housing_scope, housing_type, campus_id);
create index external_place_links_entity_idx
  on public.external_place_links (entity_id, provider);
create index campus_reviews_entity_status_idx
  on public.campus_reviews (entity_id, status, created_at desc);
create index housing_rates_unit_term_idx
  on public.housing_rates (housing_unit_id, term_label);
create index entity_photos_entity_idx
  on public.entity_photos (entity_id, source_type);

create trigger dining_locations_set_updated_at
before update on public.dining_locations
for each row execute function public.set_updated_at();
create trigger housing_entities_set_updated_at
before update on public.housing_entities
for each row execute function public.set_updated_at();
create trigger external_place_links_set_updated_at
before update on public.external_place_links
for each row execute function public.set_updated_at();
create trigger campus_reviews_set_updated_at
before update on public.campus_reviews
for each row execute function public.set_updated_at();
create trigger housing_units_set_updated_at
before update on public.housing_units
for each row execute function public.set_updated_at();
create trigger housing_rates_set_updated_at
before update on public.housing_rates
for each row execute function public.set_updated_at();
create trigger amenities_set_updated_at
before update on public.amenities
for each row execute function public.set_updated_at();
create trigger entity_photos_set_updated_at
before update on public.entity_photos
for each row execute function public.set_updated_at();

alter table public.dining_locations enable row level security;
alter table public.housing_entities enable row level security;
alter table public.external_place_links enable row level security;
alter table public.campus_reviews enable row level security;
alter table public.housing_units enable row level security;
alter table public.housing_rates enable row level security;
alter table public.amenities enable row level security;
alter table public.entity_amenities enable row level security;
alter table public.entity_photos enable row level security;

create policy "Public can read trusted dining details"
on public.dining_locations for select to anon, authenticated
using (exists (
  select 1 from public.campus_entities
  where campus_entities.id = dining_locations.id
    and campus_entities.confidence_level in ('official', 'community_verified')
));

create policy "Public can read trusted housing details"
on public.housing_entities for select to anon, authenticated
using (exists (
  select 1 from public.campus_entities
  where campus_entities.id = housing_entities.id
    and campus_entities.confidence_level in ('official', 'community_verified')
));

create policy "Public can read trusted external place links"
on public.external_place_links for select to anon, authenticated
using (exists (
  select 1 from public.campus_entities
  where campus_entities.id = external_place_links.entity_id
    and campus_entities.confidence_level in ('official', 'community_verified')
));

create policy "Public can read community verified Campus Mint reviews"
on public.campus_reviews for select to anon, authenticated
using (status = 'community_verified' and confidence_level = 'community_verified');

create policy "Public can read trusted housing units"
on public.housing_units for select to anon, authenticated
using (exists (
  select 1 from public.housing_entities
  join public.campus_entities on campus_entities.id = housing_entities.id
  where housing_entities.id = housing_units.housing_entity_id
    and campus_entities.confidence_level in ('official', 'community_verified')
));

create policy "Public can read trusted housing rates"
on public.housing_rates for select to anon, authenticated
using (confidence_level in ('official', 'community_verified'));

create policy "Public can read amenities"
on public.amenities for select to anon, authenticated using (true);

create policy "Public can read trusted entity amenities"
on public.entity_amenities for select to anon, authenticated
using (confidence_level in ('official', 'community_verified'));

create policy "Public can read trusted entity photos"
on public.entity_photos for select to anon, authenticated
using (exists (
  select 1 from public.campus_entities
  where campus_entities.id = entity_photos.entity_id
    and campus_entities.confidence_level in ('official', 'community_verified')
));

comment on table public.external_place_links is
  'Persist provider IDs and allowed linkage metadata only. Restricted provider content is retrieved dynamically.';
comment on table public.campus_reviews is
  'Campus Mint reviews only. Third-party review summaries must never be inserted into this table.';
comment on table public.entity_photos is
  'Photo provenance and references. Google Places photo bytes must not be re-hosted here.';

