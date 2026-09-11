export const accountTypes = ["student", "brand", "system"] as const;

export type AccountType = (typeof accountTypes)[number];
export type CampusMintAccountType = AccountType;
export type SignupAccountType = Exclude<AccountType, "system">;

export const brandVerificationStatuses = [
  "unverified",
  "pending",
  "verified",
  "rejected",
] as const;

export type BrandVerificationStatus =
  (typeof brandVerificationStatuses)[number];

export function isSignupAccountType(value: unknown): value is SignupAccountType {
  return value === "student" || value === "brand";
}

export function normalizeAuthEmail(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function isValidBrandEmail(value: string) {
  const email = normalizeAuthEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function normalizeSafeBrandWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return null;
  }
}
