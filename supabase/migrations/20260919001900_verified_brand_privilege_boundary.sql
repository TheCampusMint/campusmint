-- Brand mailbox ownership creates a profile only. Public Brand privileges are
-- available after an administrator has explicitly verified the Brand.

drop policy if exists "Active Brand Channels are readable" on public.brand_channels;
create policy "Verified active Brand Channels are readable"
on public.brand_channels for select to authenticated
using (
  status = 'active'
  and exists (
    select 1 from public.brand_profiles brand
    where brand.id = brand_id
      and brand.verification_status = 'verified'
      and brand.suspended_at is null
  )
);

drop policy if exists "Brands manage only their Channel" on public.brand_channels;
create policy "Verified Brands manage only their Channel"
on public.brand_channels for all to authenticated
using (
  exists (
    select 1 from public.brand_profiles brand
    where brand.id = brand_id
      and brand.user_id = auth.uid()
      and brand.verification_status = 'verified'
      and brand.suspended_at is null
  )
)
with check (
  exists (
    select 1 from public.brand_profiles brand
    where brand.id = brand_id
      and brand.user_id = auth.uid()
      and brand.verification_status = 'verified'
      and brand.suspended_at is null
  )
);

drop policy if exists "Users manage their Channel memberships" on public.brand_channel_memberships;
create policy "Users manage verified Channel memberships"
on public.brand_channel_memberships for all to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.brand_channels channel
    join public.brand_profiles brand on brand.id = channel.brand_id
    where channel.id = channel_id
      and channel.status = 'active'
      and brand.verification_status = 'verified'
      and brand.suspended_at is null
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.brand_channels channel
    join public.brand_profiles brand on brand.id = channel.brand_id
    where channel.id = channel_id
      and channel.status = 'active'
      and brand.verification_status = 'verified'
      and brand.suspended_at is null
  )
);

drop policy if exists "Channel members read active Brand posts" on public.brand_channel_posts;
create policy "Channel members read verified Brand posts"
on public.brand_channel_posts for select to authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.brand_channels channel
    join public.brand_profiles brand on brand.id = channel.brand_id
    where channel.id = channel_id
      and channel.status = 'active'
      and brand.verification_status = 'verified'
      and brand.suspended_at is null
      and (
        brand.user_id = auth.uid()
        or exists (
          select 1 from public.brand_channel_memberships membership
          where membership.channel_id = channel.id and membership.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Brands publish only to their Channel" on public.brand_channel_posts;
create policy "Verified Brands publish only to their Channel"
on public.brand_channel_posts for insert to authenticated
with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.brand_channels channel
    join public.brand_profiles brand on brand.id = channel.brand_id
    where channel.id = channel_id
      and channel.status = 'active'
      and brand.user_id = auth.uid()
      and brand.verification_status = 'verified'
      and brand.suspended_at is null
  )
);

drop policy if exists "Brands update posts only in their Channel" on public.brand_channel_posts;
create policy "Verified Brands update only their Channel posts"
on public.brand_channel_posts for update to authenticated
using (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.brand_channels channel
    join public.brand_profiles brand on brand.id = channel.brand_id
    where channel.id = channel_id
      and brand.user_id = auth.uid()
      and brand.verification_status = 'verified'
      and brand.suspended_at is null
  )
)
with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.brand_channels channel
    join public.brand_profiles brand on brand.id = channel.brand_id
    where channel.id = channel_id
      and channel.status = 'active'
      and brand.user_id = auth.uid()
      and brand.verification_status = 'verified'
      and brand.suspended_at is null
  )
);

drop policy if exists "Brands delete posts only in their Channel" on public.brand_channel_posts;
create policy "Verified Brands delete only their Channel posts"
on public.brand_channel_posts for delete to authenticated
using (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.brand_channels channel
    join public.brand_profiles brand on brand.id = channel.brand_id
    where channel.id = channel_id
      and brand.user_id = auth.uid()
      and brand.verification_status = 'verified'
      and brand.suspended_at is null
  )
);

drop policy if exists "Brands create own sourced events" on public.campus_events;
create policy "Verified Brands create own sourced events"
on public.campus_events for insert to authenticated
with check (
  source_kind = 'brand'
  and author_user_id = auth.uid()
  and exists (
    select 1 from public.brand_profiles brand
    where brand.id = author_brand_id
      and brand.user_id = auth.uid()
      and brand.verification_status = 'verified'
      and brand.suspended_at is null
  )
);

drop policy if exists "Brands update only their events" on public.campus_events;
create policy "Verified Brands update only their events"
on public.campus_events for update to authenticated
using (
  source_kind = 'brand'
  and author_user_id = auth.uid()
  and exists (
    select 1 from public.brand_profiles brand
    where brand.id = author_brand_id
      and brand.user_id = auth.uid()
      and brand.verification_status = 'verified'
      and brand.suspended_at is null
  )
)
with check (
  source_kind = 'brand'
  and author_user_id = auth.uid()
  and exists (
    select 1 from public.brand_profiles brand
    where brand.id = author_brand_id
      and brand.user_id = auth.uid()
      and brand.verification_status = 'verified'
      and brand.suspended_at is null
  )
);

drop policy if exists "Brands delete only their events" on public.campus_events;
create policy "Verified Brands delete only their events"
on public.campus_events for delete to authenticated
using (
  source_kind = 'brand'
  and author_user_id = auth.uid()
  and exists (
    select 1 from public.brand_profiles brand
    where brand.id = author_brand_id
      and brand.user_id = auth.uid()
      and brand.verification_status = 'verified'
      and brand.suspended_at is null
  )
);

comment on table public.brand_channels is
  'Public Brand broadcast channels. Mailbox ownership alone is insufficient; an administrator must verify the Brand before channel privileges are available.';
