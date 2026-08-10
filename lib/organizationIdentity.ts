import type { OrganizationRecordStatus, OrganizationSubmission } from "../types/organization.ts";

export type OrganizationIdentityRecord = {
  id: string;
  universityId: string;
  name: string;
  normalizedName?: string;
  handle: string;
  recordStatus: OrganizationRecordStatus;
};

export type OrganizationNameConflict = {
  record: OrganizationIdentityRecord;
  match: "exact" | "near";
  resolution: "open_existing" | "pending_review" | "request_reactivation";
};

export type OrganizationSubmissionResult =
  | { ok: true; submission: OrganizationSubmission }
  | { ok: false; reason: "invalid_name" | "invalid_handle" }
  | { ok: false; reason: "name_conflict"; conflict: OrganizationNameConflict }
  | { ok: false; reason: "handle_conflict"; record: OrganizationIdentityRecord };

const genericOrganizationWords = new Set([
  "association",
  "chapter",
  "circle",
  "club",
  "collective",
  "crew",
  "development",
  "example",
  "group",
  "guild",
  "network",
  "organization",
  "society",
  "student",
  "students",
  "the",
]);

const universityNamePrefixes: Record<string, string[]> = {
  tamu: ["texas a and m university", "texas a m university", "texas a and m", "texas a m", "tamu"],
  blinn: ["blinn college", "blinn"],
  texas: ["the university of texas at austin", "university of texas at austin", "ut austin", "texas"],
  lsu: ["louisiana state university", "louisiana state", "lsu"],
  alabama: ["the university of alabama", "university of alabama", "alabama"],
};

export function normalizeOrganizationWords(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Compact comparison key prevents case, whitespace, and punctuation bypasses. */
export function normalizeOrganizationName(value: string) {
  return normalizeOrganizationWords(value).replace(/\s+/g, "");
}

export function normalizeOrganizationHandle(value: string) {
  return normalizeOrganizationWords(value)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
    .replace(/-$/g, "");
}

function withoutUniversityPrefix(universityId: string, words: string) {
  const prefix = (universityNamePrefixes[universityId] ?? [])
    .find((candidate) => words === candidate || words.startsWith(`${candidate} `));
  return prefix ? words.slice(prefix.length).trim() : words;
}

export function suggestOrganizationHandle(universityId: string, displayName: string) {
  const words = withoutUniversityPrefix(universityId, normalizeOrganizationWords(displayName));
  const tokens = words.split(" ").filter(Boolean);
  while (tokens.length > 1 && genericOrganizationWords.has(tokens[tokens.length - 1])) tokens.pop();
  const base = normalizeOrganizationHandle(tokens.join(" ")) || "club";
  return normalizeOrganizationHandle(`${universityId}-${base}`);
}

export function isValidOrganizationHandle(handle: string) {
  return handle.length >= 3
    && handle.length <= 64
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(handle);
}

function comparisonCore(universityId: string, name: string) {
  const words = withoutUniversityPrefix(universityId, normalizeOrganizationWords(name));
  return words.split(" ").filter((word) => word && !genericOrganizationWords.has(word));
}

function levenshteinDistance(first: string, second: string) {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = [firstIndex];
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      current[secondIndex] = Math.min(
        current[secondIndex - 1] + 1,
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[second.length];
}

export function areNearDuplicateOrganizationNames(universityId: string, first: string, second: string) {
  const firstNormalized = normalizeOrganizationName(first);
  const secondNormalized = normalizeOrganizationName(second);
  if (!firstNormalized || !secondNormalized || firstNormalized === secondNormalized) return false;

  const firstCore = comparisonCore(universityId, first);
  const secondCore = comparisonCore(universityId, second);
  const firstCoreKey = firstCore.join("");
  const secondCoreKey = secondCore.join("");
  if (firstCoreKey.length >= 4 && firstCoreKey === secondCoreKey) return true;

  const maximumLength = Math.max(firstNormalized.length, secondNormalized.length);
  if (maximumLength >= 8) {
    const similarity = 1 - levenshteinDistance(firstNormalized, secondNormalized) / maximumLength;
    if (similarity >= 0.9) return true;
  }

  const firstTerms = new Set(firstCore);
  const secondTerms = new Set(secondCore);
  const intersection = [...firstTerms].filter((term) => secondTerms.has(term)).length;
  const union = new Set([...firstTerms, ...secondTerms]).size;
  return intersection > 0 && union > 0 && intersection / union >= 0.8;
}

export function findOrganizationNameConflict(
  universityId: string,
  requestedName: string,
  records: OrganizationIdentityRecord[],
): OrganizationNameConflict | null {
  const requestedNormalized = normalizeOrganizationName(requestedName);
  if (!requestedNormalized) return null;
  const priority: Record<OrganizationRecordStatus, number> = { active: 0, pending: 1, archived: 2, inactive: 3 };
  const sameUniversity = records
    .filter((record) => record.universityId === universityId)
    .sort((first, second) => priority[first.recordStatus] - priority[second.recordStatus]);
  const exact = sameUniversity.find((record) =>
    (record.normalizedName ?? normalizeOrganizationName(record.name)) === requestedNormalized,
  );
  const record = exact ?? sameUniversity.find((candidate) =>
    areNearDuplicateOrganizationNames(universityId, requestedName, candidate.name),
  );
  if (!record) return null;
  return {
    record,
    match: exact ? "exact" : "near",
    resolution: record.recordStatus === "archived" || record.recordStatus === "inactive"
      ? "request_reactivation"
      : record.recordStatus === "pending" ? "pending_review" : "open_existing",
  };
}

export function findOrganizationHandleConflict(
  requestedHandle: string,
  records: OrganizationIdentityRecord[],
) {
  const normalized = normalizeOrganizationHandle(requestedHandle);
  return records.find((record) => normalizeOrganizationHandle(record.handle) === normalized) ?? null;
}
