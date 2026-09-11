import "server-only";

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

/** Server code may read the integration's non-public URL, but never its service key. */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return url && publishableKey ? { url, publishableKey } : null;
}
