import type { UniversityTheme } from "@/data/universities";
import type { AppearancePreferences, CuratedTintId, SurfaceScheme } from "@/types/preferences";

type SurfaceTokens = {
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

export type AppearanceTokens = SurfaceTokens & {
  urgent: string;
  urgentSoft: string;
  urgentContrast: string;
  discovery: string;
  discoverySoft: string;
  discoveryContrast: string;
  personal: string;
  personalSoft: string;
  personalContrast: string;
};

export type CuratedTint = {
  id: CuratedTintId;
  label: string;
  preview: string;
  tokens: SurfaceTokens;
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

export const campusMintLightTokens: SurfaceTokens = {
  background: "#fafafa", surface: "#ffffff", surfaceElevated: "#f0f0f0",
  textPrimary: "#171717", textSecondary: "#595959", border: "#cccccc",
  accent: campusMintBrand.maroon, accentSoft: campusMintBrand.maroonSoft, accentContrast: "#fffaf9",
  colorScheme: "light", ...sharedSemanticTokens,
};

export const campusMintDarkTokens: SurfaceTokens = {
  background: "#0a0a0a", surface: "#141414", surfaceElevated: "#242424",
  textPrimary: "#fafafa", textSecondary: "#bcbcbc", border: "#484848",
  accent: "#d37a8c", accentSoft: "#42242b", accentContrast: "#1c1114",
  colorScheme: "dark", danger: "#fb7185", success: "#34d399",
};

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function mixHex(foreground: string, background: string, foregroundWeight: number) {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) return foreground;
  const channel = (a: number, b: number) =>
    Math.round(a * foregroundWeight + b * (1 - foregroundWeight))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(fg.r, bg.r)}${channel(fg.g, bg.g)}${channel(fg.b, bg.b)}`;
}

function relativeLuminance(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const linear = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)]
    .sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function readableAccent(accent: string, background: string, scheme: "light" | "dark") {
  let result = accent;
  const target = scheme === "dark" ? "#ffffff" : "#000000";
  for (let index = 0; index < 8 && contrastRatio(result, background) < 4.5; index += 1) {
    result = mixHex(result, target, 0.82);
  }
  return result;
}

function semanticColor(color: string, base: SurfaceTokens) {
  const foreground = readableAccent(color, base.surfaceElevated, base.colorScheme);
  let weight = base.colorScheme === "dark" ? 0.22 : 0.1;
  let soft = mixHex(foreground, base.background, weight);
  while (contrastRatio(foreground, soft) < 4.5 && weight > 0.02) {
    weight -= 0.02;
    soft = mixHex(foreground, base.background, weight);
  }
  return {
    foreground,
    soft,
    contrast: contrastRatio(foreground, "#111111") >= contrastRatio(foreground, "#ffffff") ? "#111111" : "#ffffff",
  };
}

/** One shared Colorful palette. Hue indicates meaning, never identity or permission. */
export const colorfulPalette = {
  light: { urgent: "#b74346", discovery: "#a85a20", personal: "#287650" },
  dark: { urgent: "#ee9697", discovery: "#e8ad78", personal: "#79c39d" },
} as const;

export function getAppearanceTokens(preferences: AppearancePreferences, university: UniversityTheme, systemScheme: SurfaceScheme = "light"): AppearanceTokens {
  const scheme = preferences.scheme === "colorful" ? systemScheme : preferences.scheme;
  const base = scheme === "dark"
    ? campusMintDarkTokens
    : campusMintLightTokens;
  const configuredAccent = preferences.scheme === "colorful"
    ? colorfulPalette[scheme].personal
    : preferences.accentSource === "campus"
    ? university.primary
    : preferences.accentSource === "curated"
      ? (curatedTints.find((tint) => tint.id === preferences.tint) ?? curatedTints[0]).preview
      : base.accent;
  const accent = semanticColor(configuredAccent, base);
  const colors = preferences.scheme === "colorful" ? colorfulPalette[scheme] : {
    urgent: configuredAccent, discovery: configuredAccent, personal: configuredAccent,
  };
  const urgent = semanticColor(colors.urgent, base);
  const discovery = semanticColor(colors.discovery, base);
  const personal = semanticColor(colors.personal, base);

  return {
    ...base,
    accent: accent.foreground,
    accentSoft: accent.soft,
    accentContrast: accent.contrast,
    urgent: urgent.foreground, urgentSoft: urgent.soft, urgentContrast: urgent.contrast,
    discovery: discovery.foreground, discoverySoft: discovery.soft, discoveryContrast: discovery.contrast,
    personal: personal.foreground, personalSoft: personal.soft, personalContrast: personal.contrast,
  };
}

/** Used by both the shell and document root so portaled composers share the palette. */
export function getAppearanceCssVariables(tokens: AppearanceTokens) {
  return Object.fromEntries(Object.entries(tokens)
    .filter(([name]) => name !== "colorScheme")
    .map(([name, value]) => [`--app-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value]));
}
