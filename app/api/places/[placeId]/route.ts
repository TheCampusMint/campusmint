import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { googleDetails, googleReviews, placesConfigured } from "@/lib/providers/places/google";
import { validPlaceId } from "@/lib/providers/places/identity";
import { knownPlace } from "@/lib/providers/places/registry";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: Request, context: { params: Promise<{ placeId: string }> }) {
  try {
    const auth = await createSupabaseServerClient();
    if (!(await auth.auth.getUser()).data.user) return json({ message: "Sign in to view places." }, 401);
    const { placeId } = await context.params;
    const view = new URL(request.url).searchParams.get("view") ?? "details";
    if (!validPlaceId(placeId) || !["details", "reviews"].includes(view)) return json({ message: "Invalid place request." }, 400);
    if (!placesConfigured()) return json({ message: "Nearby food is coming soon" }, 503);
    // Only an identity discovered by the trusted server can incur a Details call.
    if (!await knownPlace(placeId)) return json({ message: "Place unavailable." }, 404);
    return json(view === "reviews" ? await googleReviews(placeId, process.env.GOOGLE_PLACES_API_KEY!) : await googleDetails(placeId, process.env.GOOGLE_PLACES_API_KEY!));
  } catch { return json({ message: "Place unavailable. Try again." }, 503); }
}
