import { NextResponse } from "next/server";

import { universities, type UniversityId } from "@/data/universities";
import { createGooglePlacesProvider } from "@/lib/providers/places/googlePlaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { placesConfigured } from "@/lib/providers/places/google";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  try {
    const auth = await createSupabaseServerClient();
    if (!(await auth.auth.getUser()).data.user) return json({ message: "Sign in to find places.", results: [] }, 401);
    const url = new URL(request.url);
    const query = url.searchParams.get("query")?.trim() ?? "";
    const universityId = url.searchParams.get("universityId") as UniversityId | null;
    if (query.length < 3 || query.length > 200) return json({ message: "Enter 3–200 characters.", results: [] }, 400);
    if (!universityId || !Object.hasOwn(universities, universityId)) return json({ message: "Unknown university.", results: [] }, 400);
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!placesConfigured() || !apiKey) return json({ message: "Address search is coming soon.", configured: false, results: [] }, 503);
    const results = await createGooglePlacesProvider(apiKey).search({ query, universityId, maximumResults: 12 });
    return json({ attribution: "Google Maps", requiresGoogleAttribution: true, results });
  } catch {
    return json({ message: "Places unavailable. Try again.", results: [] }, 503);
  }
}
