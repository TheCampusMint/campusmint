export const dailyNavigation = [
  { id: "messages", label: "Messages", icon: "✉" },
  { id: "search", label: "Search", icon: "⌕" },
  { id: "mint", label: "Mint", icon: "M" },
  { id: "people", label: "People", icon: "◉" },
  { id: "clubs", label: "Clubs", icon: "♣" },
] as const;

export const secondaryNavigation = [
  { id: "career", label: "Career", icon: "↗" },
  { id: "housing", label: "Housing", icon: "⌂" },
  { id: "groups", label: "Groups", icon: "◎" },
  { id: "food", label: "Food", icon: "◒" },
  { id: "marketplace", label: "Market", icon: "◇" },
] as const;

export const navigationSets = [dailyNavigation, secondaryNavigation] as const;

export type PrimarySection =
  | (typeof dailyNavigation)[number]["id"]
  | (typeof secondaryNavigation)[number]["id"]
  | "profile";

