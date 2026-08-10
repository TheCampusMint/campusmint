import type { MarketplaceCategory } from "@/types/marketplace";

export const prohibitedMarketplaceItems = [
  { id: "weapons", label: "Weapons", terms: ["weapon", "firearm", "gun", "knife"] },
  { id: "illegal-drugs", label: "Illegal drugs", terms: ["illegal drug", "cocaine", "methamphetamine"] },
  { id: "prescription-drugs", label: "Prescription drugs", terms: ["prescription", "adderall", "xanax"] },
  { id: "alcohol", label: "Alcohol", terms: ["alcohol", "beer", "liquor", "wine"] },
  { id: "nicotine", label: "Nicotine or vapes", terms: ["vape", "nicotine", "cigarette"] },
  { id: "stolen-property", label: "Stolen property", terms: ["stolen", "no serial number"] },
  { id: "counterfeit", label: "Counterfeit items", terms: ["counterfeit", "fake designer", "replica id"] },
  { id: "fraudulent-tickets", label: "Fraudulent tickets", terms: ["fake ticket", "bypass transfer", "screenshot ticket"] },
  { id: "academic-cheating", label: "Academic cheating services", terms: ["do my homework", "take my exam", "write my essay", "complete assignment"] },
  { id: "fake-ids", label: "Fake IDs", terms: ["fake id", "novelty id"] },
  { id: "unsafe-goods", label: "Unsafe or illegal goods", terms: ["illegal goods", "explosive"] },
] as const;

export type MarketplaceSafetyResult = {
  allowed: boolean;
  matchedRule: string | null;
  message: string | null;
};

export function checkMarketplaceListingSafety(title: string, description: string, category: MarketplaceCategory): MarketplaceSafetyResult {
  const normalized = `${title} ${description}`.toLowerCase();
  const match = prohibitedMarketplaceItems.find((rule) => rule.terms.some((term) => normalized.includes(term)));
  if (match) {
    return { allowed: false, matchedRule: match.id, message: `${match.label} are not permitted in Campus Mint Marketplace.` };
  }
  if (category === "Services" && /homework|exam|assignment|essay/.test(normalized)) {
    return { allowed: false, matchedRule: "academic-cheating", message: "Services cannot involve completing academic work for another student." };
  }
  return { allowed: true, matchedRule: null, message: null };
}
