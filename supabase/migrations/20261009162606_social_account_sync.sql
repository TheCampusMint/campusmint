begin;
-- Only an account-owned revision is visible through Realtime. Message bodies,
-- private post IDs, participants and notification text remain server-only.
create table public.social_sync_revisions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.social_sync_revisions enable row level security;
revoke all on public.social_sync_revisions from public,anon,authenticated,service_role;
grant select on public.social_sync_revisions to authenticated,service_role;
create policy "Own social revision only" on public.social_sync_revisions for select to authenticated using(user_id=(select auth.uid()));
alter publication supabase_realtime add table public.social_sync_revisions;

alter table public.direct_messages add column reply_to_message_id uuid references public.direct_messages(id) on delete set null;
create index direct_messages_page_idx on public.direct_messages(conversation_id,created_at desc,id desc);
create index content_comments_page_idx on public.content_comments(content_id,created_at desc,id desc) where status='active';
create index notifications_recipient_page_idx on public.notifications(recipient_id,created_at desc,id desc);

create function public.signal_social_change(p_user uuid) returns void language sql security definer set search_path='' as $$
 insert into public.social_sync_revisions(user_id) values(p_user) on conflict(user_id) do update set revision=public.social_sync_revisions.revision+1,updated_at=now();
$$;
revoke all on function public.signal_social_change(uuid) from public,anon,authenticated,service_role;

