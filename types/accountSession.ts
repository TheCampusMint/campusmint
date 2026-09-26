import type { CampusMintUser } from "@/types/profile";
import type { AccountCapability } from "@/types/accountCapabilities";

export type BrandSessionProfile = {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  bio: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  businessCategory: string | null;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  channel: {
    id: string;
    name: string;
    handle: string;
    description: string | null;
    status: "active" | "suspended" | "archived";
  } | null;
};

export type CreatorSessionProfile = {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  bio: string | null;
  application: {
    id: string;
    platform: string;
    externalHandle: string;
    status: "pending" | "under_review" | "approved" | "rejected";
    controlStatus: "pending" | "verified" | "failed";
  } | null;
  creatorApproved: boolean;
  badgeTint: string;
};

export type AccountSessionResponse =
  | { ok: true; configured: boolean; authenticated: false }
  | {
      ok: true;
      configured: true;
      authenticated: true;
      accountType: "student";
      capabilities: AccountCapability[];
      canUseCampusTester?: boolean;
      studentSmsVerificationRequired: boolean;
      studentPhoneVerified: boolean;
      onboardingComplete: boolean;
      user: CampusMintUser | null;
      creator: CreatorSessionProfile | null;
    }
  | {
      ok: true;
      configured: true;
      authenticated: true;
      accountType: "brand";
      capabilities: AccountCapability[];
      canUseCampusTester?: boolean;
      onboardingComplete: boolean;
      brand: BrandSessionProfile | null;
    }
  | {
      ok: true;
      configured: true;
      authenticated: true;
      accountType: "creator";
      capabilities: AccountCapability[];
      canUseCampusTester?: boolean;
      onboardingComplete: boolean;
      creator: CreatorSessionProfile | null;
    }
  | { ok: false; message: string };
