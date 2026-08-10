import { NextResponse } from "next/server";

import { universities, type UniversityId } from "@/data/universities";
import { createGooglePlacesProvider } from "@/lib/providers/places/googlePlaces";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() ?? "";
  const universityId = url.searchParams.get("universityId") as UniversityId | null;
  if (query.length < 2) return NextResponse.json({ error: "Enter at least two characters." }, { status: 400 });
  if (!universityId || !universities[universityId]) {
    return NextResponse.json({ error: "Unknown university." }, { status: 400 });
  }
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "Google Places is not configured.",
      configured: false,
      results: [],
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const provider = createGooglePlacesProvider(apiKey);
    const results = await provider.search({ query, universityId, maximumResults: 12 });
    return NextResponse.json({
      provider: "Google Places API (New)",
      attribution: "Google Maps",
      requiresGoogleAttribution: true,
      cachePolicy: "Results are returned dynamically and are not persisted by Campus Mint.",
      results,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Places search failed.";
    return NextResponse.json({ error: message, results: [] }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
