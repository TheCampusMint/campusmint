-- Account-private recommendation feedback, no changes to existing accounts/posts.
create table public.feed_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  mint_id uuid not null references public.social_content(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  topics text[] not null default '{}',
  weight real not null default 0 check (weight >= 0 and weight <= 4),
  reason text check (reason in ('creator','content','relevance')),
  updated_at timestamptz not null default now(),
  primary key (user_id,mint_id),
  check (cardinality(topics) <= 20)
);
alter table public.feed_preferences enable row level security;
revoke all on public.feed_preferences from public, anon, authenticated;
grant select,insert,update on public.feed_preferences to service_role;
create index feed_preferences_user_updated on public.feed_preferences(user_id,updated_at desc);
-- Only aggregate meaningful-view counts leave the server; no viewer identities.
create view public.feed_view_counts as
  select mint_id, count(*) filter (where weight > 0)::integer as view_count
  from public.feed_preferences group by mint_id;
revoke all on public.feed_view_counts from public, anon, authenticated;
grant select on public.feed_view_counts to service_role;
