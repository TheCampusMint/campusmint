import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { readJsonObject } from '@/lib/security/requestBody';
import { parseSocialMutation, parseSocialRead } from '@/lib/social/syncContract';
export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => NextResponse.json(body, {status, headers: {'Cache-Control':'private, no-store'}});
async function identity() {
  const session = await createSupabaseServerClient();
  const {data:{user},error} = await session.auth.getUser();
  return error ? null : user;
}
function failure(code?: string) {
  if (code === '42501') return json({ok:false,message:'This item is unavailable.'},403);
  if (code === '23505') return json({ok:false,message:'This request conflicts with an earlier change.'},409);
  if (code === '22023' || code === '22P02') return json({ok:false,message:'Check your entry and try again.'},400);
  return json({ok:false,message:'Could not sync. Please try again.'},503);
}
export async function GET(request: Request) {
  try {
    const user = await identity(); if (!user) return json({ok:false,message:'Sign in again.'},401);
    const input = parseSocialRead(new URL(request.url).searchParams);
    if (!input) return json({ok:false,message:'Invalid social request.'},400);
    const {data,error} = await createSupabaseAdminClient().rpc('read_social',{p_actor:user.id,...input});
    return error ? failure(error.code) : json({ok:true,...data});
  } catch { return failure(); }
}
export async function POST(request: Request) {
  let user;
  try { user = await identity(); } catch { return failure(); }
  if (!user) return json({ok:false,message:'Sign in again.'},401);
  let input;
  try {input=parseSocialMutation(await readJsonObject(request));} catch {return json({ok:false,message:'Invalid social request.'},400);}
  if (!input) return json({ok:false,message:'Invalid social request.'},400);
  try {
    const {data,error}=await createSupabaseAdminClient().rpc('mutate_social',{p_actor:user.id,...input});
    return error ? failure(error.code) : json(data);
  } catch {return failure();}
}
