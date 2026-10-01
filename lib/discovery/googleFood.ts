import "server-only";
import type { Coordinates, Cuisine } from "./nearby";
import { googleNearby } from "@/lib/providers/places/google";
import { rememberPlaceIds } from "@/lib/providers/places/registry";
export async function googleFood(origin: Coordinates, cuisine: Cuisine, key: string) {
  const items = await googleNearby(origin, cuisine, key);
  const identities = await rememberPlaceIds(items.map(item => item.googlePlaceId!), origin);
  return items.map(item => ({ ...item, campusMintPlaceId: identities.get(item.googlePlaceId!) }));
}
