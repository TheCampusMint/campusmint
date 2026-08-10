-- Campus Mint Marketplace v1 schema.
-- No development listings are inserted. Client samples remain explicitly local-only.

create type public.marketplace_listing_status as enum ('active', 'pending', 'reserved', 'sold', 'removed');
create type public.marketplace_condition as enum ('new', 'like_new', 'good', 'fair', 'for_parts', 'ticket_pass', 'service');
create type public.marketplace_offer_status as enum ('offer_sent', 'withdrawn', 'accepted', 'declined', 'countered');
create type public.marketplace_transaction_status as enum ('offer_sent', 'offer_accepted', 'meetup_planned', 'completed', 'cancelled', 'disputed');
create type public.marketplace_report_status as enum ('pending', 'reviewing', 'resolved', 'dismissed');

create table public.university_marketplace_policies (
  university_id text primary key references public.universities(id) on delete cascade,
  marketplace_enabled boolean not null default false,
  scope_id text not null,
  ticket_marketplace_enabled boolean not null default false,
  ticket_resale_allowed boolean,
  ticket_transfer_method text,
  ticket_policy_url text,
  prohibited_categories jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.marketplace_verified_students (
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id text not null references public.universities(id) on delete cascade,
  verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, university_id)
);

create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null references auth.users(id) on delete restrict,
  university_id text not null references public.universities(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 100),
  description text not null check (char_length(description) between 2 and 5000),
  category text not null check (category in (
    'sports_passes_tickets', 'textbooks', 'furniture', 'clothing', 'electronics',
    'dorm_apartment', 'school_supplies', 'bikes_transportation', 'services', 'other'
  )),
  condition public.marketplace_condition not null,
  asking_price numeric(12, 2) not null check (asking_price >= 0),
  negotiable boolean not null default false,
  status public.marketplace_listing_status not null default 'pending',
  pickup_area text not null check (char_length(pickup_area) between 2 and 120),
  delivery_available boolean not null default false,
  view_count integer not null default 0 check (view_count >= 0),
  favorite_count integer not null default 0 check (favorite_count >= 0),
  offer_count integer not null default 0 check (offer_count >= 0),
  moderation_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketplace_listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (listing_id, storage_path)
);

