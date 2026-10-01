begin;
alter table public.organizations add column user_created boolean not null default false,
  add column visibility text not null default 'public' check (visibility in ('public','private'));
create table public.club_invitations (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  primary key(organization_id,user_id)
);
alter table public.club_invitations enable row level security;
revoke all on public.club_invitations from public,anon,authenticated,service_role;
grant select on public.club_invitations to service_role;
-- No browser can enumerate private page details, even if a legacy permissive policy exists.
create policy "Private club details are server scoped" on public.organizations as restrictive for select to anon,authenticated
  using (visibility='public');

create function public.mutate_club(p_actor uuid,p_action text,p_club uuid default null,p_target uuid default null,p_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare campus text; club public.organizations%rowtype; actor_role text; target_role text; target_id uuid;
  new_id uuid; club_name text; club_handle text; description text;
begin
  select university_id into campus from public.profile_identities where user_id=p_actor and verified_student and account_type='student';
  if campus is null or not exists(select 1 from auth.users where id=p_actor) then raise exception 'Verified Student required' using errcode='42501'; end if;
  if p_action='create' then
    -- Serialize creator limits across concurrent requests.
    perform 1 from public.profile_identities where user_id=p_actor for update;
    if (select count(*) from public.organizations where leader_user_id=p_actor and user_created and status='active')>=10 then raise exception 'Club limit reached' using errcode='22023'; end if;
    club_name:=btrim(p_data->>'name'); club_handle:=p_data->>'handle'; description:=btrim(p_data->>'description');
    if coalesce(length(club_name),0) not between 2 and 160 or coalesce(length(description),0) not between 2 and 5000
      or club_handle is null or club_handle !~ '^[a-z0-9][a-z0-9-]{2,63}$' then raise exception 'Invalid club details' using errcode='22023'; end if;
    new_id:=gen_random_uuid();
    insert into public.organizations(id,university_id,external_id,name,handle,short_description,full_description,category,contact_email,
      meeting_location,meeting_schedule,source_type,leader_user_id,membership_type,user_created,visibility)
    values(new_id,campus,new_id::text,club_name,club_handle,left(description,500),description,'Other','','','','community_submission',p_actor,'application',true,'private');
    insert into public.organization_memberships(organization_id,user_id,university_id,status,joined_at) values(new_id,p_actor,campus,'leader',now());
    insert into public.organization_roles(organization_id,user_id,role,can_publish) values(new_id,p_actor,'leader',true);
    update public.organizations set member_count=1 where id=new_id;
    return new_id;
  end if;
  select * into club from public.organizations where id=p_club and status='active' and user_created for update;
  if not found or club.university_id<>campus then raise exception 'Club unavailable' using errcode='42501'; end if;
  select status::text into actor_role from public.organization_memberships where organization_id=p_club and user_id=p_actor;
  if club.leader_user_id=p_actor then actor_role:='leader'; end if;
  target_id:=coalesce(p_target,p_actor);
  if p_action not in ('remove','reject','demote','leave','cancel') and not exists(select 1 from public.profile_identities where user_id=target_id and university_id=campus and verified_student and account_type='student') then raise exception 'Student unavailable' using errcode='42501'; end if;
  if p_action not in ('remove','reject','demote','leave','cancel') and exists(select 1 from public.profile_blocks where (blocker_id=p_actor and blocked_id=target_id) or (blocked_id=p_actor and blocker_id=target_id)
    or (blocker_id=club.leader_user_id and blocked_id=target_id) or (blocked_id=club.leader_user_id and blocker_id=target_id)) then raise exception 'Student unavailable' using errcode='42501'; end if;
  select status::text into target_role from public.organization_memberships where organization_id=p_club and user_id=target_id;
  if p_action='request' then
    if target_id<>p_actor then raise exception 'Own request only' using errcode='42501'; end if;
    if actor_role in ('member','officer','leader') then return p_club; end if;
    insert into public.organization_memberships(organization_id,user_id,university_id,status,requested_at) values(p_club,p_actor,campus,'requested',now())
      on conflict(organization_id,user_id) do update set status='requested',requested_at=now();
    insert into public.organization_membership_requests(organization_id,user_id,user_university_id) values(p_club,p_actor,campus)
      on conflict(organization_id,user_id) do update set status='pending',decided_at=null,decided_by=null;
  elsif p_action in ('cancel','leave') then
    if target_id<>p_actor or club.leader_user_id=p_actor then raise exception 'Owner cannot leave' using errcode='42501'; end if;
    update public.conversation_participants set removed_at=now() where user_id=p_actor and conversation_id in (select id from public.conversations where organization_id=p_club and kind='organization_group');
    delete from public.organization_roles where organization_id=p_club and user_id=p_actor;
    delete from public.organization_memberships where organization_id=p_club and user_id=p_actor;
    delete from public.organization_membership_requests where organization_id=p_club and user_id=p_actor;
  elsif p_action in ('accept_invite','decline_invite') then
    if target_id<>p_actor or not exists(select 1 from public.club_invitations where organization_id=p_club and user_id=p_actor and status='pending') then raise exception 'Invitation unavailable' using errcode='42501'; end if;
    update public.club_invitations set status=case when p_action='accept_invite' then 'accepted' else 'declined' end where organization_id=p_club and user_id=p_actor;
    if p_action='accept_invite' and coalesce(actor_role,'') not in ('member','officer','leader') then
      insert into public.organization_memberships(organization_id,user_id,university_id,status,joined_at) values(p_club,p_actor,campus,'member',now())
        on conflict(organization_id,user_id) do update set status='member',joined_at=now();
      insert into public.organization_roles(organization_id,user_id,role,can_publish) values(p_club,p_actor,'member',false) on conflict do nothing;
      update public.organization_membership_requests set status='accepted',decided_at=now(),decided_by=p_actor where organization_id=p_club and user_id=p_actor;
    end if;
  else
    if coalesce(actor_role,'') not in ('leader','officer') then raise exception 'Club administrator required' using errcode='42501'; end if;
    if p_action='update' then
      club_name:=btrim(p_data->>'name'); description:=btrim(p_data->>'description');
      if coalesce(length(club_name),0) not between 2 and 160 or coalesce(length(description),0) not between 2 and 5000
        or coalesce(p_data->>'visibility','') not in ('private','public') then raise exception 'Invalid club details' using errcode='22023'; end if;
      if p_data->>'visibility'<>club.visibility and actor_role<>'leader' then raise exception 'Owner sets visibility' using errcode='42501'; end if;
      update public.organizations set name=club_name,full_description=description,short_description=left(description,500),visibility=p_data->>'visibility',
        meeting_location=left(coalesce(p_data->>'location',''),200),meeting_schedule=left(coalesce(p_data->>'schedule',''),200),
        website=nullif(p_data->>'website',''),photo_url=nullif(p_data->>'photo',''),keywords=array(select jsonb_array_elements_text(coalesce(p_data->'tags','[]'::jsonb))) where id=p_club;
    elsif p_action='invite' then
      if target_id=p_actor or target_role in ('member','officer','leader') then return p_club; end if;
      insert into public.club_invitations(organization_id,user_id,invited_by) values(p_club,target_id,p_actor)
        on conflict(organization_id,user_id) do update set invited_by=p_actor,status='pending',created_at=now();
    elsif p_action in ('approve','reject','remove','promote','demote') then
      if target_id=club.leader_user_id or target_id=p_actor then raise exception 'Owner protected' using errcode='42501'; end if;
      if (p_action in ('promote','demote') or target_role='officer') and actor_role<>'leader' then raise exception 'Owner required' using errcode='42501'; end if;
      if p_action in ('approve','reject') and target_role is distinct from 'requested' then raise exception 'Request unavailable' using errcode='22023'; end if;
      if p_action in ('promote','demote') and coalesce(target_role,'') not in ('member','officer') then raise exception 'Member required' using errcode='22023'; end if;
      delete from public.organization_roles where organization_id=p_club and user_id=target_id;
      if p_action in ('reject','remove') then
        update public.conversation_participants set removed_at=now() where user_id=target_id and conversation_id in (select id from public.conversations where organization_id=p_club and kind='organization_group');
        delete from public.organization_memberships where organization_id=p_club and user_id=target_id;
        update public.club_invitations set status='declined' where organization_id=p_club and user_id=target_id;
      else
        update public.organization_memberships set status=case when p_action='promote' then 'officer'::public.organization_membership_status else 'member'::public.organization_membership_status end,joined_at=coalesce(joined_at,now()) where organization_id=p_club and user_id=target_id;
        insert into public.organization_roles(organization_id,user_id,role,can_publish) values(p_club,target_id,case when p_action='promote' then 'officer'::public.organization_role_kind else 'member'::public.organization_role_kind end,p_action='promote');
      end if;
      update public.organization_membership_requests set status=case when p_action in ('approve','promote','demote') then 'accepted'::public.organization_membership_request_status else 'rejected'::public.organization_membership_request_status end,decided_at=now(),decided_by=p_actor where organization_id=p_club and user_id=target_id;
    else raise exception 'Unknown club action' using errcode='22023'; end if;
  end if;
  update public.organizations set member_count=(select count(*) from public.organization_memberships where organization_id=p_club and status in ('member','officer','leader')) where id=p_club;
  return p_club;
end $$;
revoke all on function public.mutate_club(uuid,text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.mutate_club(uuid,text,uuid,uuid,jsonb) to service_role;
commit;
