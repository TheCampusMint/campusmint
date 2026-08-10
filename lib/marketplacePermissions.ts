import type { TemporaryUser } from "@/types/user";

export type MarketplacePermissionMode = "development_role" | "verified_student";

function hasStudentIdentity(user: TemporaryUser, mode: MarketplacePermissionMode) {
  if (user.role !== "student") return false;
  return mode === "development_role" || user.verifiedStudent === true;
}

export function canViewMarketplace(user: TemporaryUser, mode: MarketplacePermissionMode) {
  return hasStudentIdentity(user, mode);
}

export function canCreateListing(user: TemporaryUser, mode: MarketplacePermissionMode) {
  return hasStudentIdentity(user, mode);
}

export function canMakeOffer(user: TemporaryUser, mode: MarketplacePermissionMode) {
  return hasStudentIdentity(user, mode);
}

export function canMessageSeller(user: TemporaryUser, mode: MarketplacePermissionMode) {
  return hasStudentIdentity(user, mode);
}

export function canSaveListing(user: TemporaryUser, mode: MarketplacePermissionMode) {
  return hasStudentIdentity(user, mode);
}
