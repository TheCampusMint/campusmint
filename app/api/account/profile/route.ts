import { NextResponse } from "next/server";

import { normalizeProfileUpdate, profileValuesFromRow } from "@/lib/auth/profilePersistence";
import { createSupabaseServerClient, hasSupabasePublicConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function PATCH(request: Request) {
  if (!hasSupabasePublicConfig()) {
    return json({ ok: false, message: "Account persistence is not configured for this environment." }, 503);
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json({ ok: false, message: "Sign in again to save your profile." }, 401);

  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  if (!body || typeof body !== "object") return json({ ok: false, message: "Invalid profile update." }, 400);

  const { data: current, error: readError } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (readError) return json({ ok: false, message: "We couldn't load your saved profile. Please try again." }, 503);
  if (!current) return json({ ok: false, message: "Finish account setup before editing your profile." }, 409);
  // Omitted fields are preserved; explicit nulls clear an optional field.
  const normalized = normalizeProfileUpdate({ ...profileValuesFromRow(current), ...body });
  if (!normalized.ok) return json(normalized, 400);

  const { data: saved, error } = await supabase.from("profiles").update(normalized.update).eq("user_id", user.id).select("*").maybeSingle();
  if (error) {
    if (error.code === "23505") return json({ ok: false, message: "That username is already taken." }, 409);
    if (error.code === "42703" || error.code === "PGRST204") {
      console.error("[account/profile] Profile storage requires the profile_persistence migration.");
      return json({ ok: false, code: "profile_storage_unavailable", message: "Profile saving is temporarily unavailable. Your changes are still here; please try again later." }, 503);
    }
    if (process.env.NODE_ENV !== "production") console.error("[account/profile] update failed", error);
    return json({ ok: false, message: "We couldn't save your profile." }, 500);
  }

  if (!saved) return json({ ok: false, message: "Your profile wasn't saved. Please sign in again and retry." }, 409);
  return json({ ok: true, profile: profileValuesFromRow(saved) });
}
