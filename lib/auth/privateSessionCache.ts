const privateUserKeyPrefixes = [
  "campusmint:private-messages:",
  "campusmint:mint-interactions:",
  "campusmint:mint-feed:",
  "campusmint:notifications:",
] as const;

/** Clears only account-private browser state, preserving appearance and public caches. */
export function clearPrivateSessionCache(
  storage: Pick<Storage, "length" | "key" | "removeItem">,
  userId: string,
) {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => Boolean(key));
  for (const key of keys) {
    if (
      privateUserKeyPrefixes.some((prefix) =>
        key.startsWith(`${prefix}${userId}:`),
      )
    ) {
      storage.removeItem(key);
    }
  }
}
