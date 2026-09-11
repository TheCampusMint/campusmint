import type { CampusMintUser } from "@/types/profile";

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

export type AccountSessionResponse =
  | { ok: true; configured: boolean; authenticated: false }
  | {
      ok: true;
      configured: true;
      authenticated: true;
      accountType: "student";
      onboardingComplete: boolean;
      user: CampusMintUser | null;
    }
  | {
      ok: true;
      configured: true;
      authenticated: true;
      accountType: "brand";
      onboardingComplete: boolean;
      brand: BrandSessionProfile | null;
    }
  | { ok: false; message: string };
