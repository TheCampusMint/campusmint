import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { canShareMint } from "./publicPolicy";
import { safeWebUrl } from "@/lib/discovery/nearby";
export const publicMint = cache(async (id:string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const admin = createSupabaseAdminClient();
  const content = await admin.from("social_content").select("id,author_id,caption,status,expires_at,organization_audience,organization_id,poll_definition,created_at").eq("id",id).eq("kind","mint").maybeSingle();
  if (content.error || !content.data) return null;
  const row = content.data;
  const [mint,profile] = await Promise.all([
    admin.from("mints").select("privacy,archived_at").eq("content_id",id).maybeSingle(),
    admin.from("profiles").select("display_name,username,social_account_type").eq("user_id",row.author_id).maybeSingle(),
  ]);
  if (mint.error || profile.error || !mint.data || !profile.data || !canShareMint({status:row.status,privacy:mint.data.privacy,accountType:profile.data.social_account_type,archivedAt:mint.data.archived_at,expiresAt:row.expires_at,organizationAudience:row.organization_audience})) return null;
  if (row.organization_id) {
    const organization = await admin.from("organizations").select("id").eq("id",row.organization_id).eq("status","active").eq("is_development",false).in("official_status",["university_verified","community_verified"]).maybeSingle();
    if (organization.error || !organization.data) return null;
  }
  const media = await admin.from("content_media").select("id,media_type,storage_path,width,height").eq("content_id",id).order("sort_order");
  if (media.error) return null;
  const files = await Promise.all((media.data ?? []).map(async item=>{
    const signed = await admin.storage.from("mint-media").createSignedUrl(item.storage_path,Math.max(1,Math.min(900,row.expires_at ? Math.floor((Date.parse(row.expires_at)-Date.now())/1000) : 900)));
    return {id:item.id,type:item.media_type,url:signed.data?.signedUrl ?? null,width:item.width,height:item.height};
  }));
  // Only the public display identity is returned; no account, contact or member data.
  return {id:row.id,caption:String(row.caption ?? ""),author:profile.data.display_name || profile.data.username,createdAt:row.created_at,media:files,poll:row.poll_definition as {question:string;options:{id:string;label:string}[]} | null};
});
export const publicClub = cache(async (handle:string) => {
  if (!/^[a-z0-9-]{2,80}$/.test(handle)) return null;
  const result = await createSupabaseAdminClient().from("organizations").select("name,short_description,full_description,photo_url,website,meeting_location,meeting_schedule").eq("handle",handle).eq("status","active").eq("is_development",false).in("official_status",["university_verified","community_verified"]).in("confidence_level",["official","community_verified"]).maybeSingle();
  if(result.error || !result.data) return null;
  return {...result.data,photo_url:safeWebUrl(result.data.photo_url),website:safeWebUrl(result.data.website)};
});
