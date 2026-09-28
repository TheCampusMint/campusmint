-- Single-choice Mint polls. Definitions live with the post; votes remain private.
create function public.valid_mint_poll_definition(definition jsonb)
returns boolean language plpgsql immutable set search_path = public, pg_temp as $$
declare
  option_value jsonb;
  option_ids text[] := '{}';
  option_labels text[] := '{}';
begin
  if definition is null then return true; end if;
  if jsonb_typeof(definition) <> 'object'
    or jsonb_typeof(definition->'question') is distinct from 'string'
    or char_length(btrim(definition->>'question')) not between 1 and 280
    or jsonb_typeof(definition->'options') is distinct from 'array' then return false; end if;
  if jsonb_array_length(definition->'options') not between 2 and 6 then return false; end if;
  for option_value in select value from jsonb_array_elements(definition->'options') loop
    if jsonb_typeof(option_value) <> 'object'
      or jsonb_typeof(option_value->'id') is distinct from 'string'
      or (option_value->>'id') !~ '^[1-6]$'
      or jsonb_typeof(option_value->'label') is distinct from 'string'
      or char_length(btrim(option_value->>'label')) not between 1 and 100
      or (option_value->>'id') = any(option_ids)
      or lower(btrim(option_value->>'label')) = any(option_labels) then return false; end if;
    option_ids := array_append(option_ids, option_value->>'id');
    option_labels := array_append(option_labels, lower(btrim(option_value->>'label')));
  end loop;
  return true;
end;
$$;

alter table public.social_content add column poll_definition jsonb
  check (public.valid_mint_poll_definition(poll_definition));
alter table public.social_content add constraint mint_poll_format_check
  check (poll_definition is null or kind = 'mint');

