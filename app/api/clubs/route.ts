import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { readJsonObject } from '@/lib/security/requestBody';
import { clubDetails, canManageClub, type ClubRole, type ClubView } from '@/lib/clubs/contracts';
import { safeWebUrl } from '@/lib/discovery/nearby';

export const runtime='nodejs';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
async function context() {
  const session=await createSupabaseServerClient(); const {data:{user},error}=await session.auth.getUser();
  if(error||!user) return null;
  const admin=createSupabaseAdminClient();
  const identity=await admin.from('profile_identities').select('university_id,verified_student,account_type').eq('user_id',user.id).maybeSingle();
  if(identity.error||!identity.data?.verified_student||identity.data.account_type!=='student') return null;
  return {admin,user,campus:identity.data.university_id};
}
export async function GET(request:Request) {
  try {
    const ctx=await context(); if(!ctx)return json({message:'Sign in with a verified Student account.'},401);
    const {admin,user}=ctx; const url=new URL(request.url); const id=url.searchParams.get('id');
    if(id&&!uuid(id))return json({message:'Club unavailable.'},400);
    const campus=url.searchParams.get('universityId')||ctx.campus;
    if(campus!==ctx.campus) {
      const capability=await admin.from('account_capabilities').select('capability').eq('user_id',user.id).eq('capability','owner_campus_tester').is('revoked_at',null).maybeSingle();
      if(capability.error||!capability.data)return json({message:'Campus unavailable.'},403);
    }
    let query=admin.from('organizations').select('id,name,handle,short_description,full_description,visibility,member_count,leader_user_id,user_created,meeting_location,meeting_schedule,website,photo_url,keywords').eq('university_id',campus).eq('status','active').eq('is_development',false);
    if(id)query=query.eq('id',id);
    else query=query.or('user_created.eq.true,and(official_status.in.(university_verified,community_verified),confidence_level.in.(official,community_verified))');
    const clubs=await query.order('created_at',{ascending:false}).limit(100);
    if(clubs.error)throw clubs.error;
    const blocks=await admin.from('profile_blocks').select('blocker_id,blocked_id').or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
    if(blocks.error)throw blocks.error;
    const blocked=new Set((blocks.data??[]).flatMap(r=>[r.blocker_id,r.blocked_id]).filter(v=>v!==user.id));
    const visible=(clubs.data??[]).filter(c=>!c.leader_user_id||!blocked.has(c.leader_user_id)); const ids=visible.map(c=>c.id);
    if(!ids.length)return json({clubs:[]});
    const [memberships,invitations]=await Promise.all([
      admin.from('organization_memberships').select('organization_id,status').eq('user_id',user.id).in('organization_id',ids),
      admin.from('club_invitations').select('organization_id').eq('user_id',user.id).eq('status','pending').in('organization_id',ids),
    ]);
    if(memberships.error||invitations.error)throw memberships.error??invitations.error;
    const result:ClubView[]=visible.map(c=>{
      const role=(c.leader_user_id===user.id?'leader':memberships.data?.find(m=>m.organization_id===c.id)?.status??null) as ClubRole;
      const allowed=c.visibility==='public'||['leader','officer','member'].includes(role??'');
      return {id:c.id,name:c.name,handle:c.handle,summary:allowed?c.short_description:'Request to join',visibility:c.visibility,memberCount:c.member_count,role,invited:invitations.data?.some(i=>i.organization_id===c.id)??false,ownerId:c.leader_user_id,editable:c.user_created,
        ...(allowed ? {description:c.full_description,location:c.meeting_location,schedule:c.meeting_schedule,website:safeWebUrl(c.website),photo:safeWebUrl(c.photo_url),tags:c.keywords??[]} : {})};
    });
    const selected=result[0];
    if(id&&canManageClub(selected.role)) {
      const members=await admin.from('organization_memberships').select('user_id,status').eq('organization_id',id).limit(500);
      if(members.error)throw members.error;
      const memberIds=(members.data??[]).map(m=>m.user_id);
      if(memberIds.length) {
        const profiles=await admin.from('profiles').select('user_id,display_name,username').in('user_id',memberIds);
        if(profiles.error)throw profiles.error;
        selected.members=(profiles.data??[]).filter(p=>!blocked.has(p.user_id)).map(p=>({id:p.user_id,name:p.display_name,username:p.username,role:members.data?.find(m=>m.user_id===p.user_id)?.status as ClubRole}));
      }
      if(url.searchParams.has('people')) {
        const search=(url.searchParams.get('people')??'').trim().slice(0,60);
        if(search&&!/^[\p{L}\p{N} ._@-]+$/u.test(search))return json({message:'Use a name or username.'},400);
        const identities=await admin.from('profile_identities').select('user_id').eq('university_id',ctx.campus).eq('verified_student',true).eq('account_type','student').limit(2000);
        if(identities.error)throw identities.error;
        const eligible=(identities.data??[]).map(i=>i.user_id).filter(uid=>uid!==user.id&&!blocked.has(uid)&&!memberIds.includes(uid));
        if(!eligible.length)return json({clubs:result,people:[]});
        let people=admin.from('profiles').select('user_id,display_name,username,interests').in('user_id',eligible).eq('social_account_type','public');
        if(search)people=people.or(`username.ilike.${search.replace(/^@/,'')}%,display_name.ilike.${search}%`);
        const profiles=await people.order('username').limit(100);
        if(profiles.error)throw profiles.error;
        if (!profiles.data?.length) return json({clubs:result,people:[]});
        const privacy=await admin.from('profile_privacy_settings').select('user_id,interests').in('user_id',(profiles.data??[]).map(p=>p.user_id));
        if(privacy.error)throw privacy.error;
        const tags=new Set((selected.tags??[]).map(t=>t.toLowerCase()));
        const score=(p:{user_id:string;interests:string[]})=>privacy.data?.some(v=>v.user_id===p.user_id&&['everyone','students_only'].includes(v.interests)) ? (p.interests??[]).filter(t=>tags.has(t.toLowerCase())).length:0;
        return json({clubs:result,people:(profiles.data??[]).sort((a,b)=>score(b)-score(a)).slice(0,20).map(p=>({id:p.user_id,name:p.display_name,username:p.username,role:null}))});
      }
    } else if(url.searchParams.has('people'))return json({message:'Club administrator required.'},403);
    return json({clubs:result});
  } catch {return json({message:'Clubs are temporarily unavailable.'},503);}
}

