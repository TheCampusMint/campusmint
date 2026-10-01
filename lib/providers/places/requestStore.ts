/** In-memory UI state only: never serialize provider content to browser storage. */
export function createSessionRequestStore() {
  const requests = new Map<string, Promise<unknown>>();
  return {
    get<T>(key: string, load: () => Promise<T>): Promise<T> {
      const existing = requests.get(key);
      if (existing) return existing as Promise<T>;
      const pending = Promise.resolve().then(load);
      // Retain success AND failure until explicit retry. Remounting cannot cause a retry storm.
      requests.set(key, pending);
      return pending;
    },
    invalidate(prefix: string) {
      for (const key of requests.keys()) if (key.startsWith(prefix)) requests.delete(key);
    },
    clear() { requests.clear(); },
  };
}

/** Server deduplication retains only a running request, never completed Google data. */
export function createSingleFlight() {
  const pending = new Map<string, Promise<unknown>>();
  return function singleFlight<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = pending.get(key);
    if (existing) return existing as Promise<T>;
    const task = Promise.resolve().then(load).finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  };
}
