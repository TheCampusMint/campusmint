"use client";
import { createSessionRequestStore } from "./requestStore.ts";
let owner: string | null = null;
const store = createSessionRequestStore();
/** Only live page-session UI state; nothing enters local/session storage or IndexedDB. */
export function clearPlacesSession() { owner = null; store.clear(); }
function forOwner(userId: string) {
  if (owner !== userId) { store.clear(); owner = userId; }
  return store;
}
export function requestPlaceSession<T>(userId: string, key: string, load: () => Promise<T>) { return forOwner(userId).get(key, load); }
export function refreshPlaceSession(userId: string, prefix: string) { forOwner(userId).invalidate(prefix); }
export async function fetchPlaceJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "Unavailable. Try again.");
  return data as T;
}