export async function POST(request:Request) {
  try {
    const ctx=await context(); if(!ctx)return json({message:'Sign in with a verified Student account.'},401);
    const body=await readJsonObject(request);
    const actions=['create','update','request','cancel','leave','approve','reject','remove','promote','demote','invite','accept_invite','decline_invite'];
    if(typeof body.action!=='string'||!actions.includes(body.action)|| (body.action!=='create'&&!uuid(body.clubId)) || (body.targetId!==undefined&&!uuid(body.targetId)))return json({message:'Invalid club action.'},400);
    let data={};
    if(body.action==='create'||body.action==='update') {
      try {data=clubDetails(body);} catch(error){return json({message:error instanceof Error?error.message:'Invalid club details.'},400);}
    }
    const {data:id,error}=await ctx.admin.rpc('mutate_club',{p_actor:ctx.user.id,p_action:body.action,p_club:body.clubId??null,p_target:body.targetId??null,p_data:data});
    if(error)return json({message:error.code==='23505'?'That name or handle is taken.':error.code==='42501'?'You cannot make that change.':error.code==='22023'?'Check the club details or refresh and try again.':'Club update unavailable.'},error.code==='42501'?403:error.code==='23505'?409:error.code==='22023'?400:503);
    return json({ok:true,id});
  } catch {return json({message:'Invalid club request.'},400);}
}
