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

const lightTokens: AppearanceTokens = {
  background: "#f6f7fa", surface: "#ffffff", surfaceElevated: "#eef1f5",
  textPrimary: "#0f172a", textSecondary: "#64748b", border: "#dce2ea",
  accent: "#334155", accentSoft: "#e2e8f0", accentContrast: "#ffffff",
  colorScheme: "light", ...sharedSemanticTokens,
};

const darkTokens: AppearanceTokens = {
  background: "#0b0e14", surface: "#141922", surfaceElevated: "#1c2330",
  textPrimary: "#f4f7fb", textSecondary: "#a4afbf", border: "#2b3443",
  accent: "#b9c4d2", accentSoft: "#273242", accentContrast: "#10151d",
  colorScheme: "dark", danger: "#fb7185", success: "#34d399",
};

export function getAppearanceTokens(preferences: AppearancePreferences, university: UniversityTheme): AppearanceTokens {
  if (preferences.mode === "light") return lightTokens;
  if (preferences.mode === "dark") return darkTokens;
  if (preferences.mode === "curated") {
    return curatedTints.find((tint) => tint.id === preferences.tint)?.tokens ?? curatedTints[0].tokens;
  }
  return {
    background: `color-mix(in srgb, ${university.accent} 28%, #f6f7fa)`,
    surface: "#ffffff",
    surfaceElevated: `color-mix(in srgb, ${university.accent} 36%, #f3f5f8)`,
    textPrimary: "#0f172a",
    textSecondary: "#64748b",
    border: `color-mix(in srgb, ${university.primary} 14%, #dce2ea)`,
    accent: university.primary,
    accentSoft: university.accent,
    accentContrast: university.secondary,
    colorScheme: "light",
    ...sharedSemanticTokens,
  };
}
