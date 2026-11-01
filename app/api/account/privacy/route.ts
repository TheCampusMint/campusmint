import { NextResponse } from 'next/server';
import { createSupabaseAdminClient,createSupabaseServerClient } from '@/lib/supabase/server';
import { readJsonObject } from '@/lib/security/requestBody';
import { parsePrivacyPatch } from '@/lib/social/syncContract';
export const runtime='nodejs';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function PATCH(request:Request) {
 try {
  const client=await createSupabaseServerClient();
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)return json({ok:false,message:'Sign in again.'},401);
  let patch;
  try {patch=parsePrivacyPatch(await readJsonObject(request));} catch {patch=null;}
  if(!patch)return json({ok:false,message:'Invalid privacy setting.'},400);
  const {data,error}=await createSupabaseAdminClient().rpc('update_profile_privacy',{p_actor:user.id,p_patch:patch});
  if(error)return json({ok:false,message:'Could not save privacy settings.'},error.code==='42501'?403:error.code==='22023'?400:503);
  return json(data);
 } catch { return json({ok:false,message:'Could not save privacy settings. Try again.'},503); }
}
