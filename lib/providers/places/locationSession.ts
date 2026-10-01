import type { Coordinates } from "../../discovery/nearby";
export type NearbyLocationSnapshot = { userId: string; position: Coordinates | null; revision: number };
let snapshot: NearbyLocationSnapshot | null = null;
let generation = 0;
export function clearNearbyLocationSession() { snapshot = null; generation++; }
export function nearbyLocationGeneration() { return generation; }
export function readNearbyLocationSession(userId: string) { return snapshot?.userId === userId ? snapshot : { userId, position: null, revision: 0 }; }
export function writeNearbyLocationSession(next: NearbyLocationSnapshot, expectedGeneration: number) {
  if (generation !== expectedGeneration) return false;
  snapshot = next;
  return true;
}
