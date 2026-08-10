import type { DataChangeEvent } from "@/types/campus-data";

export function createDataChangeEvent(input: Omit<DataChangeEvent, "id" | "occurredAt">): DataChangeEvent {
  return { ...input, id: crypto.randomUUID(), occurredAt: new Date().toISOString() };
}
