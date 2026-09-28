import { NextResponse } from "next/server";
import { blockedUsers, marketplaceSession, MarketplaceError } from "@/lib/marketplace/server";
import { listingFromRow, parseQuickListing, type ListingRow } from "@/lib/marketplace/listing";
import { checkMarketplaceListingSafety } from "@/lib/marketplaceSafety";
import { coordinates, insideNearby } from "@/lib/discovery/nearby";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const fail = (error: unknown) => json({ ok: false, message: error instanceof MarketplaceError ? error.message : "Sell couldn’t be loaded. Please try again." }, error instanceof MarketplaceError ? error.status : 503);
export async function GET(request: Request) {
  try {
    const { admin, user, networkId } = await marketplaceSession();
    const query = new URL(request.url).searchParams;
    const origin = query.has("lat") && query.has("lng") ? coordinates({latitude:Number(query.get("lat")),longitude:Number(query.get("lng"))}) : null;
    if ((query.has("lat") || query.has("lng")) && !origin) throw new MarketplaceError("Choose a location.");
    const [rows, blocked] = await Promise.all([admin.from("marketplace_listings").select("*").eq("campus_network_id", networkId).or(`status.eq.active,seller_user_id.eq.${user.id}`).order("created_at", { ascending: false }).limit(200), blockedUsers(admin, user.id)]);
    if (rows.error) throw rows.error;
    const visible = (rows.data ?? []).filter((row) => row.status !== "removed" && !blocked.has(row.seller_user_id) && (row.seller_user_id === user.id || (origin && insideNearby(origin, row.moderation_metadata?.nearbyLocation))));
    const ids = [...new Set(visible.map((row) => row.seller_user_id))];
    const profiles = ids.length ? await admin.from("profiles").select("user_id,first_name").in("user_id", ids) : { data: [], error: null };
    if (profiles.error) throw profiles.error;
    const names = new Map((profiles.data ?? []).map((row) => [row.user_id, row.first_name]));
    return json({ ok: true, listings: visible.map((row) => listingFromRow(row as ListingRow, names.get(row.seller_user_id) ?? "Student")) });
  } catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try {
    const { admin, user, campus, networkId, policy } = await marketplaceSession();
    let input: ReturnType<typeof parseQuickListing>;
    let body;
    try { body = await request.json(); input = parseQuickListing(body); } catch (error) { throw new MarketplaceError(error instanceof Error ? error.message : "Check the item details."); }
    if (typeof body.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) throw new MarketplaceError("Reopen the listing form and try again.");
    // Explicit per-listing consent; device position is otherwise never persisted.
    const location = body.shareNearbyArea === true ? coordinates(body.nearbyLocation) : null;
    if (body.shareNearbyArea === true && !location) throw new MarketplaceError("Choose a listing area.");
    const nearbyLocation = location ? {latitude:Math.round(location.latitude*100)/100,longitude:Math.round(location.longitude*100)/100} : null;
    if (Array.isArray(policy?.prohibited_categories) && policy.prohibited_categories.includes("other")) throw new MarketplaceError("Item listings are unavailable under this campus’s policy.", 403);
    const safety = checkMarketplaceListingSafety(input.title, `${input.brand} ${input.pickupArea}`, "Other");
    if (!safety.allowed) throw new MarketplaceError(safety.message ?? "This item cannot be listed.");
    const old = await admin.from("marketplace_listings").select("id,seller_user_id").eq("id", body.requestId).maybeSingle();
    if (old.error) throw old.error;
    if (old.data) {
      if (old.data.seller_user_id !== user.id) throw new MarketplaceError("Please reopen the form.", 409);
      return json({ ok: true, id: old.data.id });
    }
    const insert = await admin.from("marketplace_listings").insert({ id: body.requestId, seller_user_id: user.id, university_id: campus, campus_network_id: networkId, title: input.title, description: input.title, condition: { New: "new", "Like New": "like_new", Good: "good" }[input.condition], asking_price: input.askingPrice, pickup_area: input.pickupArea, category: "other", status: "active", moderation_metadata: { nearbyLocation, brand: input.brand, automated_check: "marketplace_safety_v1" } });
    if (insert.error) { if (insert.error.code === "23505") return json({ ok: true, id: body.requestId }); throw insert.error; }
    return json({ ok: true, id: body.requestId }, 201);
  } catch (error) { return fail(error); }
}
export async function PATCH(request: Request) {
  try {
    const { admin, user, networkId } = await marketplaceSession();
    const body = await request.json();
    if (typeof body.id !== "string" || !["active", "sold"].includes(body.status)) throw new MarketplaceError("Choose an available listing status.");
    const result = await admin.from("marketplace_listings").update({ status: body.status }).eq("id", body.id).eq("seller_user_id", user.id).eq("campus_network_id", networkId).in("status", ["active", "sold"]).select("id").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new MarketplaceError("Listing unavailable.", 404);
    return json({ ok: true });
  } catch (error) { return fail(error); }
}
