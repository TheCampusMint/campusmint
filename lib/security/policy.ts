export type ApiPolicy = { name: string; auth: boolean; limit: number; window: number; accountLimit: number; cron?: boolean };

export function apiPolicy(path: string, method: string): ApiPolicy {
  if (/^\/api\/(?:mintz\/cleanup|events\/refresh|sports\/refresh|campus-data\/sync|security\/cleanup)$/.test(path)) {
    return { name: "scheduled", auth: false, limit: 12, accountLimit: 12, window: 60, cron: true };
  }
  if (path === "/api/student-verification/request") return { name: "otp.request", auth: false, limit: 8, accountLimit: 4, window: 600 };
  if (path === "/api/student-verification/verify") return { name: "otp.verify", auth: false, limit: 30, accountLimit: 10, window: 600 };
  if (path === "/api/native/session/refresh") return { name: "session.refresh", auth: false, limit: 60, accountLimit: 30, window: 600 };
  if (path === "/api/native/config") return { name: "native.config", auth: false, limit: 120, accountLimit: 120, window: 60 };
  if (path === "/api/account/me") return { name: "account.session", auth: false, limit: 240, accountLimit: 120, window: 60 };
  if (path === "/api/account/logout") return { name: "account.logout", auth: false, limit: 60, accountLimit: 30, window: 60 };
  if (path.startsWith("/api/native/apple/")) return { name: "apple.auth", auth: path.endsWith("/link"), limit: 20, accountLimit: 10, window: 600 };
  if (path === "/api/native/attest/register") return { name: "attest.register", auth: true, limit: 40, accountLimit: 10, window: 600 };
  if (path.startsWith("/api/native/attest/")) return { name: "attest.challenge", auth: true, limit: 240, accountLimit: 120, window: 60 };
  if (path.startsWith("/api/admin/")) return { name: "admin", auth: true, limit: 40, accountLimit: 20, window: 60 };
  if (path.startsWith("/api/places/") || path.startsWith("/api/discovery/")) {
    const photo = /\/photo$/.test(path);
    const search = /\/(?:search|nearby)$/.test(path);
    return { name: photo ? "places.photo" : search ? "places.search" : "places.details", auth: true, limit: photo ? 120 : 60, accountLimit: photo ? 40 : search ? 12 : 30, window: 60 };
  }
  if (method === "GET" || method === "HEAD") return { name: "api.read", auth: !["/api/events", "/api/sports"].includes(path), limit: 300, accountLimit: 180, window: 60 };
  return { name: path === "/api/mintz" ? "post.write" : "api.write", auth: true, limit: 120, accountLimit: path === "/api/mintz" ? 30 : 60, window: 60 };
}

export function validMutationOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  if (request.headers.has("authorization")) return /^Bearer [A-Za-z0-9._~-]+$/.test(request.headers.get("authorization") ?? "");
  const origin = request.headers.get("origin");
  // Native/no-cookie server clients may omit Origin; browsers cannot omit it
  // while supplying cookies through this path to perform a cross-site mutation.
  if (!origin) return !request.headers.has("cookie") && request.headers.get("sec-fetch-site") !== "cross-site";
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
