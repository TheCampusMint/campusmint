"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Coordinates } from "@/lib/discovery/nearby";
import { developmentMarketplaceListings } from "@/data/marketplace";
import { areDevelopmentFixturesEnabled } from "@/lib/runtime/fixturePolicy";
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

const currentSessionSellerId = areDevelopmentFixturesEnabled()
  ? "current-demo-student"
  : "authenticated-user";

function sessionId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useMarketplace(accountId = currentSessionSellerId) {
  const currentUserId = areDevelopmentFixturesEnabled() ? currentSessionSellerId : accountId;
  const [nearbyOrigin, setNearbyOrigin] = useState<Coordinates | null>(null);
  const originRef = useRef(nearbyOrigin);
  useEffect(() => { originRef.current = nearbyOrigin; }, [nearbyOrigin]);
  const accountRef = useRef(accountId);
  useEffect(() => { accountRef.current = accountId; }, [accountId]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remote, setRemote] = useState<{ accountId: string; listings: MarketplaceListing[] } | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (areDevelopmentFixturesEnabled() || !/^[0-9a-f-]{36}$/i.test(accountId)) return;
    const origin = nearbyOrigin;
    const query = origin ? `?lat=${origin.latitude}&lng=${origin.longitude}` : "";
    const response = await fetch(`/api/marketplace${query}`, { cache: "no-store", signal });
    const payload = await response.json();
    if (signal?.aborted || accountRef.current !== accountId || originRef.current !== origin) return;
    if (!response.ok) { setRemote(null); setLoadError(payload.message ?? "Couldn’t load Sell."); return; }
    setRemote({ accountId, listings: payload.listings }); setLoadError(null);
  }, [accountId, nearbyOrigin]);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => { void refresh(controller.signal).catch(() => { if (!controller.signal.aborted) setLoadError("Couldn’t load Sell. Try again."); }); };
    load(); window.addEventListener("focus", load);
    return () => { controller.abort(); window.removeEventListener("focus", load); };
  }, [refresh]);
  const [listings, setListings] = useState<MarketplaceListing[]>(
    areDevelopmentFixturesEnabled() ? developmentMarketplaceListings : [],
  );
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
    const { photo, ...listingInput } = input;
    const listing: MarketplaceListing = {
      ...listingInput,
      id,
      sellerId: currentUserId,
      seller: {
        id: currentUserId,
        firstName: "Student",
        universityId,
        verificationStatus: areDevelopmentFixturesEnabled() ? "development_placeholder" : "verified_student",
        reputationRating: null,
        completedSales: 0,
        joinedAt: null,
      },
      universityId,
      campusNetworkId: campusNetwork.id,
      photos: [{
        id: `${id}-photo`,
        url: photo?.url ?? null,
        alt: photo?.alt ?? `Development placeholder for ${input.title}`,
        isDevelopmentPlaceholder: photo?.isDevelopmentPlaceholder ?? true,
      }],
      createdAt: now,
      updatedAt: now,
      status: "active",
      viewCount: 0,
      favoriteCount: 0,
      offerCount: 0,
      isDevelopment: areDevelopmentFixturesEnabled(),
    };
    setListings((current) => [listing, ...current]);
    return listing;
  }

  async function publishListing(input: NewMarketplaceListingInput, universityId: UniversityId, requestId: string) {
    if (areDevelopmentFixturesEnabled()) { addListing(input, universityId); return; }
    const response = await fetch("/api/marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, requestId }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Your listing wasn’t posted. Try again.");
    await refresh();
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
    const offer: MarketplaceOffer = { id: sessionId("offer"), listingId, buyerId: currentSessionSellerId, amount, note, status: "offer_sent", createdAt: now, updatedAt: now };
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
    const message: MarketplaceMessage = { id: sessionId("message"), listingId, senderId: currentSessionSellerId, body, createdAt: new Date().toISOString() };
    setMessages((current) => [...current, message]);
    return message;
  }

  function reportListing(listingId: string, reason: MarketplaceReportReason, details: string) {
    const report: MarketplaceReport = { id: sessionId("report"), listingId, reporterId: currentSessionSellerId, reason, details, createdAt: new Date().toISOString() };
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
    setNearbyOrigin,
    currentUserId,
    listings: areDevelopmentFixturesEnabled() ? listings : remote?.accountId === accountId ? remote.listings : [],
    loadError,
    refresh,
    publishListing,
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