create table public.mint_poll_votes (
  content_id uuid not null references public.social_content(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  option_id text not null check (option_id ~ '^[1-6]$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (content_id, user_id)
);
alter table public.mint_poll_votes enable row level security;
revoke all on public.mint_poll_votes from anon, authenticated;
grant select, insert, update, delete on public.mint_poll_votes to service_role;
-- No client policies, subscriptions, or reads expose the voter list.

create function public.prevent_mint_poll_definition_edit()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.poll_definition is distinct from old.poll_definition then
    raise exception 'Published poll answers cannot be changed.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger mint_poll_definition_immutable before update of poll_definition on public.social_content
  for each row execute function public.prevent_mint_poll_definition_edit();

-- Mirrors the authenticated Mint feed: expiry, archive, both block directions,
-- private author profiles, organization audience, post privacy, connections and campus identity.
create function public.can_read_mint_poll(target_content_id uuid, viewer_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.social_content content
    join public.mints mint on mint.content_id = content.id
    join public.profile_identities viewer on viewer.user_id = viewer_id
    join public.profiles author_profile on author_profile.user_id = content.author_id
    where content.id = target_content_id and content.kind = 'mint'
      and content.poll_definition is not null
      and content.status = 'active' and mint.archived_at is null
      and (content.expires_at is null or content.expires_at > now())
      and not exists (
        select 1 from public.profile_blocks blocked
        where (blocked.blocker_id = viewer_id and blocked.blocked_id = content.author_id)
           or (blocked.blocker_id = content.author_id and blocked.blocked_id = viewer_id)
      )
      and (content.author_id = viewer_id or (
        (author_profile.social_account_type = 'public' or (
          exists (select 1 from public.profile_follows follow where
            (follow.follower_id = viewer_id and follow.following_id = content.author_id)
            or (follow.following_id = viewer_id and follow.follower_id = content.author_id))
          or exists (select 1 from public.friendships friendship where friendship.status = 'friends' and (
            (friendship.requester_id = viewer_id and friendship.addressee_id = content.author_id)
            or (friendship.addressee_id = viewer_id and friendship.requester_id = content.author_id)))
        )) and
        (content.organization_audience <> 'members' or content.organization_id is null or exists (
          select 1 from public.organization_memberships membership
          where membership.organization_id = content.organization_id and membership.user_id = viewer_id
            and membership.status in ('member', 'leader')
        )) and (
          mint.privacy = 'public'
          or (mint.privacy = 'account' and content.university_id = viewer.university_id)
          or (mint.privacy = 'connections' and (
            exists (select 1 from public.profile_follows follow where
              (follow.follower_id = viewer_id and follow.following_id = content.author_id)
              or (follow.following_id = viewer_id and follow.follower_id = content.author_id))
            or exists (select 1 from public.friendships friendship where friendship.status = 'friends' and (
              (friendship.requester_id = viewer_id and friendship.addressee_id = content.author_id)
              or (friendship.addressee_id = viewer_id and friendship.requester_id = content.author_id)))
          ))
        )
      ))
  );
$$;

create function public.read_mint_poll(target_content_id uuid, viewer_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  result jsonb;
begin
  if not public.can_read_mint_poll(target_content_id, viewer_id) then
    raise exception 'Poll unavailable.' using errcode = 'P0002';
  end if;
  -- One statement gives all option counts, the total and own choice the same snapshot.
  select jsonb_build_object(
    'question', content.poll_definition->>'question',
    'options', (select jsonb_agg(jsonb_build_object(
      'id', option_value->>'id', 'label', option_value->>'label',
      'voteCount', (select count(*) from public.mint_poll_votes vote where vote.content_id = target_content_id and vote.option_id = option_value->>'id')) order by position)
      from jsonb_array_elements(content.poll_definition->'options') with ordinality as options(option_value, position)),
    'totalVotes', (select count(*) from public.mint_poll_votes where content_id = target_content_id),
    'selectedOptionId', (select option_id from public.mint_poll_votes where content_id = target_content_id and user_id = viewer_id)
  ) into result from public.social_content content where content.id = target_content_id;
  return result;
end;
$$;

create function public.vote_mint_poll(target_content_id uuid, viewer_id uuid, selected_option_id text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare definition jsonb;
begin
  -- Serialize votes for this one poll so a returned tally always includes this
  -- transaction's one current choice, even during simultaneous changes/retries.
  select poll_definition into definition from public.social_content where id = target_content_id for update;
  if not public.can_read_mint_poll(target_content_id, viewer_id) then
    raise exception 'Poll unavailable.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profile_identities identity where identity.user_id = viewer_id and
    ((identity.account_type = 'student' and identity.verified_student and identity.university_id is not null)
      or exists (select 1 from public.account_capabilities capability where capability.user_id = viewer_id and capability.capability = 'creator' and capability.revoked_at is null))) then
    raise exception 'A verified Student or approved Creator profile is required to vote.' using errcode = '42501';
  end if;
  if selected_option_id is null or not exists (
    select 1 from jsonb_array_elements(definition->'options') option_value where option_value->>'id' = selected_option_id
  ) then raise exception 'Choose an available poll answer.' using errcode = '22023'; end if;
  insert into public.mint_poll_votes (content_id, user_id, option_id)
    values (target_content_id, viewer_id, selected_option_id)
    on conflict (content_id, user_id) do update set option_id = excluded.option_id, updated_at = now();
  return public.read_mint_poll(target_content_id, viewer_id);
end;
$$;

revoke all on function public.valid_mint_poll_definition(jsonb) from public, anon, authenticated;
revoke all on function public.prevent_mint_poll_definition_edit() from public, anon, authenticated;
revoke all on function public.can_read_mint_poll(uuid, uuid) from public, anon, authenticated;
revoke all on function public.read_mint_poll(uuid, uuid) from public, anon, authenticated;
revoke all on function public.vote_mint_poll(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.valid_mint_poll_definition(jsonb) to service_role;
grant execute on function public.can_read_mint_poll(uuid, uuid) to service_role;
grant execute on function public.read_mint_poll(uuid, uuid) to service_role;
grant execute on function public.vote_mint_poll(uuid, uuid, text) to service_role;

comment on table public.mint_poll_votes is 'Private current single-choice votes. Server RPCs return aggregate counts and only the authenticated viewer own selection.';
notify pgrst, 'reload schema';
