import type { DataSource } from "@/types/campus-data";

export type SyncEntityType =
  | "academic_program"
  | "course"
  | "academic_term"
  | "instructor"
  | "course_section"
  | "organization"
  | "campus_entity";

export type NormalizedIncomingRecord = {
  entityType: SyncEntityType;
  universityId: string;
  externalId: string;
  payload: Record<string, unknown>;
  fingerprint: string;
};

export type SourceAdapter = {
  key: string;
  load(source: DataSource): Promise<NormalizedIncomingRecord[]>;
};

export type SyncSummary = {
  sourceId: string;
  mode: "dry-run" | "persisted";
  created: number;
  updated: number;
  unchanged: number;
  archived: number;
  message: string;
};
