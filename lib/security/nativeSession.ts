import "server-only";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { uuid } from "./appAttest";

export async function recordNativeSession(client: SupabaseClient, session: Session) {
  const { data, error } = await client.auth.getClaims(session.access_token);
  const id = data?.claims.session_id;
  if (error || !uuid(id) || data?.claims.sub !== session.user.id) throw new Error("Session identity mismatch.");
  const write = await createSupabaseAdminClient().from("native_auth_sessions").upsert({ session_id: id, user_id: session.user.id, expires_at: new Date((session.expires_at ?? 0) * 1000).toISOString() }, { onConflict: "session_id" });
  if (write.error) throw new Error("Native session storage unavailable.");
}
