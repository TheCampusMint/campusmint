/** One transport per account, shared only while that account has listeners. */
export function createInvalidationHub(connect: (accountId: string, invalidate: () => void) => () => void) {
  const accounts = new Map<string, { listeners: Set<() => void>; disconnect: () => void }>();
  return {
    subscribe(accountId: string, listener: () => void) {
      let entry = accounts.get(accountId);
      if (!entry) {
        entry = { listeners: new Set(), disconnect: () => {} };
        accounts.set(accountId, entry);
        const active = entry;
        // Some transports notify synchronously during connection.
        active.listeners.add(listener);
        active.disconnect = connect(accountId, () => {
          if (accounts.get(accountId) !== active) return;
          for (const notify of [...active.listeners]) notify();
        });
      } else {
        entry.listeners.add(listener);
      }
      const subscribed = entry;
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        subscribed.listeners.delete(listener);
        if (subscribed.listeners.size === 0 && accounts.get(accountId) === subscribed) {
          accounts.delete(accountId);
          subscribed.disconnect();
        }
      };
    },
  };
}

/** Coalesce bursts, but never drop invalidation that arrives during a read. */
export function createRefreshQueue(read: () => Promise<void>) {
  let pending = false;
  let running: Promise<void> | null = null;
  let disposed = false;
  return {
    request(): Promise<void> {
      if (disposed) return Promise.resolve();
      pending = true;
      if (!running) {
        // Start in a microtask so synchronous requests share the same promise.
        running = Promise.resolve().then(async () => {
          try {
            while (pending && !disposed) {
              pending = false;
              await read();
            }
          } finally {
            running = null;
          }
        });
      }
      return running;
    },
    dispose() { disposed = true; pending = false; },
  };
}
