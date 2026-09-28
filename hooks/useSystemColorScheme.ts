"use client";

import { useSyncExternalStore } from "react";

const query = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const preference = window.matchMedia(query);
  preference.addEventListener("change", onChange);
  return () => preference.removeEventListener("change", onChange);
}

/** Hydrates safely, then keeps Colorful's neutral surfaces in sync with the device. */
export function useSystemColorScheme(): "light" | "dark" {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches ? "dark" : "light", () => "light");
}
