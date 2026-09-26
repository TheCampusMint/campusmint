import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabasePublicConfig, hasSupabaseServerConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions = new Set(["verify_control", "approve", "reject"]);

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  if (!hasSupabasePublicConfig() || !hasSupabaseServerConfig()) return json({ ok: false, message: "Creator review is not configured." }, 503);
  const { applicationId } = await params;
  if (!uuid.test(applicationId)) return json({ ok: false, message: "Invalid creator application." }, 400);

  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return json({ ok: false, message: "Sign in again." }, 401);

  const admin = createSupabaseAdminClient();
  const { data: reviewerCapability, error: reviewerError } = await admin.from("account_capabilities")
    .select("capability")
    .eq("user_id", user.id)
    .eq("capability", "creator_reviewer")
    .is("revoked_at", null)
    .maybeSingle();
  if (reviewerError || !reviewerCapability) return json({ ok: false, message: "Creator reviewer authorization is required." }, 403);

  let input: unknown;
  try { input = await request.json(); } catch { input = null; }
  if (!input || typeof input !== "object") return json({ ok: false, message: "Choose a review action." }, 400);
  const value = input as Record<string, unknown>;
  const action = typeof value.action === "string" ? value.action : "";
  const notes = typeof value.internalNotes === "string" ? value.internalNotes.trim().slice(0, 2000) : null;
  if (!actions.has(action)) return json({ ok: false, message: "Choose a valid review action." }, 400);

  const { data, error } = await admin.rpc("review_creator_application", {
    target_application_id: applicationId,
    reviewer_id: user.id,
    review_action: action,
    internal_notes: notes,
  });
  if (error) {
    if (process.env.NODE_ENV !== "production") console.error("[creator-review] review transition failed", error);
    const errorMessage = error.message ?? "";
    if (/control/i.test(errorMessage)) return json({ ok: false, message: "Verify external-account control before approval." }, 409);
    if (/pending/i.test(errorMessage)) return json({ ok: false, message: "This application is no longer pending review." }, 409);
    if (/not found/i.test(errorMessage)) return json({ ok: false, message: "Creator application not found." }, 404);
    return json({ ok: false, message: "The Creator review could not be saved." }, 500);
  }
  return json({ ok: true, application: data }, 200);
}
