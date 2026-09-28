import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { coordinates, cuisines, type Cuisine } from "@/lib/discovery/nearby";
import { googleFood } from "@/lib/discovery/googleFood";
import { nearbyEvents } from "@/lib/discovery/events";
export const dynamic = "force-dynamic";
const json = (value:unknown,status=200) => NextResponse.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(request: Request) {
  try {
    const auth = await createSupabaseServerClient();
    if (!(await auth.auth.getUser()).data.user) return json({message:"Sign in to explore nearby."},401);
    const query = new URL(request.url).searchParams;
    const origin = query.has("lat") && query.has("lng") ? coordinates({latitude:Number(query.get("lat")),longitude:Number(query.get("lng"))}) : null;
    if (!origin) return json({message:"Choose a location."},400);
    if (query.get("kind") === "events") return json(await nearbyEvents(origin));
    if (query.get("kind") !== "food") return json({message:"Choose Food or Events."},400);
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) return json({items:[],configured:false});
    const cuisine = query.get("cuisine") ?? "All";
    if (!cuisines.includes(cuisine as Cuisine)) return json({message:"Choose a cuisine."},400);
    return json({items:await googleFood(origin,cuisine as Cuisine,key),configured:true});
  } catch { return json({message:"Nearby results unavailable."},503); }
}
