import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Coordinates } from "@/lib/discovery/nearby";
import { identityRows, placeAreaKey } from "./identity";
export async function rememberPlaceIds(ids: string[], origin: Coordinates) {
  const rows = identityRows(ids);
  if (!rows.length) return new Map<string, string>();
  const admin = createSupabaseAdminClient();
  const saved = await admin.from("place_identity").upsert(rows, { onConflict: "google_place_id", ignoreDuplicates: true });
  if (saved.error) throw new Error("Place registry unavailable");
  const existing = await admin.from("place_identity").select("id,google_place_id").in("google_place_id", rows.map(row => row.google_place_id));
  if (existing.error) throw new Error("Place registry unavailable");
  const places = (existing.data ?? []) as { id: string; google_place_id: string }[];
  const areas = await admin.from("place_areas").upsert(places.map(place => ({ place_id: place.id, area_key: placeAreaKey(origin) })), { onConflict: "place_id,area_key", ignoreDuplicates: true });
  if (areas.error) throw new Error("Place area registry unavailable");
  return new Map(places.map(place => [place.google_place_id, place.id]));
}
export async function knownPlace(googlePlaceId: string) {
  const result = await createSupabaseAdminClient().from("place_identity").select("id").eq("google_place_id", googlePlaceId).maybeSingle();
  if (result.error) throw new Error("Place registry unavailable");
  return result.data?.id as string | undefined;
}
