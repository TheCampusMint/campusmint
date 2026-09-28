import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const auth = await createSupabaseServerClient();
  if (!(await auth.auth.getUser()).data.user) return new Response(null,{status:401});
  const name = new URL(request.url).searchParams.get("name") ?? "";
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name) || name.length > 2000) return new Response(null,{status:404});
  const result = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&skipHttpRedirect=true`,{cache:"no-store",headers:{"X-Goog-Api-Key":key},signal:AbortSignal.timeout(10_000)});
  if (!result.ok) return new Response(null,{status:503});
  const {photoUri} = await result.json();
  const url = new URL(photoUri);
  if (url.protocol !== "https:" || !/(^|\.)(googleusercontent\.com|ggpht\.com)$/.test(url.hostname)) return new Response(null,{status:502});
  return NextResponse.redirect(url,{headers:{"Cache-Control":"private, no-store"}});
}
