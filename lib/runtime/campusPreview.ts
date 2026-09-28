import type { UniversityId } from "@/data/universities";

/** A test selection belongs to one signed-in session, never to the saved profile. */
export type CampusPreviewSelection = { accountId: string; universityId: UniversityId } | null;

export function resolveCampusPreview(
  selection: CampusPreviewSelection,
  accountId: string,
  homeUniversityId: UniversityId | null,
  permitted: boolean,
): UniversityId | null {
  return permitted && selection?.accountId === accountId && selection.universityId !== homeUniversityId
    ? selection.universityId
    : null;
}

export function campusReadScope(accountId: string, universityId: UniversityId | null = null) {
  return `${accountId}:${universityId ?? "home"}`;
}
