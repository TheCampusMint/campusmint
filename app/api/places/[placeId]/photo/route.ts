import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { googlePhoto, placesConfigured } from "@/lib/providers/places/google";
import { validPlaceId } from "@/lib/providers/places/identity";
import { knownPlace } from "@/lib/providers/places/registry";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: Request, context: { params: Promise<{ placeId: string }> }) {
  try {
    const auth = await createSupabaseServerClient();
    if (!(await auth.auth.getUser()).data.user) return json({ message: "Sign in to view places." }, 401);
    const { placeId } = await context.params;
    const rawIndex = new URL(request.url).searchParams.get("index") ?? "0";
    if (!validPlaceId(placeId) || !/^[0-4]$/.test(rawIndex)) return json({ message: "Invalid photo request." }, 400);
    if (!placesConfigured()) return json({ message: "Photos unavailable." }, 503);
    if (!await knownPlace(placeId)) return json({ message: "Place unavailable." }, 404);
    return json({ photo: await googlePhoto(placeId, Number(rawIndex), process.env.GOOGLE_PLACES_API_KEY!) });
  } catch { return json({ message: "Photo unavailable." }, 503); }
}
