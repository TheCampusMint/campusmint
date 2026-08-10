-- Unified social/organization preparation. Mint vs Story remains the publish
-- format (`social_content.kind`). Personal vs Event vs Club remains the content
-- kind (`social_content.post_type`). Canonical Event and Organization rows are
-- referenced; their data is never copied into social content.

alter type public.social_post_type add value if not exists 'club';
alter type public.organization_membership_status add value if not exists 'leader';

create type public.organization_content_audience as enum ('public', 'members');
create type public.organization_role_kind as enum ('member', 'officer', 'leader', 'social_media_manager');
create type public.organization_membership_request_status as enum ('pending', 'accepted', 'rejected', 'blocked');
create type public.conversation_kind as enum ('organization_group', 'organization_contact');

alter table public.social_content
  add column organization_audience public.organization_content_audience not null default 'public';

alter table public.social_content
  drop constraint if exists social_content_check;

alter table public.social_content
  add constraint social_content_event_expiration_check check (
    post_type::text <> 'event'
    or (expires_at is not null and expires_at <= created_at + interval '24 hours')
  ),
  add constraint social_content_club_reference_check check (
    post_type::text <> 'club' or organization_id is not null
  );

create table public.content_tagged_organizations (
  content_id uuid not null references public.social_content(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_id, organization_id)
);

create table public.organization_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role_kind not null,
  can_publish boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, role)
);

create table public.organization_membership_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_university_id text not null references public.universities(id) on delete restrict,
  status public.organization_membership_request_status not null default 'pending',
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  check ((status = 'pending' and decided_at is null) or status <> 'pending')
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index conversations_one_organization_group_idx
  on public.conversations (organization_id)
  where kind = 'organization_group';

alter table public.organizations
  add column organization_conversation_id uuid references public.conversations(id) on delete set null,
  add column leader_user_id uuid references auth.users(id) on delete set null;

create table public.organization_membership_contacts (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (conversation_id, user_id)
);

create index organization_membership_requests_pending_idx
  on public.organization_membership_requests (organization_id, created_at)
  where status = 'pending';
create index organization_roles_user_idx
  on public.organization_roles (user_id, organization_id);
create index conversation_participants_user_idx
  on public.conversation_participants (user_id, conversation_id)
  where removed_at is null;

create trigger organization_roles_set_updated_at before update on public.organization_roles
for each row execute function public.set_updated_at();
create trigger organization_membership_requests_set_updated_at before update on public.organization_membership_requests
for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

create function public.can_access_organization_chat(target_organization_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = target_user_id
      and membership.status::text in ('member', 'officer', 'leader')
  );
$$;

