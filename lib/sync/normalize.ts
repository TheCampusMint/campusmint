import "server-only";

import { createHash } from "node:crypto";

import type { NormalizedIncomingRecord, SyncEntityType } from "@/lib/sync/types";

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function normalizeIncomingRecord(
  entityType: SyncEntityType,
  universityId: string,
  externalId: string,
  payload: object,
): NormalizedIncomingRecord {
  const normalizedPayload = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  return {
    entityType,
    universityId,
    externalId: externalId.trim(),
    payload: normalizedPayload,
    fingerprint: createHash("sha256").update(stableJson(normalizedPayload)).digest("hex"),
  };
}
