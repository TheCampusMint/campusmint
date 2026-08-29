"use client";

import { useEffect, useState } from "react";

export function useReducedMotion(explicitPreference = false) {
  const [systemPreference, setSystemPreference] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemPreference(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return explicitPreference || systemPreference;
}
