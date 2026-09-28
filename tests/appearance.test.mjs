import assert from "node:assert/strict";
import test from "node:test";
import { getAppearanceCssVariables, getAppearanceTokens } from "../data/appearance.ts";
import { universities } from "../data/universities.ts";
import { defaultAppPreferences, normalizeAppPreferences } from "../hooks/useAppPreferences.ts";

function luminance(hex) {
  const values = hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}

function contrast(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + .05) / (dark + .05);
}

test("Colorful is shared across school and accent choices, and follows device surfaces", () => {
  for (const systemScheme of ["light", "dark"]) {
    const first = getAppearanceTokens({ scheme: "colorful", accentSource: "campus", tint: "forest" }, universities.tamu, systemScheme);
    const second = getAppearanceTokens({ scheme: "colorful", accentSource: "curated", tint: "deep-navy" }, universities.oregon, systemScheme);
    assert.deepEqual(first, second);
    assert.equal(first.colorScheme, systemScheme);
    assert.equal(new Set([first.urgent, first.discovery, first.personal]).size, 3);
    assert.equal(first.accent, first.personal);
    for (const name of ["background", "surface", "surfaceElevated"]) {
      const channels = first[name].slice(1).match(/../g);
      assert.equal(new Set(channels).size, 1, "Colorful surfaces stay neutral");
    }
  }
});

test("every selected accent reaches semantic controls in Light/Dark independently of device mode", () => {
  for (const scheme of ["light", "dark"]) {
    for (const tint of ["slate", "warm-gray", "forest", "deep-navy", "muted-maroon"]) {
      for (const accentSource of ["brand", "campus", "curated"]) {
        const preferences = { scheme, accentSource, tint };
        const colors = getAppearanceTokens(preferences, universities.tamu, "light");
        assert.deepEqual(colors, getAppearanceTokens(preferences, universities.tamu, "dark"));
        for (const meaning of ["urgent", "discovery", "personal"]) {
          assert.equal(colors[meaning], colors.accent);
          assert.equal(colors[`${meaning}Soft`], colors.accentSoft);
          assert.equal(colors[`${meaning}Contrast`], colors.accentContrast);
        }
        assert.notEqual(colors.danger, colors.accent, "actual errors retain their meaning");
      }
    }
  }
});

test("semantic text and filled controls meet normal-text contrast in all appearances", () => {
  for (const scheme of ["light", "dark", "colorful"]) {
    for (const systemScheme of ["light", "dark"]) {
      const colors = getAppearanceTokens({ scheme, accentSource: "curated", tint: "forest" }, universities.tamu, systemScheme);
      for (const meaning of ["accent", "urgent", "discovery", "personal"]) {
        for (const background of [colors.background, colors.surface, colors.surfaceElevated, colors[`${meaning}Soft`], colors[`${meaning}Contrast`]]) {
          assert.ok(contrast(colors[meaning], background) >= 4.5, `${scheme}/${systemScheme} ${meaning} on ${background}`);
        }
      }
    }
  }
});

test("portals and shell receive the same complete semantic CSS variables", () => {
  const colors = getAppearanceTokens({ scheme: "colorful", accentSource: "brand", tint: "slate" }, universities.tamu, "dark");
  const css = getAppearanceCssVariables(colors);
  assert.equal(css["--app-surface-elevated"], colors.surfaceElevated);
  assert.equal(css["--app-urgent"], colors.urgent);
  assert.equal(css["--app-discovery-soft"], colors.discoverySoft);
  assert.equal(css["--app-personal-contrast"], colors.personalContrast);
  assert.equal(Object.keys(css).length, Object.keys(colors).length - 1);
  assert.equal(css["--app-color-scheme"], undefined);
});

test("saved Colorful keeps the previous accent for switching back, with safe legacy migration", () => {
  const original = { ...defaultAppPreferences, appearance: { scheme: "colorful", accentSource: "curated", tint: "forest" } };
  assert.deepEqual(normalizeAppPreferences(JSON.parse(JSON.stringify(original))), original);
  assert.equal(normalizeAppPreferences({ appearance: { mode: "dark" } }).appearance.scheme, "dark");
  assert.equal(normalizeAppPreferences({ appearance: { mode: "dark" } }).appearance.accentSource, "brand");
  assert.equal(normalizeAppPreferences({ appearance: { mode: "curated", tint: "forest" } }).appearance.accentSource, "curated");
  assert.deepEqual(normalizeAppPreferences({ appearance: { scheme: "bogus", accentSource: "invalid", tint: null } }).appearance, defaultAppPreferences.appearance);
  assert.deepEqual(normalizeAppPreferences(null), defaultAppPreferences);
});