create function public.accept_organization_membership_request(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  membership_request public.organization_membership_requests%rowtype;
  group_conversation_id uuid;
begin
  select * into membership_request
  from public.organization_membership_requests
  where id = target_request_id and status = 'pending'
  for update;

  if membership_request.id is null then
    raise exception 'Pending organization membership request not found';
  end if;

  if not exists (
    select 1 from public.organization_roles role
    where role.organization_id = membership_request.organization_id
      and role.user_id = auth.uid()
      and role.role in ('officer', 'leader')
  ) then
    raise exception 'Not authorized to accept this organization membership request';
  end if;

  update public.organization_membership_requests
  set status = 'accepted', decided_by = auth.uid(), decided_at = now(), updated_at = now()
  where id = membership_request.id;

  insert into public.organization_memberships (
    organization_id, user_id, university_id, status, requested_at, joined_at
  ) values (
    membership_request.organization_id, membership_request.user_id,
    membership_request.user_university_id, 'member', membership_request.created_at, now()
  )
  on conflict (organization_id, user_id) do update
  set status = 'member', joined_at = now(), updated_at = now();

  select organization_conversation_id into group_conversation_id
  from public.organizations where id = membership_request.organization_id;

  if group_conversation_id is not null then
    insert into public.conversation_participants (conversation_id, user_id, added_at, removed_at)
    values (group_conversation_id, membership_request.user_id, now(), null)
    on conflict (conversation_id, user_id) do update
    set removed_at = null, added_at = now();
  end if;
end;
$$;

create function public.reject_organization_membership_request(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  membership_request public.organization_membership_requests%rowtype;
begin
  select * into membership_request
  from public.organization_membership_requests
  where id = target_request_id and status = 'pending'
  for update;

  if membership_request.id is null or not exists (
    select 1 from public.organization_roles role
    where role.organization_id = membership_request.organization_id
      and role.user_id = auth.uid()
      and role.role in ('officer', 'leader')
  ) then
    raise exception 'Not authorized to reject this organization membership request';
  end if;

  update public.organization_membership_requests
  set status = 'rejected', decided_by = auth.uid(), decided_at = now(), updated_at = now()
  where id = membership_request.id;
end;
$$;

create function public.remove_organization_membership(target_organization_id uuid, target_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  group_conversation_id uuid;
begin
  if target_user_id <> auth.uid() and not exists (
    select 1 from public.organization_roles role
    where role.organization_id = target_organization_id
      and role.user_id = auth.uid()
      and role.role in ('officer', 'leader')
  ) then
    raise exception 'Not authorized to remove this organization membership';
  end if;

  delete from public.organization_memberships
  where organization_id = target_organization_id and user_id = target_user_id;

  select organization_conversation_id into group_conversation_id
  from public.organizations where id = target_organization_id;

  if group_conversation_id is not null then
    update public.conversation_participants
    set removed_at = now()
    where conversation_id = group_conversation_id
      and user_id = target_user_id
      and removed_at is null;
  end if;
end;
$$;

alter table public.content_tagged_organizations enable row level security;
alter table public.organization_roles enable row level security;
alter table public.organization_membership_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.organization_membership_contacts enable row level security;
alter table public.conversation_participants enable row level security;

create policy "Users can read their own organization requests"
on public.organization_membership_requests for select to authenticated
using (user_id = auth.uid() or exists (
  select 1 from public.organization_roles role
  where role.organization_id = organization_id
    and role.user_id = auth.uid()
    and role.role in ('officer', 'leader')
));

create policy "Authorized users can read organization conversations"
on public.conversations for select to authenticated
using (
  (kind = 'organization_group' and public.can_access_organization_chat(organization_id, auth.uid()))
  or exists (
    select 1 from public.conversation_participants participant
    where participant.conversation_id = id
      and participant.user_id = auth.uid()
      and participant.removed_at is null
  )
);

create policy "Users can read allowed conversation participants"
on public.conversation_participants for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.conversations conversation
    where conversation.id = conversation_id
      and conversation.kind = 'organization_group'
      and public.can_access_organization_chat(conversation.organization_id, auth.uid())
  )
);

revoke all on function public.can_access_organization_chat(uuid, uuid) from public, anon;
grant execute on function public.can_access_organization_chat(uuid, uuid) to authenticated, service_role;
revoke all on function public.accept_organization_membership_request(uuid) from public, anon;
grant execute on function public.accept_organization_membership_request(uuid) to authenticated, service_role;
revoke all on function public.reject_organization_membership_request(uuid) from public, anon;
grant execute on function public.reject_organization_membership_request(uuid) to authenticated, service_role;
revoke all on function public.remove_organization_membership(uuid, uuid) from public, anon;
grant execute on function public.remove_organization_membership(uuid, uuid) to authenticated, service_role;

comment on column public.social_content.kind is 'Publish format: Mint or Story.';
comment on column public.social_content.post_type is 'Content kind: Personal, Event, or Club.';
comment on column public.social_content.organization_id is 'Official publishing identity for Club content; canonical Organization remains the source of truth.';
comment on table public.content_tagged_organizations is 'Personal/Event content may tag a Club without publishing as that Club.';
comment on table public.organization_membership_requests is 'Pending/decided join requests, separate from accepted organization memberships.';
comment on function public.accept_organization_membership_request(uuid) is 'Atomic future server workflow: accept membership and add the member to the official organization group conversation.';
comment on function public.remove_organization_membership(uuid, uuid) is 'Atomic future server workflow: remove membership and revoke the official organization group conversation participant.';
comment on column public.organizations.member_count is 'Non-authoritative legacy cache. Product counts must be derived from accepted membership rows.';