create function public.social_pair_allowed(p_actor uuid,p_peer uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_actor<>p_peer and exists(
  select 1 from public.profile_identities a join public.profile_identities b on b.user_id=p_peer
  join public.profiles p on p.user_id=b.user_id
  where a.user_id=p_actor and a.verified_student and b.verified_student
   and a.account_type='student' and b.account_type='student'
   and not exists(select 1 from public.profile_blocks where (blocker_id=p_actor and blocked_id=p_peer) or (blocker_id=p_peer and blocked_id=p_actor))
   and ((a.university_id=b.university_id and (p.social_account_type='public' or exists(select 1 from public.direct_conversations c join public.direct_messages m on m.conversation_id=c.id where c.user_a=least(p_actor,p_peer) and c.user_b=greatest(p_actor,p_peer) and m.sender_id=p_peer))) or exists(select 1 from public.friendships where status='friends' and least(requester_id,addressee_id)=least(p_actor,p_peer) and greatest(requester_id,addressee_id)=greatest(p_actor,p_peer)))
 );
$$;
revoke all on function public.social_pair_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.social_pair_allowed(uuid,uuid) to service_role;

-- CAN_READ_CONTENT is inserted here from the audited Mint privacy predicate.
create function public.can_read_social_content(target_content_id uuid, viewer_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.social_content content
    join public.mints mint on mint.content_id = content.id
    join public.profile_identities viewer on viewer.user_id = viewer_id
    join public.profiles author_profile on author_profile.user_id = content.author_id
    where content.id = target_content_id and content.kind = 'mint'
      and content.status = 'active' and mint.archived_at is null
      and (content.expires_at is null or content.expires_at > now())
      and not exists (
        select 1 from public.profile_blocks blocked
        where (blocked.blocker_id = viewer_id and blocked.blocked_id = content.author_id)
           or (blocked.blocker_id = content.author_id and blocked.blocked_id = viewer_id)
      )
      and (content.author_id = viewer_id or (
        (author_profile.social_account_type = 'public' or (
          exists (select 1 from public.friendships friendship where friendship.status = 'friends' and (
            (friendship.requester_id = viewer_id and friendship.addressee_id = content.author_id)
            or (friendship.addressee_id = viewer_id and friendship.requester_id = content.author_id)))
        )) and
        (content.organization_audience <> 'members' or content.organization_id is null or exists (
          select 1 from public.organization_memberships membership
          where membership.organization_id = content.organization_id and membership.user_id = viewer_id
            and membership.status in ('member', 'officer', 'leader')
        )) and (
          mint.privacy = 'public'
          or (mint.privacy = 'account' and content.university_id = viewer.university_id)
          or (mint.privacy = 'connections' and (
            exists (select 1 from public.friendships friendship where friendship.status = 'friends' and (
              (friendship.requester_id = viewer_id and friendship.addressee_id = content.author_id)
              or (friendship.addressee_id = viewer_id and friendship.requester_id = content.author_id)))
          ))
        )
      ))
  );
$$;
revoke all on function public.can_read_social_content(uuid,uuid) from public,anon,authenticated;
grant execute on function public.can_read_social_content(uuid,uuid) to service_role;

create function public.mutate_social(p_actor uuid,p_action text,p_target uuid default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_campus text; peer uuid; content uuid; author uuid; parent uuid; item uuid; conversation uuid;
 body text; enabled boolean; current_message public.direct_messages%rowtype;
begin
 select university_id into actor_campus from public.profile_identities where user_id=p_actor and verified_student and account_type='student';
 if actor_campus is null or not exists(select 1 from auth.users where id=p_actor) then raise exception 'Verified Student required' using errcode='42501'; end if;
 -- Same actor's mutations serialize so retries and concurrent set operations converge.
 perform 1 from public.profile_identities where user_id=p_actor for update;
 enabled:=coalesce((p_data->>'enabled')::boolean,true);
 if p_action in ('comment','appreciate','endorse','save','share','comment_like','delete_comment') then
  content:=p_target;
  if p_action in ('comment_like','delete_comment') then select content_id,author_id into content,author from public.content_comments where id=p_target and status='active'; end if;
  if not public.can_read_social_content(content,p_actor) then raise exception 'Post unavailable' using errcode='42501'; end if;
  if p_action='comment' then
   if not exists(select 1 from public.social_content where id=content and comments_enabled) then raise exception 'Comments closed' using errcode='42501'; end if;
   body:=btrim(p_data->>'body');item:=(p_data->>'requestId')::uuid;parent:=(p_data->>'parentId')::uuid;
   if coalesce(length(body),0) not between 1 and 5000 or item is null then raise exception 'Invalid comment' using errcode='22023'; end if;
   if parent is not null and not exists(select 1 from public.content_comments where id=parent and content_id=content and status='active' and not exists(select 1 from public.profile_blocks where (blocker_id=p_actor and blocked_id=author_id) or (blocker_id=author_id and blocked_id=p_actor))) then raise exception 'Reply unavailable' using errcode='42501'; end if;
   if exists(select 1 from public.content_comments cc where cc.id=item and (cc.author_id<>p_actor or cc.content_id<>content or cc.body<>btrim(p_data->>'body') or cc.parent_comment_id is distinct from parent)) then raise exception 'Request conflict' using errcode='23505'; end if;
   insert into public.content_comments(id,content_id,author_id,parent_comment_id,body) values(item,content,p_actor,parent,body) on conflict(id) do nothing;
  elsif p_action='delete_comment' then
   if author<>p_actor then raise exception 'Own comment only' using errcode='42501'; end if;
   update public.content_comments set status='deleted',body='[deleted]' where id=p_target;
  elsif p_action='comment_like' then
   if exists(select 1 from public.profile_blocks where (blocker_id=p_actor and blocked_id=author) or (blocker_id=author and blocked_id=p_actor)) then raise exception 'Comment unavailable' using errcode='42501'; end if;
   if enabled then insert into public.content_comment_likes(comment_id,user_id) values(p_target,p_actor) on conflict do nothing;
   else delete from public.content_comment_likes where comment_id=p_target and user_id=p_actor;end if;
  elsif p_action='appreciate' then
   if enabled then insert into public.content_private_appreciations(content_id,user_id) values(content,p_actor) on conflict do nothing;
   else delete from public.content_private_appreciations where content_id=content and user_id=p_actor;end if;
  elsif p_action='endorse' then
   if enabled then insert into public.content_public_endorsements(content_id,user_id) values(content,p_actor) on conflict do nothing;
   else delete from public.content_public_endorsements where content_id=content and user_id=p_actor;end if;
  elsif p_action='save' then
   if enabled then insert into public.mint_pins(content_id,user_id) values(content,p_actor) on conflict do nothing;
   else delete from public.mint_pins where content_id=content and user_id=p_actor;end if;
  elsif p_action='share' then
   item:=(p_data->>'requestId')::uuid;
   if item is null or coalesce(p_data->>'channel','') not in ('copy_link','direct_message','external') then raise exception 'Invalid share' using errcode='22023';end if;
   if exists(select 1 from public.content_shares where id=item and (user_id<>p_actor or content_id<>content)) then raise exception 'Request conflict' using errcode='23505';end if;
   insert into public.content_shares(id,content_id,user_id,channel) values(item,content,p_actor,p_data->>'channel') on conflict(id) do nothing;
  end if;
  select author_id into peer from public.social_content where id=content;
 elsif p_action in ('message','message_seen','conversation_pin') then
  peer:=p_target;
  if not public.social_pair_allowed(p_actor,peer) then raise exception 'Conversation unavailable' using errcode='42501';end if;
  if p_action='message' then
   insert into public.direct_conversations(user_a,user_b) values(least(p_actor,peer),greatest(p_actor,peer)) on conflict(user_a,user_b) do nothing;
  end if;
  select id into conversation from public.direct_conversations where user_a=least(p_actor,peer) and user_b=greatest(p_actor,peer) for update;
  if conversation is null then raise exception 'Conversation unavailable' using errcode='42501';end if;
  if p_action='message' then
   body:=btrim(p_data->>'body');item:=(p_data->>'requestId')::uuid;parent:=(p_data->>'replyTo')::uuid;
   if coalesce(length(body),0) not between 1 and 5000 or item is null then raise exception 'Invalid message' using errcode='22023';end if;
   if parent is not null and not exists(select 1 from public.direct_messages where id=parent and conversation_id=conversation) then raise exception 'Reply unavailable' using errcode='42501';end if;
   select * into current_message from public.direct_messages where id=item;
   if found and (current_message.sender_id<>p_actor or current_message.conversation_id<>conversation or current_message.body<>body or current_message.reply_to_message_id is distinct from parent) then raise exception 'Request conflict' using errcode='23505';end if;
   if current_message.id is null then
    insert into public.direct_messages(id,conversation_id,sender_id,body,reply_to_message_id) values(item,conversation,p_actor,body,parent);
    insert into public.notifications(recipient_id,actor_id,kind,payload) values(peer,p_actor,'private_message',jsonb_build_object('conversationId',conversation));
   end if;
   update public.direct_conversations set updated_at=now() where id=conversation;
  elsif p_action='message_seen' then
   update public.direct_messages set seen_at=coalesce(seen_at,now()),delivered_at=coalesce(delivered_at,now()) where conversation_id=conversation and sender_id=peer and seen_at is null;
  elsif p_action='conversation_pin' then
   if enabled then insert into public.conversation_pins(conversation_id,user_id) values(conversation,p_actor) on conflict do nothing;
   else delete from public.conversation_pins where conversation_id=conversation and user_id=p_actor;end if;
  end if;
 elsif p_action in ('follow','block') then
  peer:=p_target;
  if peer=p_actor or not exists(select 1 from public.profiles where user_id=peer) then raise exception 'Account unavailable' using errcode='42501';end if;
  if p_action='block' then
   if enabled then
    insert into public.profile_blocks(blocker_id,blocked_id) values(p_actor,peer) on conflict do nothing;
    delete from public.profile_follows where (follower_id=p_actor and following_id=peer) or (follower_id=peer and following_id=p_actor);
    delete from public.friendships where least(requester_id,addressee_id)=least(p_actor,peer) and greatest(requester_id,addressee_id)=greatest(p_actor,peer);
   else delete from public.profile_blocks where blocker_id=p_actor and blocked_id=peer;end if;
  else
   if enabled then
    if not public.social_pair_allowed(p_actor,peer) or not exists(select 1 from public.profiles where user_id=peer and social_account_type='public') then raise exception 'Account unavailable' using errcode='42501';end if;
    insert into public.profile_follows(follower_id,following_id) values(p_actor,peer) on conflict do nothing;
   else delete from public.profile_follows where follower_id=p_actor and following_id=peer;end if;
  end if;
 elsif p_action='attendance' then
  if not exists(select 1 from public.campus_events where id=p_target and campus_id=actor_campus and status='scheduled') then raise exception 'Event unavailable' using errcode='42501';end if;
  if enabled then insert into public.event_attendance(event_id,user_id) values(p_target,p_actor) on conflict do nothing;
  else delete from public.event_attendance where event_id=p_target and user_id=p_actor;end if;
 elsif p_action='notification_read' then
  update public.notifications set read_at=coalesce(read_at,now()) where recipient_id=p_actor and (p_target is null or id=p_target) and read_at is null;
 elsif p_action='note' then
  body:=btrim(coalesce(p_data->>'body',''));
  if length(body)>150 or length(coalesce(p_data->>'website',''))>1000 or (nullif(p_data->>'website','') is not null and p_data->>'website' !~ '^https://[^[:space:]]+$') then raise exception 'Invalid note' using errcode='22023';end if;
  insert into public.profile_notes(user_id,body,website_url,expires_at,music) values(p_actor,nullif(body,''),nullif(p_data->>'website',''),now()+interval '24 hours',null)
    on conflict(user_id) do update set body=excluded.body,website_url=excluded.website_url,expires_at=excluded.expires_at,music=null,updated_at=now();
 else raise exception 'Unknown action' using errcode='22023';end if;
 perform public.signal_social_change(u) from (select distinct u from unnest(array[p_actor,peer])u where u is not null order by u) recipients;
 return jsonb_build_object('ok',true,'id',item,'conversationId',conversation);
end $$;
revoke all on function public.mutate_social(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.mutate_social(uuid,text,uuid,jsonb) to service_role;

create function public.read_social(p_actor uuid,p_resource text,p_target uuid default null,p_before timestamptz default null,p_before_id uuid default 'ffffffff-ffff-ffff-ffff-ffffffffffff')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; conversation uuid;
begin
 if not exists(select 1 from public.profile_identities where user_id=p_actor and verified_student and account_type='student') or not exists(select 1 from auth.users where id=p_actor) then raise exception 'Verified Student required' using errcode='42501';end if;
 if p_resource='comments' then
  if not public.can_read_social_content(p_target,p_actor) then raise exception 'Post unavailable' using errcode='42501';end if;
  select coalesce(jsonb_agg(to_jsonb(c)),'[]') into result from (
   select c.id,c.content_id,c.author_id,c.parent_comment_id,c.body,c.created_at,c.updated_at,p.username,p.display_name,
    (select count(*) from public.content_comment_likes l where l.comment_id=c.id) as like_count,
    exists(select 1 from public.content_comment_likes l where l.comment_id=c.id and l.user_id=p_actor) as liked
   from public.content_comments c join public.profiles p on p.user_id=c.author_id
   where c.content_id=p_target and c.status='active' and not exists(select 1 from public.profile_blocks where (blocker_id=p_actor and blocked_id=c.author_id) or (blocker_id=c.author_id and blocked_id=p_actor))
    and (p_before is null or (c.created_at,c.id)<(p_before,p_before_id)) order by c.created_at desc,c.id desc limit 50
  )c;
 elsif p_resource='messages' then
  if not public.social_pair_allowed(p_actor,p_target) then raise exception 'Conversation unavailable' using errcode='42501';end if;
  select id into conversation from public.direct_conversations where user_a=least(p_actor,p_target) and user_b=greatest(p_actor,p_target);
  select coalesce(jsonb_agg(to_jsonb(m)),'[]') into result from (select id,conversation_id,sender_id,body,reply_to_message_id,created_at,delivered_at,seen_at from public.direct_messages where conversation_id=conversation
   and (p_before is null or (created_at,id)<(p_before,p_before_id)) order by created_at desc,id desc limit 50)m;
 elsif p_resource='conversations' then
  select coalesce(jsonb_agg(to_jsonb(c)),'[]') into result from (
   select c.id,c.user_a,c.user_b,c.created_at,c.updated_at,p.username,p.display_name,
    (select to_jsonb(latest) from (select id,conversation_id,sender_id,body,created_at,delivered_at,seen_at,reply_to_message_id from public.direct_messages where conversation_id=c.id order by created_at desc,id desc limit 1) latest) as last_message,
    exists(select 1 from public.conversation_pins where conversation_id=c.id and user_id=p_actor) as pinned,
    (select count(*) from public.direct_messages where conversation_id=c.id and sender_id<>p_actor and seen_at is null) as unread
   from public.direct_conversations c join public.profiles p on p.user_id=case when c.user_a=p_actor then c.user_b else c.user_a end
   where (c.user_a=p_actor or c.user_b=p_actor) and public.social_pair_allowed(p_actor,p.user_id)
    and (p_before is null or (c.updated_at,c.id)<(p_before,p_before_id)) order by c.updated_at desc,c.id desc limit 50
  )c;
 elsif p_resource='notifications' then
  select coalesce(jsonb_agg(to_jsonb(n)),'[]') into result from (
   select n.id,n.actor_id,n.kind,n.payload,n.created_at,n.read_at,p.username,p.display_name from public.notifications n left join public.profiles p on p.user_id=n.actor_id
   where n.recipient_id=p_actor and not exists(select 1 from public.profile_blocks where (blocker_id=p_actor and blocked_id=n.actor_id) or (blocker_id=n.actor_id and blocked_id=p_actor))
    and (p_before is null or (n.created_at,n.id)<(p_before,p_before_id)) order by n.created_at desc,n.id desc limit 50
  )n;
 elsif p_resource='state' then
  return jsonb_build_object(
   'appreciations',(select coalesce(jsonb_agg(content_id),'[]') from public.content_private_appreciations where user_id=p_actor),
   'endorsements',(select coalesce(jsonb_agg(content_id),'[]') from public.content_public_endorsements where user_id=p_actor),
   'pins',(select coalesce(jsonb_agg(content_id),'[]') from public.mint_pins where user_id=p_actor),
   'following',(select coalesce(jsonb_agg(following_id),'[]') from public.profile_follows where follower_id=p_actor),
   'blocked',(select coalesce(jsonb_agg(blocked_id),'[]') from public.profile_blocks where blocker_id=p_actor),
   'attendance',(select coalesce(jsonb_agg(event_id),'[]') from public.event_attendance where user_id=p_actor),
   'note',(select to_jsonb(n) from public.profile_notes n where user_id=p_actor and expires_at>now()));
 else raise exception 'Unknown resource' using errcode='22023';end if;
 return jsonb_build_object('items',result,'hasMore',jsonb_array_length(result)=50);
end $$;
revoke all on function public.read_social(uuid,text,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.read_social(uuid,text,uuid,timestamptz,uuid) to service_role;
commit;
