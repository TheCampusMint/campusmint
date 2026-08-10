import type { CampusMintUser } from "@/types/profile";

const reservedUsernames = new Set([
  "admin",
  "administrator",
  "campusmint",
  "campus_mint",
  "help",
  "moderator",
  "official",
  "security",
  "support",
  "system",
]);

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export function normalizeUsername(username: string) {
  return username.trim().toLocaleLowerCase();
}

export function validateUsername(username: string) {
  const normalized = normalizeUsername(username);
  if (normalized.length < USERNAME_MIN_LENGTH || normalized.length > USERNAME_MAX_LENGTH) {
    return { valid: false, normalized, error: `Use ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.` } as const;
  }
  if (!/^[a-z0-9._]+$/.test(normalized)) {
    return { valid: false, normalized, error: "Use only letters, numbers, underscores, and periods." } as const;
  }
  if (normalized.startsWith(".") || normalized.endsWith(".") || normalized.includes("..")) {
    return { valid: false, normalized, error: "Periods cannot be first, last, or repeated." } as const;
  }
  if (reservedUsernames.has(normalized)) {
    return { valid: false, normalized, error: "That username is reserved." } as const;
  }
  return { valid: true, normalized, error: null } as const;
}

export function isUsernameAvailable(username: string, users: CampusMintUser[], exceptUserId?: string) {
  const validation = validateUsername(username);
  if (!validation.valid) return validation;
  const duplicate = users.some((user) =>
    user.account.id !== exceptUserId && user.profile.usernameNormalized === validation.normalized);
  return duplicate
    ? { valid: false, normalized: validation.normalized, error: "That username is already in use." } as const
    : validation;
}
