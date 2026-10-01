import { readJsonObject } from "@/lib/security/requestBody";
import {NextResponse} from "next/server";
import {createSupabaseServerClient,createSupabaseAdminClient} from "@/lib/supabase/server";
import {canRecordPreference} from "@/lib/social/preferencePermissions";
import {interestTopics} from "@/lib/social/feedPreferences";
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
async function session() { const auth=await createSupabaseServerClient();return (await auth.auth.getUser()).data.user; }
export async function GET() {
  try {
    const user=await session();if(!user)return json({message:"Sign in."},401);
    const result=await createSupabaseAdminClient().from("feed_preferences").select("mint_id,author_id,topics,weight,reason,updated_at").eq("user_id",user.id).order("updated_at",{ascending:false}).limit(500);
    if(result.error)throw result.error;
    return json({signals:(result.data ?? []).map(r=>({mintId:r.mint_id,authorId:r.author_id,topics:r.topics,weight:r.weight,reason:r.reason,updatedAt:r.updated_at}))});
  } catch{return json({message:"Preferences couldn’t sync."},503);}
}
export async function POST(request:Request) {
  try {
    const user=await session();if(!user)return json({message:"Sign in."},401);
    if(Number(request.headers.get("content-length")) > 24000)return json({message:"Request too large."},413);
    const body=await readJsonObject(request);
    if(!Array.isArray(body.signals)||body.signals.length>50)return json({message:"Invalid preferences."},400);
    const admin=createSupabaseAdminClient();
    const incoming=body.signals as {mintId:string;weight:number;reason:string|null;updatedAt:string}[];
    if(incoming.some(s=>!s || typeof s.mintId!=="string" || !/^[0-9a-f-]{36}$/i.test(s.mintId) || !Number.isFinite(s.weight) || s.weight<0 || s.weight>4 || typeof s.updatedAt!=="string" || !Number.isFinite(Date.parse(s.updatedAt)) || (s.reason!==null && !["creator","content","relevance"].includes(s.reason)))) return json({message:"Invalid preferences."},400);
    const ids=incoming.map(s=>s.mintId);
    if(!ids.length)return json({ok:true});
    const [content,tags,previous]=await Promise.all([admin.from("social_content").select("id,author_id,caption,status,expires_at,organization_audience,organization_id,university_id").eq("kind","mint").in("id",ids),admin.from("content_hashtags").select("content_id,hashtag_normalized").in("content_id",ids),admin.from("feed_preferences").select("mint_id,reason,weight,updated_at").eq("user_id",user.id).in("mint_id",ids)]);
    if(content.error||tags.error||previous.error)throw new Error("Read failed");
    const [mints,authors,identity,blocks,follows,friends,memberships]=await Promise.all([
      admin.from("mints").select("content_id,privacy,archived_at").in("content_id",ids),
      admin.from("profiles").select("user_id,social_account_type").in("user_id",[...new Set((content.data ?? []).map(m=>m.author_id))]),
      admin.from("profile_identities").select("university_id").eq("user_id",user.id).maybeSingle(),
      admin.from("profile_blocks").select("blocker_id,blocked_id").or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
      admin.from("profile_follows").select("follower_id,following_id").or(`follower_id.eq.${user.id},following_id.eq.${user.id}`),
      admin.from("friendships").select("requester_id,addressee_id").eq("status","friends").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
      admin.from("organization_memberships").select("organization_id").eq("user_id",user.id).in("status",["member","officer","leader"]),
    ]);
    if([mints,authors,identity,blocks,follows,friends,memberships].some(r=>r.error))throw new Error("Read failed");
    const blocked=new Set((blocks.data ?? []).flatMap(b=>[b.blocker_id,b.blocked_id]).filter(id=>id!==user.id));
    const connected=new Set([...(friends.data ?? []).flatMap(f=>[f.requester_id,f.addressee_id])]);
    const member=new Set((memberships.data ?? []).map(m=>m.organization_id));
    const allowed=(content.data ?? []).filter(m=>{
      const post=mints.data?.find(p=>p.content_id===m.id);const author=authors.data?.find(p=>p.user_id===m.author_id);
      return post && author && canRecordPreference({status:m.status,privacy:post.privacy,archivedAt:post.archived_at,expiresAt:m.expires_at,organizationAudience:m.organization_audience,organizationId:m.organization_id,authorId:m.author_id,viewerId:user.id,authorAccountType:author.social_account_type,authorCampus:m.university_id,viewerCampus:identity.data?.university_id ?? null,connected:connected.has(m.author_id),blocked:blocked.has(m.author_id),member:member.has(m.organization_id)});
    });
    const rows=allowed.map(mint=>{
      const signal=incoming.find(s=>s.mintId===mint.id)!;const old=previous.data?.find(s=>s.mint_id===mint.id);
      return {user_id:user.id,mint_id:mint.id,author_id:mint.author_id,topics:interestTopics({caption:mint.caption ?? "",hashtags:(tags.data ?? []).filter(t=>t.content_id===mint.id).map(t=>t.hashtag_normalized)}),weight:Math.max(signal.weight,old?.weight ?? 0),reason:signal.reason ?? old?.reason ?? null,updated_at:new Date(Math.max(Math.min(Date.parse(signal.updatedAt),Date.now()),old?.updated_at ? Date.parse(old.updated_at) : 0)).toISOString()};
    });
    // Feedback changes only the requesting account's recommendations; response
    // never confirms a post's existence or reveals its contents.
    for(const row of rows) {
      const write=await admin.from("feed_preferences").upsert(row,{onConflict:"user_id,mint_id",ignoreDuplicates:!row.reason});if(write.error)throw write.error;
      if(!row.reason){const update=await admin.from("feed_preferences").update({weight:row.weight,updated_at:row.updated_at}).eq("user_id",user.id).eq("mint_id",row.mint_id).is("reason",null).lte("weight",row.weight);if(update.error)throw update.error;}
    }
    return json({ok:true});
  } catch{return json({message:"Preferences couldn’t sync."},503);}
}
