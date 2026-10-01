import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

import { getSupabasePublicConfig } from "./config";

export function hasSupabasePublicConfig() {
  return getSupabasePublicConfig() !== null;
}

export async function createSupabaseServerClient() {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error("Supabase public server configuration is missing.");
  }

  // Native callers use the same verified Supabase identity as cookie callers.
  // Never decode a caller token and treat its claims as verified authorization.
  const authorization = (await headers()).get("authorization");
  if (authorization) {
    if (!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization) || authorization.length > 8192) {
      throw new Error("Invalid authorization header.");
    }
    return createClient(config.url, config.publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. Route handlers and Proxy can.
        }
      },
    },
  });
}

export function hasSupabaseServerConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server configuration is missing.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
