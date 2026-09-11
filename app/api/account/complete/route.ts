import { NextResponse } from "next/server";

import { normalizeSafeBrandWebsite } from "@/lib/auth/accountTypes";
import { assessStudentEmail } from "@/lib/auth/studentEmail";
import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabasePublicConfig, hasSupabaseServerConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";

const cleanText = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().slice(0, maximum) : "";
const reservedStudentUsernames = new Set([
  "admin", "administrator", "campusmint", "campus_mint", "help",
  "moderator", "official", "security", "support", "system",
]);

type DatabaseError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

function normalizedHandle(value: unknown, maximum = 40) {
  const handle = cleanText(value, maximum).toLocaleLowerCase().replace(/[^a-z0-9._]/g, "");
  const pattern = maximum === 30
    ? /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{3,30}$/
    : /^[a-z0-9][a-z0-9._]{2,39}$/;
  if (!pattern.test(handle) || (maximum === 30 && reservedStudentUsernames.has(handle))) return null;
  return handle;
}

function logDatabaseError(operation: string, error: DatabaseError | null) {
  if (!error || process.env.NODE_ENV === "production") return;
  console.error(`[account/complete] ${operation} failed`, {
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  });
}

function databaseFailure(operation: string, error: DatabaseError | null) {
  logDatabaseError(operation, error);
  if (error?.code === "23505" && `${error.message ?? ""} ${error.details ?? ""}`.includes("username")) {
    return NextResponse.json({ ok: false, message: "That username is already taken." }, { status: 409 });
  }
  return NextResponse.json({ ok: false, message: "We couldn't save your account." }, { status: 500 });
}

function legacyNameParts(displayName: string) {
  const [firstName, ...remaining] = displayName.split(/\s+/);
  return {
    firstName: firstName.slice(0, 80),
    lastName: (remaining.join(" ") || firstName).slice(0, 80),
  };
}

export async function POST(request: Request) {
  if (!hasSupabasePublicConfig() || !hasSupabaseServerConfig()) {
    return NextResponse.json({ ok: false, message: "Account setup is not configured for this environment." }, { status: 503 });
  }
  const sessionClient = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await sessionClient.auth.getUser();
  if (userError || !user?.email) return NextResponse.json({ ok: false, message: "Sign in again to finish account setup." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  if (!body || typeof body !== "object" || !("accountType" in body)) return NextResponse.json({ ok: false, message: "Invalid account setup." }, { status: 400 });

  const accountType = user.app_metadata?.account_type;
  if ((accountType !== "student" && accountType !== "brand") || body.accountType !== accountType) return NextResponse.json({ ok: false, message: "Account type could not be verified." }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const username = normalizedHandle("username" in body ? body.username : null, accountType === "student" ? 30 : 40);
  if (!username) return NextResponse.json({ ok: false, message: "Choose a valid username with at least three characters." }, { status: 400 });

  if (accountType === "student") {
    if (!user.email_confirmed_at) return NextResponse.json({ ok: false, message: "Verify your student email before finishing account setup." }, { status: 403 });
    const assessment = assessStudentEmail(user.email);
    if (!assessment.ok) return NextResponse.json({ ok: false, message: "This student email is not eligible." }, { status: 403 });
    const universityId = assessment.resolved.identity.knownUniversityId;
    if (!universityId) return NextResponse.json({ ok: false, message: "This institution is not configured yet." }, { status: 409 });
    const displayName = cleanText("displayName" in body ? body.displayName : null, 160);
    if (!displayName) return NextResponse.json({ ok: false, message: "Display name is required." }, { status: 400 });
    const { firstName, lastName } = legacyNameParts(displayName);
    const profileImageStoragePath = cleanText("profileImageStoragePath" in body ? body.profileImageStoragePath : null, 1000) || null;

    const { error: identityError } = await admin.from("profile_identities").upsert(
      { user_id: user.id, university_id: universityId, account_type: "student", role: "student", verified_student: true, email_verified_at: user.email_confirmed_at },
      { onConflict: "user_id" },
    );
    if (identityError) return databaseFailure("student identity upsert", identityError);
    const { error: profileError } = await admin.from("profiles").upsert(
      { user_id: user.id, first_name: firstName, last_name: lastName, display_name: displayName, username, profile_photo_storage_path: profileImageStoragePath, interests: [] },
      { onConflict: "user_id" },
    );
    if (profileError) return databaseFailure("student profile upsert", profileError);
    const { error: privacyError } = await admin.from("profile_privacy_settings").upsert(
      { user_id: user.id },
      { onConflict: "user_id" },
    );
    if (privacyError) return databaseFailure("student privacy upsert", privacyError);
  } else {
    const displayName = cleanText("displayName" in body ? body.displayName : null, 160);
    const websiteInput = cleanText("website" in body ? body.website : null, 500);
    const websiteUrl = websiteInput ? normalizeSafeBrandWebsite(websiteInput) : null;
    if (!displayName || (websiteInput && !websiteUrl)) return NextResponse.json({ ok: false, message: websiteInput && !websiteUrl ? "Enter a safe http or https website." : "Brand name is required." }, { status: 400 });

    const { error: identityError } = await admin.from("profile_identities").upsert({ user_id: user.id, university_id: null, account_type: "brand", role: "local-business", verified_student: false, email_verified_at: new Date().toISOString() });
    if (identityError) return databaseFailure("Brand identity upsert", identityError);
    const { data: brand, error: brandError } = await admin.from("brand_profiles").upsert({ user_id: user.id, display_name: displayName, username, username_normalized: username, bio: cleanText("bio" in body ? body.bio : null, 1000) || null, website_url: websiteUrl, contact_email: user.email, business_category: cleanText("businessCategory" in body ? body.businessCategory : null, 100) || null, verification_status: "unverified" }).select("id").single();
    if (brandError || !brand) return databaseFailure("Brand profile upsert", brandError);
    const channelHandle = username.replace(/[._]+/g, "-");
    const { error: channelError } = await admin.from("brand_channels").upsert({ brand_id: brand.id, name: displayName, handle: channelHandle, description: cleanText("bio" in body ? body.bio : null, 500) || null, status: "active" }, { onConflict: "brand_id" });
    if (channelError) return databaseFailure("Brand Channel upsert", channelError);
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
