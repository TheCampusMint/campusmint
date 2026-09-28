-- Minimal marketplace publishing and listing-scoped private contact.
-- Existing policies and verification revocations remain unchanged.
begin;
grant select on public.university_marketplace_policies, public.marketplace_verified_students,
  public.campus_networks, public.marketplace_listings to service_role;
grant insert, update on public.marketplace_listings to service_role;
create table public.marketplace_messages (
  id uuid primary key,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index marketplace_messages_thread on public.marketplace_messages(listing_id, buyer_id, created_at);
alter table public.marketplace_messages enable row level security;
revoke all on public.marketplace_messages from public, anon, authenticated;
grant select, insert on public.marketplace_messages to service_role;
-- Only authenticated server routes can access messages, after checking the real
-- account's campus, listing ownership/participation and blocks in both directions.
commit;
