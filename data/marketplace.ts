import type { MarketplaceCategory, MarketplaceListing, MarketplaceSeller } from "@/types/marketplace";
import { getCampusNetworkForUniversity } from "@/data/campusNetworks";

export const marketplaceCategoryDetails: Record<MarketplaceCategory, { icon: string; shortLabel: string }> = {
  "Sports Passes / Tickets": { icon: "🎟", shortLabel: "Tickets" },
  Textbooks: { icon: "📚", shortLabel: "Textbooks" },
  Furniture: { icon: "🪑", shortLabel: "Furniture" },
  Clothing: { icon: "👕", shortLabel: "Clothing" },
  Electronics: { icon: "🖥", shortLabel: "Electronics" },
  "Dorm / Apartment": { icon: "🏠", shortLabel: "Dorm & apartment" },
  "School Supplies": { icon: "✏️", shortLabel: "School supplies" },
  "Bikes / Transportation": { icon: "🚲", shortLabel: "Transportation" },
  Services: { icon: "🛠", shortLabel: "Services" },
  Other: { icon: "＋", shortLabel: "Other" },
};

const tamuDemoSeller: MarketplaceSeller = {
  id: "demo-seller-tamu",
  firstName: "Demo Student",
  universityId: "tamu",
  verificationStatus: "development_placeholder",
  reputationRating: null,
  completedSales: 0,
  joinedAt: null,
};

const blinnDemoSeller: MarketplaceSeller = {
  id: "demo-seller-blinn",
  firstName: "Demo Student",
  universityId: "blinn",
  verificationStatus: "development_placeholder",
  reputationRating: null,
  completedSales: 0,
  joinedAt: null,
};

function developmentListing(
  listing: Omit<MarketplaceListing, "campusNetworkId" | "photos" | "viewCount" | "favoriteCount" | "offerCount" | "status" | "updatedAt" | "isDevelopment">,
): MarketplaceListing {
  const campusNetwork = getCampusNetworkForUniversity(listing.universityId);
  if (!campusNetwork) throw new Error(`Missing Campus Network for ${listing.universityId}.`);
  return {
    ...listing,
    campusNetworkId: campusNetwork.id,
    photos: [{
      id: `${listing.id}-placeholder`,
      url: null,
      alt: `Development placeholder for ${listing.title}`,
      isDevelopmentPlaceholder: true,
    }],
    status: "active",
    updatedAt: listing.createdAt,
    viewCount: 0,
    favoriteCount: 0,
    offerCount: 0,
    isDevelopment: true,
  };
}

export const developmentMarketplaceListings: MarketplaceListing[] = [
  developmentListing({
    id: "market-dev-tamu-calculus", sellerId: tamuDemoSeller.id, seller: tamuDemoSeller, universityId: "tamu",
    title: "Used calculus textbook", description: "Development-only listing for a used calculus textbook. Edition and ISBN are intentionally unspecified.",
    category: "Textbooks", condition: "Good", askingPrice: 28, negotiable: true,
    createdAt: "2026-08-08T14:30:00.000Z", pickupArea: "Library area", deliveryAvailable: false,
    sportsTicket: null,
  }),
  developmentListing({
    id: "market-dev-tamu-sweatshirt", sellerId: tamuDemoSeller.id, seller: tamuDemoSeller, universityId: "tamu",
    title: "Aggie sweatshirt", description: "Development-only apparel listing used to test Marketplace cards and filters.",
    category: "Clothing", condition: "Like New", askingPrice: 24, negotiable: false,
    createdAt: "2026-08-08T13:10:00.000Z", pickupArea: "Student center", deliveryAvailable: true,
    sportsTicket: null,
  }),
  developmentListing({
    id: "market-dev-tamu-monitor", sellerId: tamuDemoSeller.id, seller: tamuDemoSeller, universityId: "tamu",
    title: "Computer monitor", description: "Development-only electronics listing. Technical specifications are not presented as real seller claims.",
    category: "Electronics", condition: "Good", askingPrice: 65, negotiable: true,
    createdAt: "2026-08-08T12:15:00.000Z", pickupArea: "Campus", deliveryAvailable: false,
    sportsTicket: null,
  }),
  developmentListing({
    id: "market-dev-tamu-pass", sellerId: tamuDemoSeller.id, seller: tamuDemoSeller, universityId: "tamu",
    title: "Football sports pass (development example)", description: "Mock interface record only. Campus Mint does not issue or transfer this pass.",
    category: "Sports Passes / Tickets", condition: "Ticket / Pass", askingPrice: 75, negotiable: true,
    createdAt: "2026-08-08T11:00:00.000Z", pickupArea: "University-approved transfer only", deliveryAvailable: false,
    sportsTicket: {
      sport: "Football", eventId: null, eventName: "Football event (development example)",
      eventDate: null, ticketType: "Student Sports Pass", customTicketType: null,
      quantity: 1, seatDetails: null,
      transferNotes: "Complete any permitted transfer outside Campus Mint under applicable university and ticketing rules.",
    },
  }),
  developmentListing({
    id: "market-dev-blinn-fridge", sellerId: blinnDemoSeller.id, seller: blinnDemoSeller, universityId: "blinn",
    title: "Mini fridge", description: "Development-only dorm item listing. Dimensions and appliance details are intentionally unspecified.",
    category: "Dorm / Apartment", condition: "Good", askingPrice: 45, negotiable: true,
    createdAt: "2026-08-08T14:05:00.000Z", pickupArea: "Campus", deliveryAvailable: false,
    sportsTicket: null,
  }),
  developmentListing({
    id: "market-dev-blinn-desk", sellerId: blinnDemoSeller.id, seller: blinnDemoSeller, universityId: "blinn",
    title: "Dorm desk", description: "Development-only furniture listing for testing the local student Marketplace.",
    category: "Furniture", condition: "Fair", askingPrice: 35, negotiable: true,
    createdAt: "2026-08-08T12:40:00.000Z", pickupArea: "Public location", deliveryAvailable: true,
    sportsTicket: null,
  }),
  developmentListing({
    id: "market-dev-blinn-chair", sellerId: blinnDemoSeller.id, seller: blinnDemoSeller, universityId: "blinn",
    title: "Desk chair", description: "Development-only desk chair listing. No real seller, item, or transaction is represented.",
    category: "Furniture", condition: "Good", askingPrice: 30, negotiable: false,
    createdAt: "2026-08-08T10:20:00.000Z", pickupArea: "Student center", deliveryAvailable: false,
    sportsTicket: null,
  }),
];

export const safeMeetupAreas = ["Campus", "Student center", "Library area", "Residence hall lobby", "Public location"] as const;
