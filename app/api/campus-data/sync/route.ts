import { NextResponse } from "next/server";

import { campusDataSources } from "@/data/development/campusData";
import { syncUniversitySource } from "@/lib/sync/engine";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const body = await request.json() as { sourceId?: string };
    const source = campusDataSources.find((item) => item.id === body.sourceId);
    if (!source) return NextResponse.json({ error: "Unknown data source." }, { status: 404 });
    const result = await syncUniversitySource(source);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
