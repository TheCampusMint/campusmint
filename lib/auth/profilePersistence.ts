import type { CampusMintProfile } from "../../types/profile.ts";
import { validateUsername } from "../social/usernames.ts";

export type EditableProfileValues = Omit<CampusMintProfile, "id" | "accountId" | "createdAt" | "updatedAt">;

const text = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const nullableText = (value: unknown, limit: number) => text(value, limit) || null;
const list = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => text(item, 160)).filter(Boolean))].slice(0, 40)
  : [];

export function profileValuesFromRow(row: Record<string, unknown>): EditableProfileValues {
  const details = row.profile_details && typeof row.profile_details === "object"
    ? row.profile_details as Record<string, unknown>
    : {};
  return {
    firstName: text(row.first_name, 80), lastName: text(row.last_name, 80),
    displayName: text(row.display_name, 160), username: text(row.username, 30),
    usernameNormalized: text(row.username_normalized ?? row.username, 30).toLowerCase(),
    photo: {
      kind: row.profile_photo_placeholder ? "development_placeholder" : "initials",
      storagePath: nullableText(row.profile_photo_storage_path, 1000),
      placeholderId: nullableText(row.profile_photo_placeholder, 80),
    },
    bio: nullableText(row.bio, 1000), major: nullableText(row.major, 160),
    academicArea: nullableText(details.academicArea, 160),
    graduationYear: typeof row.graduation_year === "number" ? row.graduation_year : null,
    classIds: list(details.classIds), clubIds: list(details.clubIds), interests: list(row.interests),
    hobbies: list(details.hobbies), lookingForRoommate: details.lookingForRoommate === true,
    sportsInterests: list(details.sportsInterests),
    roommatePreferences: list(details.roommatePreferences), offersTutoring: details.offersTutoring === true,
    tutoringSubjects: list(details.tutoringSubjects), hometown: nullableText(row.hometown, 160),
    instagram: nullableText(row.instagram, 500), linkedin: nullableText(row.linkedin, 500),
    portfolioUrl: nullableText(row.portfolio_url, 500), personalWebsite: nullableText(row.personal_website, 500),
  };
}

/** Normalize only public, editable fields. Account identity and capabilities never come from this input. */
export function normalizeProfileUpdate(input: Record<string, unknown>) {
  const firstName = text(input.firstName, 80);
  const lastName = text(input.lastName, 80);
  if (!firstName) return { ok: false, message: "First name is required." } as const;
  const username = validateUsername(typeof input.username === "string" ? input.username : "");
  if (!username.valid) return { ok: false, message: username.error } as const;
  const photo = input.photo && typeof input.photo === "object" ? input.photo as Record<string, unknown> : {};
  const update = {
    first_name: firstName, last_name: lastName,
    display_name: text(input.displayName, 160) || [firstName, lastName].filter(Boolean).join(" ").slice(0, 160),
    username: username.normalized,
    bio: nullableText(input.bio, 1000), major: nullableText(input.major, 160),
    graduation_year: typeof input.graduationYear === "number" && Number.isInteger(input.graduationYear) && input.graduationYear >= 1900 && input.graduationYear <= 2200 ? input.graduationYear : null,
    interests: list(input.interests), hometown: nullableText(input.hometown, 160),
    instagram: nullableText(input.instagram, 500), linkedin: nullableText(input.linkedin, 500),
    portfolio_url: nullableText(input.portfolioUrl, 500), personal_website: nullableText(input.personalWebsite, 500),
    profile_photo_storage_path: nullableText(photo.storagePath, 1000),
    profile_photo_placeholder: nullableText(photo.placeholderId, 80),
    profile_details: {
      academicArea: nullableText(input.academicArea, 160), hobbies: list(input.hobbies),
      sportsInterests: list(input.sportsInterests),
      classIds: list(input.classIds), clubIds: list(input.clubIds),
      lookingForRoommate: input.lookingForRoommate === true, roommatePreferences: list(input.roommatePreferences),
      offersTutoring: input.offersTutoring === true, tutoringSubjects: list(input.tutoringSubjects),
    },
  };
  return { ok: true, update } as const;
}

export async function persistProfile(values: EditableProfileValues, request: typeof fetch = fetch) {
  try {
    const response = await request("/api/account/profile", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
    });
    const result = await response.json() as { ok?: boolean; message?: string; profile?: EditableProfileValues };
    if (!response.ok || !result.ok || !result.profile) {
      return { ok: false, error: result.message ?? "We couldn't save your profile. Please try again." } as const;
    }
    return { ok: true, profile: result.profile } as const;
  } catch {
    return { ok: false, error: "We couldn't reach Campus Mint. Your changes are still here; try saving again." } as const;
  }
}
