import type { MarketplaceListing, NewMarketplaceListingInput } from "@/types/marketplace";

export function parseQuickListing(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Add your item details.");
  const body = value as Record<string, unknown>;
  const text = (key: string, min: number, max: number) => {
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    if (value.length < min || value.length > max) throw new Error(`Check ${key === "pickupArea" ? "meetup location" : key}.`);
    return value;
  };
  const title = text("title", 2, 100);
  const brand = text("brand", 0, 80);
  const pickupArea = text("pickupArea", 2, 120);
  if (typeof body.askingPrice !== "number" || !Number.isFinite(body.askingPrice) || body.askingPrice < 0 || body.askingPrice > 999999 || Math.abs(Math.round(body.askingPrice * 100) - body.askingPrice * 100) > 0.000001) throw new Error("Enter a price with no more than two decimal places.");
  if (!["New", "Like New", "Good"].includes(String(body.condition))) throw new Error("Choose an item condition.");
  return { title, brand, pickupArea, askingPrice: body.askingPrice, condition: body.condition as "New" | "Like New" | "Good" };
}
export const conditionLabel = (value: string) => value === "Like New" ? "Used – Like New" : value === "Good" ? "Used" : value;
export function quickListingInput(value: ReturnType<typeof parseQuickListing>): NewMarketplaceListingInput {
  return { ...value, description: value.title, category: "Other", negotiable: false, deliveryAvailable: false, sportsTicket: null };
}
export type ListingRow = { id: string; seller_user_id: string; university_id: MarketplaceListing["universityId"]; campus_network_id: MarketplaceListing["campusNetworkId"]; title: string; description: string; condition: string; asking_price: number; pickup_area: string; status: MarketplaceListing["status"]; moderation_metadata: { brand?: string }; created_at: string; updated_at: string };
export function listingFromRow(row: ListingRow, firstName: string): MarketplaceListing {
  return { id: row.id, sellerId: row.seller_user_id, seller: { id: row.seller_user_id, firstName, universityId: row.university_id, verificationStatus: "verified_student", reputationRating: null, completedSales: 0, joinedAt: null }, universityId: row.university_id, campusNetworkId: row.campus_network_id, title: row.title, brand: row.moderation_metadata?.brand ?? "", description: row.description, condition: ({ new: "New", like_new: "Like New", good: "Good", fair: "Fair", for_parts: "For Parts", ticket_pass: "Ticket / Pass", service: "Service" } as const)[row.condition as "new"] ?? "Good", category: "Other", askingPrice: Number(row.asking_price), pickupArea: row.pickup_area, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, photos: [], negotiable: false, deliveryAvailable: false, viewCount: 0, favoriteCount: 0, offerCount: 0, sportsTicket: null, isDevelopment: false };
}
