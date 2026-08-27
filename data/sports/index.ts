export * from "./types.ts";
export * from "./conferences.ts";
export * from "./teams.ts";
export * from "./football.ts";
export * from "./basketball.ts";
export * from "./baseball.ts";
export * from "./soccer.ts";
export * from "./track.ts";

export const campusSports = [
  { id: "football", label: "Football" },
  { id: "basketball", label: "Basketball" },
  { id: "baseball", label: "Baseball" },
  { id: "soccer", label: "Soccer" },
  { id: "track", label: "Track" },
] as const;

export type CampusSportId = (typeof campusSports)[number]["id"];
