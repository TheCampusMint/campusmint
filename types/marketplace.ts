import type { UniversityId } from "@/data/universities";
import type { CampusNetworkId } from "@/data/campusNetworks";

export const marketplaceCategories = [
  "Sports Passes / Tickets",
  "Textbooks",
  "Furniture",
  "Clothing",
  "Electronics",
  "Dorm / Apartment",
  "School Supplies",
  "Bikes / Transportation",
  "Services",
  "Other",
] as const;

export type MarketplaceCategory = (typeof marketplaceCategories)[number];

export const marketplaceConditions = [
  "New",
  "Like New",
  "Good",
  "Fair",
  "For Parts",
  "Ticket / Pass",
  "Service",
] as const;

export type MarketplaceCondition = (typeof marketplaceConditions)[number];
export type MarketplaceListingStatus = "active" | "pending" | "reserved" | "sold" | "removed";

export const marketplaceTicketPassTypes = [
  "Student Sports Pass",
  "Student Ticket",
  "Guest Ticket",
  "General Admission",
  "Reserved Seat",
  "Season Pass",
  "Other",
] as const;

export type MarketplaceTicketPassType = (typeof marketplaceTicketPassTypes)[number];

export type MarketplaceSportsTicketDetails = {
  sport: string;
  eventId: string | null;
  eventName: string;
  eventDate: string | null;
  ticketType: MarketplaceTicketPassType;
  customTicketType: string | null;
  quantity: number;
  seatDetails: string | null;
  transferNotes: string | null;
};

export type MarketplacePhoto = {
  id: string;
  url: string | null;
  alt: string;
  isDevelopmentPlaceholder: boolean;
};

export type MarketplaceSeller = {
  id: string;
  firstName: string;
  universityId: UniversityId;
  verificationStatus: "verified_student" | "development_placeholder";
  reputationRating: number | null;
  completedSales: number;
  joinedAt: string | null;
};

export type MarketplaceListing = {
  id: string;
  sellerId: string;
  seller: MarketplaceSeller;
  universityId: UniversityId;
  campusNetworkId: CampusNetworkId;
  title: string;
  description: string;
  category: MarketplaceCategory;
  condition: MarketplaceCondition;
  askingPrice: number;
  negotiable: boolean;
  photos: MarketplacePhoto[];
  createdAt: string;
  updatedAt: string;
  status: MarketplaceListingStatus;
  pickupArea: string;
  deliveryAvailable: boolean;
  viewCount: number;
  favoriteCount: number;
  offerCount: number;
  sportsTicket: MarketplaceSportsTicketDetails | null;
  isDevelopment: boolean;
};

export type NewMarketplaceListingInput = Pick<
  MarketplaceListing,
  "title" | "description" | "category" | "condition" | "askingPrice" | "negotiable" | "pickupArea" | "deliveryAvailable" | "sportsTicket"
> & {
  photo?: Pick<MarketplacePhoto, "url" | "alt" | "isDevelopmentPlaceholder">;
};

export type MarketplaceOfferStatus = "offer_sent" | "withdrawn" | "accepted" | "declined" | "countered";

export type MarketplaceOffer = {
  id: string;
  listingId: string;
  buyerId: string;
  amount: number;
  note: string | null;
  status: MarketplaceOfferStatus;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceMessage = {
  id: string;
  listingId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type MarketplaceTransactionStatus =
  | "offer_sent"
  | "offer_accepted"
  | "meetup_planned"
  | "completed"
  | "cancelled"
  | "disputed";

export type MarketplaceTransaction = {
  id: string;
  listingId: string;
  offerId: string | null;
  buyerId: string;
  sellerId: string;
  status: MarketplaceTransactionStatus;
  meetupArea: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceReportReason = "prohibited_item" | "fraud_or_scam" | "ticket_concern" | "misleading_listing" | "other";

export type MarketplaceReport = {
  id: string;
  listingId: string;
  reporterId: string;
  reason: MarketplaceReportReason;
  details: string;
  createdAt: string;
};
