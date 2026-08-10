-- Campus Network Marketplace extension.
-- Campus Network controls regional access; university_id remains the seller's verified academic identity.
-- Sports ticket records contain discovery/negotiation metadata only. No payment, barcode, credential,
-- issuance, wallet, ownership-transfer, or ticket-transfer data is stored here.

create table public.campus_networks (
  id text primary key,
  name text not null check (char_length(name) between 2 and 120),
  enabled_features text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campus_network_universities (
  campus_network_id text not null references public.campus_networks(id) on delete cascade,
  university_id text not null references public.universities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campus_network_id, university_id),
  unique (university_id)
);

insert into public.campus_networks (id, name, enabled_features) values
  ('bryan-college-station', 'Bryan / College Station', array['marketplace']),
  ('austin', 'Austin', array['marketplace']),
  ('baton-rouge', 'Baton Rouge', array['marketplace']),
  ('tuscaloosa', 'Tuscaloosa', array['marketplace'])
on conflict (id) do update set
  name = excluded.name,
  enabled_features = excluded.enabled_features,
  updated_at = now();

insert into public.campus_network_universities (campus_network_id, university_id) values
  ('bryan-college-station', 'tamu'),
  ('bryan-college-station', 'blinn'),
  ('austin', 'texas'),
  ('baton-rouge', 'lsu'),
  ('tuscaloosa', 'alabama')
on conflict (campus_network_id, university_id) do nothing;

alter table public.university_marketplace_policies
  add column campus_network_id text references public.campus_networks(id) on delete restrict;

update public.university_marketplace_policies as policy
set campus_network_id = membership.campus_network_id
from public.campus_network_universities membership
where membership.university_id = policy.university_id;

alter table public.university_marketplace_policies
  alter column campus_network_id set not null;

alter table public.marketplace_listings
  add column campus_network_id text references public.campus_networks(id) on delete restrict;

update public.marketplace_listings as listing
set campus_network_id = membership.campus_network_id
from public.campus_network_universities membership
where membership.university_id = listing.university_id;

alter table public.marketplace_listings
  alter column campus_network_id set not null;

alter table public.marketplace_offers
  add column note text check (note is null or char_length(note) <= 1000);

alter table public.marketplace_listing_photos
  add column photo_purpose text not null default 'item_photo'
    check (photo_purpose in ('item_photo', 'event_image', 'generic_sports_image', 'seat_information', 'proof_placeholder')),
  add column contains_scannable_ticket_credential boolean not null default false
    check (contains_scannable_ticket_credential = false);

create table public.marketplace_sports_ticket_details (
  listing_id uuid primary key references public.marketplace_listings(id) on delete cascade,
  sport text not null check (char_length(sport) between 2 and 80),
  event_external_id text,
  event_name text not null check (char_length(event_name) between 2 and 160),
  event_date text,
  ticket_type text not null check (ticket_type in (
    'student_sports_pass', 'student_ticket', 'guest_ticket', 'general_admission',
    'reserved_seat', 'season_pass', 'other'
  )),
  custom_ticket_type text check (
    (ticket_type = 'other' and custom_ticket_type is not null and char_length(custom_ticket_type) between 2 and 100)
    or (ticket_type <> 'other' and custom_ticket_type is null)
  ),
  quantity integer not null check (quantity > 0),
  seat_details text check (seat_details is null or char_length(seat_details) <= 500),
  transfer_notes text check (transfer_notes is null or char_length(transfer_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketplace_listings_network_status_created_idx
  on public.marketplace_listings (campus_network_id, status, created_at desc);
create index campus_network_universities_network_idx
  on public.campus_network_universities (campus_network_id, university_id);

create trigger campus_networks_set_updated_at
before update on public.campus_networks
for each row execute function public.set_updated_at();
create trigger marketplace_sports_ticket_details_set_updated_at
before update on public.marketplace_sports_ticket_details
for each row execute function public.set_updated_at();

create or replace function public.enforce_marketplace_listing_network_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.campus_network_universities membership
    where membership.campus_network_id = new.campus_network_id
      and membership.university_id = new.university_id
  ) then
    raise exception 'Listing university must belong to its Campus Network';
  end if;
  return new;
end;
$$;

create trigger marketplace_listing_network_membership_guard
before insert or update of campus_network_id, university_id on public.marketplace_listings
for each row execute function public.enforce_marketplace_listing_network_membership();

create or replace function public.enforce_marketplace_sports_ticket_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.marketplace_listings listing
    where listing.id = new.listing_id
      and listing.category = 'sports_passes_tickets'
  ) then
    raise exception 'Sports ticket details require a sports_passes_tickets listing';
  end if;
  return new;
end;
$$;

create trigger marketplace_sports_ticket_category_guard
before insert or update on public.marketplace_sports_ticket_details
for each row execute function public.enforce_marketplace_sports_ticket_category();

create or replace function public.is_verified_marketplace_network_member(target_campus_network_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.marketplace_verified_students verification
    join public.campus_network_universities membership
      on membership.university_id = verification.university_id
    where verification.user_id = auth.uid()
      and membership.campus_network_id = target_campus_network_id
      and verification.verified_at is not null
      and verification.revoked_at is null
  );
$$;

revoke all on function public.is_verified_marketplace_network_member(text) from public;
grant execute on function public.is_verified_marketplace_network_member(text) to authenticated;

alter table public.campus_networks enable row level security;
alter table public.campus_network_universities enable row level security;
alter table public.marketplace_sports_ticket_details enable row level security;

create policy "Authenticated users can read Campus Networks"
on public.campus_networks for select to authenticated using (true);
create policy "Authenticated users can read Campus Network membership"
on public.campus_network_universities for select to authenticated using (true);

create policy "Verified network students can read network listings"
on public.marketplace_listings for select to authenticated
using (
  public.is_verified_marketplace_network_member(campus_network_id)
  and (status in ('active', 'reserved') or seller_user_id = auth.uid())
);
create policy "Verified students can create network listings"
on public.marketplace_listings for insert to authenticated
with check (
  seller_user_id = auth.uid()
  and status = 'pending'
  and public.is_verified_marketplace_student(university_id)
  and public.is_verified_marketplace_network_member(campus_network_id)
);
create policy "Sellers can update their own network listings"
on public.marketplace_listings for update to authenticated
using (
  seller_user_id = auth.uid()
  and public.is_verified_marketplace_student(university_id)
  and public.is_verified_marketplace_network_member(campus_network_id)
)
with check (
  seller_user_id = auth.uid()
  and public.is_verified_marketplace_student(university_id)
  and public.is_verified_marketplace_network_member(campus_network_id)
);

create policy "Verified network students can read listing photos"
on public.marketplace_listing_photos for select to authenticated
using (exists (
  select 1 from public.marketplace_listings listing
  where listing.id = listing_id
    and public.is_verified_marketplace_network_member(listing.campus_network_id)
));

create policy "Verified network students can make offers"
on public.marketplace_offers for insert to authenticated
with check (
  buyer_user_id = auth.uid()
  and status = 'offer_sent'
  and exists (
    select 1 from public.marketplace_listings listing
    where listing.id = listing_id
      and listing.seller_user_id <> auth.uid()
      and listing.status = 'active'
      and public.is_verified_marketplace_network_member(listing.campus_network_id)
  )
);

create policy "Verified network students can save listings"
on public.marketplace_favorites for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.marketplace_listings listing
    where listing.id = listing_id
      and public.is_verified_marketplace_network_member(listing.campus_network_id)
  )
);

