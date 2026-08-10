"use client";

import { useState } from "react";

import { developmentMarketplaceListings } from "@/data/marketplace";
import type { UniversityId } from "@/data/universities";
import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import type {
  MarketplaceListing,
  MarketplaceMessage,
  MarketplaceOffer,
  MarketplaceReport,
  MarketplaceReportReason,
  MarketplaceListingStatus,
  NewMarketplaceListingInput,
} from "@/types/marketplace";

const currentDemoSellerId = "current-demo-student";

function sessionId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useMarketplace() {
  const [listings, setListings] = useState<MarketplaceListing[]>(developmentMarketplaceListings);
  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);
  const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
  const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
  const [reports, setReports] = useState<MarketplaceReport[]>([]);
  const [blockedSellerIds, setBlockedSellerIds] = useState<string[]>([]);

  function addListing(input: NewMarketplaceListingInput, universityId: UniversityId) {
    const campusNetwork = getCampusNetworkForUniversity(universityId);
    if (!campusNetwork) throw new Error(`Marketplace Campus Network is not configured for ${universityId}.`);
    const now = new Date().toISOString();
    const id = sessionId("market-local");
    const listing: MarketplaceListing = {
      ...input,
      id,
      sellerId: currentDemoSellerId,
      seller: {
        id: currentDemoSellerId,
        firstName: "Demo Student",
        universityId,
        verificationStatus: "development_placeholder",
        reputationRating: null,
        completedSales: 0,
        joinedAt: null,
      },
      universityId,
      campusNetworkId: campusNetwork.id,
      photos: [{ id: `${id}-placeholder`, url: null, alt: `Development placeholder for ${input.title}`, isDevelopmentPlaceholder: true }],
      createdAt: now,
      updatedAt: now,
      status: "active",
      viewCount: 0,
      favoriteCount: 0,
      offerCount: 0,
      isDevelopment: true,
    };
    setListings((current) => [listing, ...current]);
    return listing;
  }

  function toggleSaved(listingId: string) {
    const isSaved = savedListingIds.includes(listingId);
    setSavedListingIds((current) => isSaved ? current.filter((id) => id !== listingId) : [...current, listingId]);
    setListings((current) => current.map((listing) => listing.id === listingId
      ? { ...listing, favoriteCount: Math.max(0, listing.favoriteCount + (isSaved ? -1 : 1)) }
      : listing));
  }

  function sendOffer(listingId: string, amount: number, note: string | null = null) {
    const now = new Date().toISOString();
    const offer: MarketplaceOffer = { id: sessionId("offer"), listingId, buyerId: currentDemoSellerId, amount, note, status: "offer_sent", createdAt: now, updatedAt: now };
    setOffers((current) => [...current, offer]);
    setListings((current) => current.map((listing) => listing.id === listingId ? { ...listing, offerCount: listing.offerCount + 1 } : listing));
    return offer;
  }

  function withdrawOffer(offerId: string) {
    const offer = offers.find((item) => item.id === offerId && item.status === "offer_sent");
    if (!offer) return;
    setOffers((current) => current.map((item) => item.id === offerId ? { ...item, status: "withdrawn", updatedAt: new Date().toISOString() } : item));
    setListings((current) => current.map((listing) => listing.id === offer.listingId ? { ...listing, offerCount: Math.max(0, listing.offerCount - 1) } : listing));
  }

  function sendMessage(listingId: string, body: string) {
    const message: MarketplaceMessage = { id: sessionId("message"), listingId, senderId: currentDemoSellerId, body, createdAt: new Date().toISOString() };
    setMessages((current) => [...current, message]);
    return message;
  }

  function reportListing(listingId: string, reason: MarketplaceReportReason, details: string) {
    const report: MarketplaceReport = { id: sessionId("report"), listingId, reporterId: currentDemoSellerId, reason, details, createdAt: new Date().toISOString() };
    setReports((current) => [...current, report]);
    return report;
  }

  function blockSeller(sellerId: string) {
    setBlockedSellerIds((current) => current.includes(sellerId) ? current : [...current, sellerId]);
  }

  function updateListingStatus(listingId: string, status: MarketplaceListingStatus) {
    setListings((current) => current.map((listing) => listing.id === listingId
      ? { ...listing, status, updatedAt: new Date().toISOString() }
      : listing));
  }

  return {
    currentUserId: currentDemoSellerId,
    listings,
    savedListingIds,
    offers,
    messages,
    reports,
    blockedSellerIds,
    addListing,
    toggleSaved,
    sendOffer,
    withdrawOffer,
    sendMessage,
    reportListing,
    blockSeller,
    updateListingStatus,
  };
}
