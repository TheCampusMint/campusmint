import { readJsonBody } from "@/lib/security/requestBody";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabasePublicConfig, hasSupabaseServerConfig } from "@/lib/supabase/server";
import type { AccountCapability } from "@/types/accountCapabilities";

export const runtime = "nodejs";

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

function clean(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export async function POST(request: Request) {
  if (!hasSupabasePublicConfig() || !hasSupabaseServerConfig()) return json({ ok: false, message: "Community creation is not configured." }, 503);
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return json({ ok: false, message: "Sign in again." }, 401);

  let input: unknown;
  try { input = await readJsonBody(request); } catch { input = null; }
  if (!input || typeof input !== "object") return json({ ok: false, message: "Enter the community details." }, 400);
  const value = input as Record<string, unknown>;
  const kind = value.kind === "group" || value.kind === "channel" ? value.kind : null;
  const name = clean(value.name, 160);
  const handle = clean(value.handle, 64).toLocaleLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const description = clean(value.description, 1000) || null;
  if (!kind || name.length < 2 || !/^[a-z0-9][a-z0-9-]{2,63}$/.test(handle)) return json({ ok: false, message: "Enter a valid name and handle." }, 400);

  const admin = createSupabaseAdminClient();
  const metadataType = user.app_metadata?.account_type;
  if (metadataType === "brand") {
    const { data: brand, error } = await admin.from("brand_profiles")
      .select("id,verification_status,suspended_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !brand || brand.verification_status !== "verified" || brand.suspended_at) return json({ ok: false, message: "An approved Brand is required to create this community." }, 403);
    if (kind === "channel") {
      const { data: channel, error: createError } = await admin.from("brand_channels")
        .insert({ brand_id: brand.id, name, handle, description, status: "active" })
        .select("id,name,handle,status")
        .single();
      if (createError || !channel) return json({ ok: false, message: createError?.code === "23505" ? "That Brand Channel or handle already exists." : "We couldn't create that Brand Channel." }, createError?.code === "23505" ? 409 : 500);
      return json({ ok: true, community: { ...channel, kind, ownerKind: "brand" } }, 201);
    }
    const { data: group, error: createError } = await admin.from("publisher_communities")
      .insert({ owner_user_id: user.id, owner_kind: "brand", community_kind: "group", name, handle, description })
      .select("id,name,handle,status")
      .single();
    if (createError || !group) return json({ ok: false, message: createError?.code === "23505" ? "That Brand Group or handle already exists." : "We couldn't create that Brand Group." }, createError?.code === "23505" ? 409 : 500);
    return json({ ok: true, community: { ...group, kind, ownerKind: "brand" } }, 201);
  }

  const requiredCapability: AccountCapability = kind === "group" ? "create_groups" : "create_channels";
  const { data: capabilityRows, error: capabilityError } = await admin.from("account_capabilities")
    .select("capability")
    .eq("user_id", user.id)
    .in("capability", ["creator", requiredCapability])
    .is("revoked_at", null);
  const capabilities = new Set((capabilityRows ?? []).map((row) => row.capability));
  if (capabilityError || !capabilities.has("creator") || !capabilities.has(requiredCapability)) return json({ ok: false, message: "Approved Creator access is required to create this community." }, 403);
  const { data: community, error } = await admin.from("publisher_communities")
    .insert({ owner_user_id: user.id, owner_kind: "creator", community_kind: kind, name, handle, description })
    .select("id,name,handle,status")
    .single();
  if (error || !community) return json({ ok: false, message: error?.code === "23505" ? "That Creator community or handle already exists." : "We couldn't create that Creator community." }, error?.code === "23505" ? 409 : 500);
  return json({ ok: true, community: { ...community, kind, ownerKind: "creator" } }, 201);
}
