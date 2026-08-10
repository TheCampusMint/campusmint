import type { SocialContentStatus } from "@/types/content";

export const personalMintDurationOptions = [
  { hours: null, label: "Permanent" },
  { hours: 24, label: "24 hours" },
  { hours: 48, label: "48 hours" },
  { hours: 72, label: "72 hours" },
  { hours: 96, label: "4 days" },
  { hours: 120, label: "5 days" },
  { hours: 144, label: "6 days" },
  { hours: 168, label: "7 days" },
] as const;

export const storyDurationOptions = [12, 24, 36, 48] as const;
export const EVENT_CONTENT_DURATION_HOURS = 24;
export const MAX_PERSONAL_MINT_DURATION_HOURS = 7 * 24;
export const MAX_STORY_DURATION_HOURS = 48;

export function createExpiresAt(
  createdAt: string,
  durationHours: number | null,
  maximumHours: number,
) {
  if (durationHours === null) return null;
  const safeDuration = Math.max(1, Math.min(durationHours, maximumHours));
  return new Date(new Date(createdAt).getTime() + safeDuration * 60 * 60 * 1000).toISOString();
}

export function isExpired(expiresAt: string | null | undefined, currentTime = Date.now()) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= currentTime);
}

export function resolveContentStatus(
  status: SocialContentStatus,
  expiresAt: string | null | undefined,
  currentTime = Date.now(),
): SocialContentStatus {
  if (status === "active" && isExpired(expiresAt, currentTime)) return "expired";
  return status;
}

export function getTimeRemaining(expiresAt: string | null | undefined, currentTime = Date.now()) {
  if (!expiresAt) return null;
  return Math.max(0, new Date(expiresAt).getTime() - currentTime);
}

export function getExpirationLabel(expiresAt: string | null | undefined, currentTime = Date.now()) {
  if (!expiresAt) return "Permanent";
  const remaining = getTimeRemaining(expiresAt, currentTime) ?? 0;
  if (remaining <= 0) return "Expired";
  const hours = Math.ceil(remaining / (60 * 60 * 1000));
  return hours <= 24 ? `${hours}H` : `${Math.ceil(hours / 24)}D`;
}

export function isActiveContent(
  status: SocialContentStatus,
  expiresAt: string | null | undefined,
  currentTime = Date.now(),
) {
  return resolveContentStatus(status, expiresAt, currentTime) === "active";
}
