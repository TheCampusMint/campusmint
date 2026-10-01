import { readJsonBody } from "@/lib/security/requestBody";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabasePublicConfig, hasSupabaseServerConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

const platforms = new Set(["youtube", "instagram", "tiktok", "twitch", "other"]);
const clean = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().slice(0, maximum) : "";

function validHttpsUrl(value: string) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function nameParts(displayName: string) {
  const [firstName, ...rest] = displayName.split(/\s+/);
  return { firstName: firstName.slice(0, 80), lastName: (rest.join(" ") || firstName).slice(0, 80) };
}

function failure(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "private, no-store" } });
}

function additionalAccounts(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const platform = clean(record.platform, 30).toLocaleLowerCase();
    const handle = clean(record.handle, 160);
    const profileUrl = clean(record.profileUrl, 500);
    return platforms.has(platform) && handle && validHttpsUrl(profileUrl)
      ? [{ platform, handle, profileUrl }]
      : [];
  });
}

export async function POST(request: Request) {
  if (!hasSupabasePublicConfig() || !hasSupabaseServerConfig()) return failure("Creator applications are not configured in this environment.", 503);
  const session = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await session.auth.getUser();
  if (userError || !user?.email || !user.email_confirmed_at) return failure("Verify your email before applying.", 401);
  const accountType = user.app_metadata?.account_type;
  if (accountType !== "creator" && accountType !== "student") return failure("This account cannot submit a creator application.", 403);

  let body: unknown;
  try { body = await readJsonBody(request); } catch { body = null; }
  if (!body || typeof body !== "object") return failure("Enter the required creator information.", 400);
  const value = body as Record<string, unknown>;
  const platform = clean(value.platform, 30).toLocaleLowerCase();
  const externalHandle = clean(value.externalHandle, 160);
  const externalProfileUrl = clean(value.externalProfileUrl, 500);
  const claimedFollowerCount = typeof value.claimedFollowerCount === "number" ? Math.floor(value.claimedFollowerCount) : Number(value.claimedFollowerCount);
  if (!platforms.has(platform) || !externalHandle || !validHttpsUrl(externalProfileUrl) || !Number.isSafeInteger(claimedFollowerCount) || claimedFollowerCount < 0) {
    return failure("Enter a valid creator platform, profile, and non-negative follower-count claim.", 400);
  }

  const admin = createSupabaseAdminClient();
  const { data: eligibilityPolicy, error: policyError } = await admin.from("creator_eligibility_policies")
    .select("external_follower_threshold,alternative_review_enabled")
    .eq("singleton", true)
    .single();
  if (policyError || !eligibilityPolicy) return failure("Creator eligibility policy is temporarily unavailable.", 503);
  const meetsFollowerGuide = claimedFollowerCount >= eligibilityPolicy.external_follower_threshold;
  if (!meetsFollowerGuide && !eligibilityPolicy.alternative_review_enabled) {
    return failure("This application does not currently meet the Creator review policy.", 400);
  }
  const { data: existing, error: existingError } = await admin.from("creator_applications").select("id,status").eq("user_id", user.id).in("status", ["pending", "under_review", "approved"]).maybeSingle();
  if (existingError) return failure("Creator applications are temporarily unavailable.", 503);
  if (existing) return NextResponse.json({ ok: true, applicationId: existing.id, status: existing.status, deduplicated: true }, { headers: { "Cache-Control": "private, no-store" } });

  let displayName = clean(value.displayName, 160);
  let username = clean(value.username, 40).toLocaleLowerCase().replace(/[^a-z0-9._]/g, "");
  const bio = clean(value.bio, 1000) || null;
  if (accountType === "student") {
    const { data: studentProfile, error } = await admin.from("profiles").select("display_name,username,bio").eq("user_id", user.id).maybeSingle();
    if (error || !studentProfile) return failure("Complete your Student profile before applying as a creator.", 409);
    displayName = studentProfile.display_name;
    username = studentProfile.username;
  }
  if (!displayName || !/^[a-z0-9][a-z0-9._]{2,39}$/.test(username)) return failure("Choose a valid display name and username.", 400);

  const { error: profileError } = await admin.from("creator_profiles").upsert({ user_id: user.id, display_name: displayName, username, bio }, { onConflict: "user_id" });
  if (profileError) {
    if (profileError.code === "23505") return failure("That creator username is already taken.", 409);
    if (process.env.NODE_ENV !== "production") console.error("[creator/apply] profile upsert failed", profileError);
    return failure("We couldn't save your creator profile.", 500);
  }
  if (accountType === "creator") {
    const { firstName, lastName } = nameParts(displayName);
    const { error: identityError } = await admin.from("profile_identities").upsert(
      { user_id: user.id, university_id: null, account_type: "creator", role: "supporter", verified_student: false, email_verified_at: user.email_confirmed_at },
      { onConflict: "user_id" },
    );
    if (identityError) return failure("We couldn't prepare your Creator account.", 500);
    const { error: publicProfileError } = await admin.from("profiles").upsert(
      { user_id: user.id, first_name: firstName, last_name: lastName, display_name: displayName, username, bio, interests: [] },
      { onConflict: "user_id" },
    );
    if (publicProfileError) {
      if (publicProfileError.code === "23505") return failure("That Campus Mint username is already taken.", 409);
      return failure("We couldn't prepare your public Creator profile.", 500);
    }
    const { error: privacyError } = await admin.from("profile_privacy_settings").upsert({ user_id: user.id }, { onConflict: "user_id" });
    if (privacyError) return failure("We couldn't prepare your Creator privacy settings.", 500);
  }
  const { data: application, error: applicationError } = await admin.from("creator_applications").insert({
    user_id: user.id,
    platform,
    external_handle: externalHandle,
    external_profile_url: externalProfileUrl,
    claimed_follower_count: claimedFollowerCount,
    additional_social_accounts: additionalAccounts(value.additionalSocialAccounts),
    application_notes: clean(value.applicationNotes, 2000) || null,
    control_proof_method: "provider_review",
    control_status: "pending",
    screening_status: meetsFollowerGuide ? "eligible" : "needs_review",
    screening_summary: meetsFollowerGuide
      ? "The applicant's unverified follower claim meets the current review guide. External-account control and human review are still required."
      : "The applicant does not meet the current follower guide and requires alternative-criterion review.",
    screened_at: new Date().toISOString(),
    status: "pending",
  }).select("id,status").single();
  if (applicationError || !application) {
    if (process.env.NODE_ENV !== "production") console.error("[creator/apply] application insert failed", applicationError);
    return failure("We couldn't submit your application. Your creator access has not been activated.", 500);
  }
  return NextResponse.json({ ok: true, applicationId: application.id, status: application.status, deduplicated: false }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
