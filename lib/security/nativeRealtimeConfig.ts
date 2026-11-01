/** Only client-safe connection information can cross the native config boundary. */
export function nativeRealtimeConfig(config: { url: string; publishableKey: string } | null) {
  if (!config) return null;
  try {
    const url = new URL(config.url);
    if (url.protocol !== "https:" || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) ||
        url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/") return null;
    const key = config.publishableKey;
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
      const parts = key.split(".");
      if (parts.length !== 3 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return null;
      // This is a leak-prevention check, not JWT authentication. The server verifies credentials.
      const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      if (claims.role !== "anon" || claims.iss !== "supabase" || claims.ref !== url.hostname.split(".")[0]) return null;
    }
    return { url: url.origin, publishableKey: key };
  } catch { return null; }
}
