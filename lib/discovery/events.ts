import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { insideNearby, safeWebUrl, type Coordinates, type NearbyItem } from "./nearby";
import { bryanEvents } from "./bryan";
export function eventItem(row: Record<string, unknown>): NearbyItem {
  return {id:String(row.id),title:String(row.title),description:String(row.brief_description ?? ""),address:String(row.address ?? row.location_name ?? ""),latitude:Number(row.latitude),longitude:Number(row.longitude),timeZone:String(row.timezone ?? "UTC"),startsAt:String(row.starts_at),endsAt:row.ends_at ? String(row.ends_at) : undefined,source:String(row.source_name),sourceUrl:safeWebUrl(row.source_url) ?? "",website:safeWebUrl(row.source_url),image:safeWebUrl(row.image_url)};
}
export const publicEventSources = ["university","city","tourism","venue","trusted_public"];
export async function nearbyEvents(origin: Coordinates) {
  const admin = createSupabaseAdminClient();
  const [stored, bryan] = await Promise.allSettled([
    admin.from("campus_events").select("*").in("status",["scheduled","updated"]).in("source_kind",publicEventSources)
      .gte("latitude",origin.latitude-.15).lte("latitude",origin.latitude+.15)
      .or(`ends_at.gt.${new Date().toISOString()},and(ends_at.is.null,starts_at.gt.${new Date().toISOString()})`).order("starts_at").limit(500),
    bryanEvents(origin),
  ]);
  const failed = stored.status === "rejected" || !!stored.value.error || bryan.status === "rejected";
  const rows = stored.status === "fulfilled" && !stored.value.error ? (stored.value.data ?? []).filter(r=>r.latitude != null && r.longitude != null).map(eventItem) : [];
  const all = [...rows,...(bryan.status === "fulfilled" ? bryan.value : [])].filter(i=>insideNearby(origin,i));
  const seen = new Set<string>();
  return { items:all.filter(i=>{const key=`${i.title.toLowerCase().trim()}:${i.startsAt?.slice(0,10)}`;if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>Date.parse(a.startsAt ?? "")-Date.parse(b.startsAt ?? "")), partial:failed };
}
