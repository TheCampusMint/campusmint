"use client";

import { createContext, useContext } from "react";

/** Cosmetic preview mode never grants authorization; APIs use the real session. */
export const CampusPreviewContext = createContext(false);

export function useCampusPreview() {
  return useContext(CampusPreviewContext);
}
