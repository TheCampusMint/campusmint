import type { UniversityTheme } from "@/data/universities";
import type { AppearancePreferences, CuratedTintId } from "@/types/preferences";

export type AppearanceTokens = {
  background: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  accent: string;
  accentSoft: string;
  accentContrast: string;
  danger: string;
  success: string;
  colorScheme: "light" | "dark";
};

export type CuratedTint = {
  id: CuratedTintId;
  label: string;
  preview: string;
  tokens: AppearanceTokens;
};

const sharedSemanticTokens = {
  danger: "#be123c",
  success: "#047857",
} as const;

/** Campus Mint product chrome. Campus/team colors remain separate data tokens. */
export const campusMintBrand = {
  maroon: "#6f1d2c",
  maroonStrong: "#511320",
  maroonSoft: "#f0dfe3",
  warmBackground: "#f8f3f2",
  warmSurface: "#fffaf9",
  warmRaised: "#f3e9e8",
  ink: "#2a171b",
  mutedInk: "#725d63",
  border: "#dfced1",
} as const;

export const curatedTints: CuratedTint[] = [
  {
    id: "slate",
    label: "Slate",
    preview: "#526074",
    tokens: {
      background: "#eef1f5", surface: "#f9fafb", surfaceElevated: "#e4e9f0",
      textPrimary: "#152033", textSecondary: "#5c6879", border: "#cbd3df",
      accent: "#526074", accentSoft: "#dfe5ec", accentContrast: "#ffffff",
      colorScheme: "light", ...sharedSemanticTokens,
    },
  },
  {
    id: "warm-gray",
    label: "Warm Gray",
    preview: "#716963",
    tokens: {
      background: "#f1efec", surface: "#fbfaf8", surfaceElevated: "#e9e5e0",
      textPrimary: "#272321", textSecondary: "#6c625c", border: "#d8d1ca",
      accent: "#716963", accentSoft: "#e7e1dc", accentContrast: "#ffffff",
      colorScheme: "light", ...sharedSemanticTokens,
    },
  },
  {
    id: "forest",
    label: "Forest",
    preview: "#315c49",
    tokens: {
      background: "#edf2ef", surface: "#fafcfb", surfaceElevated: "#e0e9e4",
      textPrimary: "#14251d", textSecondary: "#53685e", border: "#c8d7cf",
      accent: "#315c49", accentSoft: "#dbe9e1", accentContrast: "#ffffff",
      colorScheme: "light", ...sharedSemanticTokens,
    },
  },
  {
    id: "deep-navy",
    label: "Deep Navy",
    preview: "#23395b",
    tokens: {
      background: "#edf0f5", surface: "#fafbfc", surfaceElevated: "#dfe5ee",
      textPrimary: "#111d30", textSecondary: "#566276", border: "#c8d1df",
      accent: "#23395b", accentSoft: "#dbe3ef", accentContrast: "#ffffff",
      colorScheme: "light", ...sharedSemanticTokens,
    },
  },
  {
    id: "muted-maroon",
    label: "Muted Maroon",
    preview: "#744052",
    tokens: {
      background: "#f2edef", surface: "#fcfafb", surfaceElevated: "#eadfe3",
      textPrimary: "#2a1820", textSecondary: "#705864", border: "#dccbd2",
      accent: "#744052", accentSoft: "#eadde2", accentContrast: "#ffffff",
      colorScheme: "light", ...sharedSemanticTokens,
    },
  },
];

export const campusMintLightTokens: AppearanceTokens = {
  background: campusMintBrand.warmBackground, surface: campusMintBrand.warmSurface, surfaceElevated: campusMintBrand.warmRaised,
  textPrimary: campusMintBrand.ink, textSecondary: campusMintBrand.mutedInk, border: campusMintBrand.border,
  accent: campusMintBrand.maroon, accentSoft: campusMintBrand.maroonSoft, accentContrast: "#fffaf9",
  colorScheme: "light", ...sharedSemanticTokens,
};

export const campusMintDarkTokens: AppearanceTokens = {
  background: "#160f11", surface: "#211719", surfaceElevated: "#2d2023",
  textPrimary: "#fff8f6", textSecondary: "#cbb9bd", border: "#49363a",
  accent: "#d37a8c", accentSoft: "#42242b", accentContrast: "#1c1114",
  colorScheme: "dark", danger: "#fb7185", success: "#34d399",
};

export function getAppearanceTokens(preferences: AppearancePreferences, university: UniversityTheme): AppearanceTokens {
  if (preferences.mode === "light") return campusMintLightTokens;
  if (preferences.mode === "dark") return campusMintDarkTokens;
  if (preferences.mode === "curated") {
    return curatedTints.find((tint) => tint.id === preferences.tint)?.tokens ?? curatedTints[0].tokens;
  }
  void university;
  return campusMintLightTokens;
}
