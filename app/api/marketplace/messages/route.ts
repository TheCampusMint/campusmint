import { readJsonObject } from "@/lib/security/requestBody";
import { NextResponse } from "next/server";
import { blockedUsers, marketplaceSession, MarketplaceError } from "@/lib/marketplace/server";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const fail = (error: unknown) => json({ ok: false, message: error instanceof MarketplaceError ? error.message : "Messages are temporarily unavailable." }, error instanceof MarketplaceError ? error.status : 503);
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
async function context(listingId: string | null) {
  const session = await marketplaceSession();
  if (!uuid(listingId)) throw new MarketplaceError("Listing unavailable.", 404);
  const listing = await session.admin.from("marketplace_listings").select("id,seller_user_id,status").eq("id", listingId).eq("campus_network_id", session.networkId).in("status", ["active", "sold"]).maybeSingle();
  if (listing.error) throw listing.error;
  const blocked = await blockedUsers(session.admin, session.user.id);
  if (!listing.data || blocked.has(listing.data.seller_user_id)) throw new MarketplaceError("Listing unavailable.", 404);
  return { ...session, listing: listing.data, blocked };
}
export async function GET(request: Request) {
  try {
    const { admin, user, listing, blocked } = await context(new URL(request.url).searchParams.get("listingId"));
    let query = admin.from("marketplace_messages").select("id,listing_id,buyer_id,sender_id,body,created_at").eq("listing_id", listing.id);
    if (listing.seller_user_id !== user.id) query = query.eq("buyer_id", user.id);
    const result = await query.order("created_at", { ascending: false }).limit(300);
    if (result.error) throw result.error;
    const messages = (result.data ?? []).filter((row) => !blocked.has(row.buyer_id)).reverse();
    const ids = [...new Set(messages.map((row) => row.buyer_id))];
    const profiles = ids.length ? await admin.from("profiles").select("user_id,first_name").in("user_id", ids) : { data: [], error: null };
    if (profiles.error) throw profiles.error;
    return json({ ok: true, messages, buyers: profiles.data });
  } catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const { admin, user, listing, blocked } = await context(typeof body.listingId === "string" ? body.listingId : null);
    const sellerReply = user.id === listing.seller_user_id;
    const buyerId = sellerReply ? body.buyerId : user.id;
    if (!uuid(buyerId) || buyerId === listing.seller_user_id || blocked.has(buyerId)) throw new MarketplaceError("Conversation unavailable.", 403);
    if (typeof body.body !== "string" || !body.body.trim() || body.body.trim().length > 2000 || !uuid(body.requestId)) throw new MarketplaceError("Write a message up to 2,000 characters.");
    if (sellerReply || listing.status === "sold") {
      const thread = await admin.from("marketplace_messages").select("id").eq("listing_id", listing.id).eq("buyer_id", buyerId).limit(1).maybeSingle();
      if (thread.error) throw thread.error;
      if (!thread.data) throw new MarketplaceError("Conversation unavailable.", 403);
    }
    const result = await admin.from("marketplace_messages").insert({ id: body.requestId, listing_id: listing.id, buyer_id: buyerId, sender_id: user.id, body: body.body.trim() });
    if (result.error && result.error.code !== "23505") throw result.error;
    return json({ ok: true });
  } catch (error) { return fail(error); }
}
