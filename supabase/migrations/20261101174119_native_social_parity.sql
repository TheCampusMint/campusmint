begin;
-- Add bounded, purpose-specific reads; never download an account's entire social graph.
-- Only the authenticated server supplies p_actor. No table or browser grants change.
create function public.read_social_details(p_actor uuid, p_resource text, p_target uuid default null, p_query text default '', p_after uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; actor_campus text;
begin
 select university_id into actor_campus from public.profile_identities where user_id=p_actor and verified_student and account_type='student';
 if actor_campus is null or not exists(select 1 from auth.users where id=p_actor) then raise exception 'Verified Student required' using errcode='42501'; end if;
 if length(coalesce(p_query,''))>80 then raise exception 'Invalid search' using errcode='22023'; end if;
 if p_resource='post' then
  if not public.can_read_social_content(p_target,p_actor) then raise exception 'Post unavailable' using errcode='42501'; end if;
  return jsonb_build_object('appreciated',exists(select 1 from public.content_private_appreciations where user_id=p_actor and content_id=p_target),
   'endorsed',exists(select 1 from public.content_public_endorsements where user_id=p_actor and content_id=p_target),
   'saved',exists(select 1 from public.mint_pins where user_id=p_actor and content_id=p_target),
   'commentsEnabled',(select comments_enabled from public.social_content where id=p_target),
   'commentCount',(select count(*) from public.content_comments c where c.content_id=p_target and c.status='active' and not exists(select 1 from public.profile_blocks b where (b.blocker_id=p_actor and b.blocked_id=c.author_id) or (b.blocker_id=c.author_id and b.blocked_id=p_actor))));
 elsif p_resource='note' then
  return jsonb_build_object('note',(select jsonb_build_object('body',body,'website',website_url,'expiresAt',expires_at) from public.profile_notes where user_id=p_actor and expires_at>now()));
 elsif p_resource='attendance' then
  if not exists(select 1 from public.campus_events where id=p_target and campus_id=actor_campus and status in ('scheduled','updated')) then raise exception 'Event unavailable' using errcode='42501'; end if;
  return jsonb_build_object('attending',exists(select 1 from public.event_attendance where user_id=p_actor and event_id=p_target));
 elsif p_resource='saved' then
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from (
   select content_id as id from public.mint_pins where user_id=p_actor and (p_after is null or content_id>p_after)
    and public.can_read_social_content(content_id,p_actor) order by content_id limit 50
  )s;
 elsif p_resource in ('people','profile','following','blocked') then
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from (
   select p.user_id as id,p.username,p.display_name as name,i.university_id as campus,
    case when p_resource<>'blocked' and (p.user_id=p_actor or (p.social_account_type='public' and coalesce(v.bio,'everyone') in ('everyone','students_only')) or
     (coalesce(v.bio,'everyone')<>'private' and exists(select 1 from public.friendships where status='friends' and least(requester_id,addressee_id)=least(p_actor,p.user_id) and greatest(requester_id,addressee_id)=greatest(p_actor,p.user_id))) ) then p.bio else null end as bio,
    case when p_resource<>'blocked' and (p.user_id=p_actor or (p.social_account_type='public' and coalesce(v.major,'students_only') in ('everyone','students_only')) or
     (coalesce(v.major,'students_only')<>'private' and exists(select 1 from public.friendships where status='friends' and least(requester_id,addressee_id)=least(p_actor,p.user_id) and greatest(requester_id,addressee_id)=greatest(p_actor,p.user_id))) ) then p.major else null end as major,
    exists(select 1 from public.profile_follows where follower_id=p_actor and following_id=p.user_id) as following,
    public.social_pair_allowed(p_actor,p.user_id) as "canMessage",
    (p.social_account_type='public' and public.social_pair_allowed(p_actor,p.user_id)) as "canFollow"
   from public.profiles p join public.profile_identities i on i.user_id=p.user_id left join public.profile_privacy_settings v on v.user_id=p.user_id
   where i.verified_student and i.account_type='student'
    and (p_resource='blocked' or p.user_id=p_actor or i.university_id=actor_campus or exists(select 1 from public.friendships where status='friends' and least(requester_id,addressee_id)=least(p_actor,p.user_id) and greatest(requester_id,addressee_id)=greatest(p_actor,p.user_id)))
    and (p_resource='blocked' or not exists(select 1 from public.profile_blocks where (blocker_id=p_actor and blocked_id=p.user_id) or (blocker_id=p.user_id and blocked_id=p_actor)))
    and (p_resource<>'profile' or p.user_id=p_target)
    and (p_resource<>'following' or exists(select 1 from public.profile_follows where follower_id=p_actor and following_id=p.user_id))
    and (p_resource<>'blocked' or exists(select 1 from public.profile_blocks where blocker_id=p_actor and blocked_id=p.user_id))
    and (p_resource='profile' or p.user_id<>p_actor)
    and (p_after is null or p.user_id>p_after)
    -- Literal substring search, not user-controlled LIKE wildcards or SQL.
    and (coalesce(btrim(p_query),'')='' or strpos(lower(p.username),lower(btrim(p_query)))>0 or strpos(lower(p.display_name),lower(btrim(p_query)))>0)
   order by p.user_id limit 50
  )s;
  if p_resource='profile' and jsonb_array_length(result)=0 then raise exception 'Profile unavailable' using errcode='42501'; end if;
 else raise exception 'Unknown resource' using errcode='22023'; end if;
 return jsonb_build_object('items',result,'hasMore',jsonb_array_length(result)=50);
end $$;
revoke all on function public.read_social_details(uuid,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.read_social_details(uuid,text,uuid,text,uuid) to service_role;

create function public.update_profile_privacy(p_actor uuid,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare field text; value text; column_name text;
begin
 if not exists(select 1 from public.profile_identities where user_id=p_actor and verified_student and account_type='student') or not exists(select 1 from auth.users where id=p_actor) then raise exception 'Verified Student required' using errcode='42501';end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then raise exception 'Invalid privacy update' using errcode='22023'; end if;
 perform 1 from public.profiles where user_id=p_actor for update;
 insert into public.profile_privacy_settings(user_id) values(p_actor) on conflict do nothing;
 for field,value in select entry.key,entry.value #>> '{}' from jsonb_each(p_patch) entry loop
  if field='accountType' then
   if value not in ('public','private') or value is null then raise exception 'Invalid account privacy' using errcode='22023';end if;
   update public.profiles set social_account_type=value::public.social_account_type where user_id=p_actor;
  else
   if field not in ('bio','major','graduationYear','classes','clubs','interests','hometown','instagram','linkedin','portfolioUrl','personalWebsite') or value not in ('everyone','students_only','friends_only','private') or value is null then raise exception 'Invalid field privacy' using errcode='22023';end if;
   column_name:=case field when 'graduationYear' then 'graduation_year' when 'portfolioUrl' then 'portfolio_url' when 'personalWebsite' then 'personal_website' else field end;
   execute format('update public.profile_privacy_settings set %I=$1::public.profile_visibility where user_id=$2',column_name) using value,p_actor;
  end if;
 end loop;
 perform public.signal_social_change(p_actor);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.update_profile_privacy(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.update_profile_privacy(uuid,jsonb) to service_role;
create index if not exists mint_pins_owner_page_idx on public.mint_pins(user_id,content_id);
commit;