create table public.marketplace_offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  status public.marketplace_offer_status not null default 'offer_sent',
  counter_amount numeric(12, 2) check (counter_amount is null or counter_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index marketplace_one_open_offer_per_buyer_idx
  on public.marketplace_offers (listing_id, buyer_user_id)
  where status = 'offer_sent';

create table public.marketplace_favorites (
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

create table public.marketplace_transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  offer_id uuid references public.marketplace_offers(id) on delete set null,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  seller_user_id uuid not null references auth.users(id) on delete restrict,
  status public.marketplace_transaction_status not null default 'offer_sent',
  meetup_area text,
  completed_at timestamptz,
  dispute_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketplace_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (reason in ('prohibited_item', 'fraud_or_scam', 'ticket_concern', 'misleading_listing', 'other')),
  details text,
  status public.marketplace_report_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index marketplace_listings_university_status_created_idx
  on public.marketplace_listings (university_id, status, created_at desc);
create index marketplace_listings_category_price_idx
  on public.marketplace_listings (category, asking_price);
create index marketplace_offers_listing_status_idx
  on public.marketplace_offers (listing_id, status, created_at desc);
create index marketplace_transactions_participants_idx
  on public.marketplace_transactions (buyer_user_id, seller_user_id, status);
create index marketplace_reports_status_created_idx
  on public.marketplace_reports (status, created_at);

create trigger university_marketplace_policies_set_updated_at
before update on public.university_marketplace_policies
for each row execute function public.set_updated_at();
create trigger marketplace_listings_set_updated_at
before update on public.marketplace_listings
for each row execute function public.set_updated_at();
create trigger marketplace_offers_set_updated_at
before update on public.marketplace_offers
for each row execute function public.set_updated_at();
create trigger marketplace_transactions_set_updated_at
before update on public.marketplace_transactions
for each row execute function public.set_updated_at();

create or replace function public.is_verified_marketplace_student(target_university_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.marketplace_verified_students
    where user_id = auth.uid()
      and university_id = target_university_id
      and verified_at is not null
      and revoked_at is null
  );
$$;

revoke all on function public.is_verified_marketplace_student(text) from public;
grant execute on function public.is_verified_marketplace_student(text) to authenticated;

create or replace function public.sync_marketplace_favorite_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.marketplace_listings
  set favorite_count = greatest(0, favorite_count + case when tg_op = 'INSERT' then 1 else -1 end)
  where id = coalesce(new.listing_id, old.listing_id);
  return coalesce(new, old);
end;
$$;

create trigger marketplace_favorite_count_insert
after insert on public.marketplace_favorites
for each row execute function public.sync_marketplace_favorite_count();
create trigger marketplace_favorite_count_delete
after delete on public.marketplace_favorites
for each row execute function public.sync_marketplace_favorite_count();

create or replace function public.sync_marketplace_offer_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare delta integer := 0;
begin
  if tg_op = 'INSERT' and new.status = 'offer_sent' then delta := 1;
  elsif tg_op = 'DELETE' and old.status = 'offer_sent' then delta := -1;
  elsif tg_op = 'UPDATE' and old.status = 'offer_sent' and new.status <> 'offer_sent' then delta := -1;
  elsif tg_op = 'UPDATE' and old.status <> 'offer_sent' and new.status = 'offer_sent' then delta := 1;
  end if;
  update public.marketplace_listings
  set offer_count = greatest(0, offer_count + delta)
  where id = coalesce(new.listing_id, old.listing_id);
  return coalesce(new, old);
end;
$$;

create trigger marketplace_offer_count_change
after insert or update or delete on public.marketplace_offers
for each row execute function public.sync_marketplace_offer_count();

alter table public.university_marketplace_policies enable row level security;
alter table public.marketplace_verified_students enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_listing_photos enable row level security;
alter table public.marketplace_offers enable row level security;
alter table public.marketplace_favorites enable row level security;
alter table public.marketplace_transactions enable row level security;
alter table public.marketplace_reports enable row level security;

create policy "Authenticated users can read marketplace policies"
on public.university_marketplace_policies for select to authenticated using (true);
create policy "Students can read their own verification"
on public.marketplace_verified_students for select to authenticated using (user_id = auth.uid());

create policy "Verified students can read same-university listings"
on public.marketplace_listings for select to authenticated
using (public.is_verified_marketplace_student(university_id) and (status = 'active' or seller_user_id = auth.uid()));
create policy "Verified students can create pending listings"
on public.marketplace_listings for insert to authenticated
with check (seller_user_id = auth.uid() and status = 'pending' and public.is_verified_marketplace_student(university_id));
create policy "Sellers can update their own listings"
on public.marketplace_listings for update to authenticated
using (seller_user_id = auth.uid() and public.is_verified_marketplace_student(university_id))
with check (seller_user_id = auth.uid() and public.is_verified_marketplace_student(university_id));

create policy "Verified students can read same-university listing photos"
on public.marketplace_listing_photos for select to authenticated
using (exists (select 1 from public.marketplace_listings l where l.id = listing_id and public.is_verified_marketplace_student(l.university_id)));
create policy "Sellers can add listing photo metadata"
on public.marketplace_listing_photos for insert to authenticated
with check (exists (select 1 from public.marketplace_listings l where l.id = listing_id and l.seller_user_id = auth.uid()));
create policy "Sellers can remove listing photo metadata"
on public.marketplace_listing_photos for delete to authenticated
using (exists (select 1 from public.marketplace_listings l where l.id = listing_id and l.seller_user_id = auth.uid()));

create policy "Offer participants can read offers"
on public.marketplace_offers for select to authenticated
using (buyer_user_id = auth.uid() or exists (select 1 from public.marketplace_listings l where l.id = listing_id and l.seller_user_id = auth.uid()));
create policy "Verified students can make same-university offers"
on public.marketplace_offers for insert to authenticated
with check (buyer_user_id = auth.uid() and status = 'offer_sent' and exists (
  select 1 from public.marketplace_listings l
  where l.id = listing_id and l.seller_user_id <> auth.uid() and l.status = 'active'
    and public.is_verified_marketplace_student(l.university_id)
));
create policy "Buyers can withdraw sent offers"
on public.marketplace_offers for update to authenticated
using (buyer_user_id = auth.uid() and status = 'offer_sent')
with check (buyer_user_id = auth.uid() and status = 'withdrawn');
create policy "Sellers can respond to sent offers"
on public.marketplace_offers for update to authenticated
using (status = 'offer_sent' and exists (select 1 from public.marketplace_listings l where l.id = listing_id and l.seller_user_id = auth.uid()))
with check (status in ('accepted', 'declined', 'countered'));

create policy "Students can read their favorites"
on public.marketplace_favorites for select to authenticated using (user_id = auth.uid());
create policy "Verified students can save same-university listings"
on public.marketplace_favorites for insert to authenticated
with check (user_id = auth.uid() and exists (
  select 1 from public.marketplace_listings l where l.id = listing_id
    and public.is_verified_marketplace_student(l.university_id)
));
create policy "Students can remove their favorites"
on public.marketplace_favorites for delete to authenticated using (user_id = auth.uid());

create policy "Transaction participants can read transactions"
on public.marketplace_transactions for select to authenticated
using (buyer_user_id = auth.uid() or seller_user_id = auth.uid());
create policy "Verified students can submit listing reports"
on public.marketplace_reports for insert to authenticated
with check (reporter_user_id = auth.uid() and exists (
  select 1 from public.marketplace_listings l where l.id = listing_id
    and public.is_verified_marketplace_student(l.university_id)
));

revoke all on public.university_marketplace_policies, public.marketplace_verified_students,
  public.marketplace_listings, public.marketplace_listing_photos, public.marketplace_offers,
  public.marketplace_favorites, public.marketplace_transactions, public.marketplace_reports from anon;
revoke all on public.university_marketplace_policies, public.marketplace_verified_students,
  public.marketplace_listings, public.marketplace_listing_photos, public.marketplace_offers,
  public.marketplace_favorites, public.marketplace_transactions, public.marketplace_reports from authenticated;

grant select on public.university_marketplace_policies, public.marketplace_verified_students,
  public.marketplace_listings, public.marketplace_listing_photos, public.marketplace_offers,
  public.marketplace_favorites, public.marketplace_transactions to authenticated;
grant insert on public.marketplace_listings, public.marketplace_listing_photos, public.marketplace_offers,
  public.marketplace_favorites, public.marketplace_reports to authenticated;
grant delete on public.marketplace_listing_photos, public.marketplace_favorites to authenticated;
grant update (title, description, category, condition, asking_price, negotiable, pickup_area,
  delivery_available, updated_at) on public.marketplace_listings to authenticated;
grant update (status, counter_amount, updated_at) on public.marketplace_offers to authenticated;

comment on table public.marketplace_listings is
  'Verified-student, university-scoped Marketplace listings. Engagement counters default to zero and are never seeded.';
comment on table public.marketplace_transactions is
  'Future transaction state only. No client insert/update policies or payment fields are provided in v1.';
comment on table public.marketplace_reports is
  'Trust-and-safety reports. Report contents are not readable by marketplace users.';
