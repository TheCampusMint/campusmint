export const dailyNavigation = [
  { id: "messages", label: "Messages", icon: "✉" },
  { id: "mint", label: "Mint", icon: "M" },
] as const;

export const secondaryNavigation = [
  { id: "sports", label: "Sports", icon: "S" },
  { id: "groups", label: "Groups", icon: "◎" },
] as const;

export const primaryNavigation = [
  ...dailyNavigation,
  ...secondaryNavigation,
] as const;

export const createMintAction = {
  id: "create-mint",
  label: "Create Mint",
} as const;

const createMintSlotIndex = Math.ceil(primaryNavigation.length / 2);

export const bottomNavigationSlots = [
  ...primaryNavigation.slice(0, createMintSlotIndex).map((item) => ({
    kind: "section" as const,
    item,
  })),
  { kind: "action" as const, action: createMintAction },
  ...primaryNavigation.slice(createMintSlotIndex).map((item) => ({
    kind: "section" as const,
    item,
  })),
] as const;

export type SwipeSection =
  | (typeof dailyNavigation)[number]["id"]
  | (typeof secondaryNavigation)[number]["id"];

export type PrimarySection = SwipeSection | "profile";

const legacySearchSectionIds = [
  "search",
  "people",
  "housing",
  "food",
  "tutoring",
  "clubs",
  "events",
  "marketplace",
] as const;

export function isSwipeSection(value: string): value is SwipeSection {
  return primaryNavigation.some(
    (item) => item.id === value,
  );
}

export function getPrimaryNavigationIndex(section: SwipeSection) {
  return primaryNavigation.findIndex((item) => item.id === section);
}

export function getBottomNavigationSlotIndex(section: SwipeSection) {
  return bottomNavigationSlots.findIndex(
    (slot) => slot.kind === "section" && slot.item.id === section,
  );
}

/**
 * Keeps saved navigation from older discovery-tab builds safe without
 * clearing any unrelated local settings.
 */
export function migrateStoredPrimarySection(
  value: string | null,
  fallback: SwipeSection = "mint",
): SwipeSection {
  if (!value) return fallback;
  if (isSwipeSection(value)) return value;

  if (legacySearchSectionIds.some((section) => section === value)) {
    return fallback;
  }

  return fallback;
}
