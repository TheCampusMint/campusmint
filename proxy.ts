import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiPolicy, validMutationOrigin } from "@/lib/security/policy";
import { auditSecurityEvent, consumeRateLimit, validCronSecret } from "@/lib/security/server";
import { attestConfiguration } from "@/lib/security/attestPayload";
import { verifyRequestAssertion } from "@/lib/security/appAttest";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const requestId = randomUUID();
  const deny = (status: number, message: string, retry?: number) => NextResponse.json({ ok: false, message, requestId }, {
    status, headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId, ...(retry ? { "Retry-After": String(retry) } : {}) },
  });
  let response = NextResponse.next({ request });
  if (!url || !publishableKey) return isApi ? deny(503, "Service unavailable.") : response;
  const policy = apiPolicy(request.nextUrl.pathname, request.method);
  if (isApi && policy.cron) {
    if (!validCronSecret(request)) return deny(401, "Unauthorized.");
    return response;
  }
  if (isApi && !validMutationOrigin(request)) return deny(403, "Request origin is not allowed.");
  const authorization = request.headers.get("authorization");
  if (isApi && authorization && (!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization) || authorization.length > 8192)) return deny(401, "Invalid session.");
  const supabase = authorization && isApi
    ? createClient(url, publishableKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    : createServerClient(url, publishableKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
  if (!isApi) { await supabase.auth.getClaims(); return response; }
  try {
    // Only Vercel's overwritten ingress header is trusted. Outside that ingress,
    // share one bucket rather than trusting spoofable X-Forwarded-For values.
    const address = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() ?? "unknown" : "non-vercel-ingress";
    const ipLimit = await consumeRateLimit(policy.name, `ip:${address}`, policy.limit, policy.window);
    if (!ipLimit.allowed) return deny(429, "Please wait before trying again.", ipLimit.retryAfter);
    const { data: { user } } = policy.auth || authorization || policy.name.startsWith("account.") ? await supabase.auth.getUser() : { data: { user: null } };
    if (policy.auth && !user) return deny(401, "Sign in again.");
    if (user) {
      const limit = await consumeRateLimit(policy.name, `user:${user.id}`, policy.accountLimit, policy.window);
      if (!limit.allowed) { await auditSecurityEvent(policy.name, "denied", user.id, requestId); return deny(429, "Please wait before trying again.", limit.retryAfter); }
      const attest = attestConfiguration(process.env);
      const submittedProof = request.headers.has("x-app-attest-assertion");
      if ((attest.required || submittedProof) && !["GET", "HEAD", "OPTIONS"].includes(request.method) && !request.nextUrl.pathname.startsWith("/api/native/attest/") && request.nextUrl.pathname !== "/api/account/logout") {
        const claims = await supabase.auth.getClaims(authorization?.replace(/^Bearer /, ""));
        const sessionId = claims.data?.claims.session_id;
        if (claims.error || typeof sessionId !== "string") return deny(401, "Invalid session.");
        const native = await createSupabaseAdminClient().from("native_auth_sessions").select("session_id").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle();
        if (native.error) throw new Error("Native session check unavailable.");
        if (submittedProof || (attest.required && (authorization || native.data))) {
          if (!attest.enabled) return deny(503, "Device verification is temporarily unavailable.");
          try { await verifyRequestAssertion(request, user.id); }
          catch { await auditSecurityEvent("attest.assert", "denied", user.id, requestId); return deny(403, "Verify this device again."); }
        }
      }
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      await auditSecurityEvent(`${policy.name}.request`, "allowed", user?.id ?? null, requestId);
    }
    response.headers.set("X-Request-Id", requestId);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    console.error(JSON.stringify({ kind: "security", action: policy.name, outcome: "guard_unavailable", requestId }));
    return deny(503, "Service temporarily unavailable.");
  }
}

export const config = {
  // The explicit API matcher prevents a filename suffix from bypassing the guard.
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