create policy "Verified network students can submit reports"
on public.marketplace_reports for insert to authenticated
with check (
  reporter_user_id = auth.uid()
  and exists (
    select 1 from public.marketplace_listings listing
    where listing.id = listing_id
      and public.is_verified_marketplace_network_member(listing.campus_network_id)
  )
);

create policy "Verified network students can read sports ticket details"
on public.marketplace_sports_ticket_details for select to authenticated
using (exists (
  select 1 from public.marketplace_listings listing
  where listing.id = listing_id
    and public.is_verified_marketplace_network_member(listing.campus_network_id)
));
create policy "Sellers can add sports ticket details"
on public.marketplace_sports_ticket_details for insert to authenticated
with check (exists (
  select 1 from public.marketplace_listings listing
  where listing.id = listing_id
    and listing.seller_user_id = auth.uid()
    and public.is_verified_marketplace_student(listing.university_id)
));
create policy "Sellers can update sports ticket details"
on public.marketplace_sports_ticket_details for update to authenticated
using (exists (
  select 1 from public.marketplace_listings listing
  where listing.id = listing_id and listing.seller_user_id = auth.uid()
))
with check (exists (
  select 1 from public.marketplace_listings listing
  where listing.id = listing_id and listing.seller_user_id = auth.uid()
));
create policy "Sellers can remove sports ticket details"
on public.marketplace_sports_ticket_details for delete to authenticated
using (exists (
  select 1 from public.marketplace_listings listing
  where listing.id = listing_id and listing.seller_user_id = auth.uid()
));

revoke all on public.campus_networks, public.campus_network_universities,
  public.marketplace_sports_ticket_details from anon, authenticated;

grant select on public.campus_networks, public.campus_network_universities,
  public.marketplace_sports_ticket_details to authenticated;
grant insert, update, delete on public.marketplace_sports_ticket_details to authenticated;
grant update (status, updated_at) on public.marketplace_listings to authenticated;

comment on table public.campus_networks is
  'Reusable regional networks for Marketplace and future local shared features; university identity remains separate.';
comment on table public.campus_network_universities is
  'Additive Campus Network membership so nearby colleges can share local features without changing components.';
comment on table public.marketplace_sports_ticket_details is
  'Discovery and negotiation metadata only. Actual payment and any permitted transfer happen outside Campus Mint.';
comment on column public.marketplace_listing_photos.contains_scannable_ticket_credential is
  'Must remain false. QR codes, barcodes, scannable screenshots, and transfer credentials are prohibited.';
comment on column public.university_marketplace_policies.scope_id is
  'Legacy Marketplace scope identifier retained for migration compatibility; campus_network_id controls shared access.';
