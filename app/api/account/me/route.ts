import { NextResponse } from "next/server";

import { configuredUniversityIds, type UniversityId } from "@/data/universities";
import { userRoleOptions, type UserRole } from "@/data/userRoles";
import { isStudentSmsVerificationRequired } from "@/lib/auth/studentSmsPolicy";
import { profileValuesFromRow } from "@/lib/auth/profilePersistence";
import { createSupabaseServerClient, hasSupabasePublicConfig } from "@/lib/supabase/server";
import { accountCapabilityValues, type AccountCapability } from "@/types/accountCapabilities";
import type { AccountSessionResponse, BrandSessionProfile, CreatorSessionProfile } from "@/types/accountSession";
import type { CampusMintUser, ProfilePrivacySettings } from "@/types/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };
const defaultPrivacy: ProfilePrivacySettings = {
  bio: "everyone", major: "students_only", graduationYear: "students_only",
  classes: "friends_only", clubs: "students_only", interests: "everyone",
  roommate: "private", tutoring: "students_only", hometown: "private",
  instagram: "friends_only", linkedin: "everyone", portfolioUrl: "everyone",
  personalWebsite: "everyone",
};

function response(body: AccountSessionResponse, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

function unavailable() {
  return response({ ok: false, message: "We couldn't load your saved account. Please try again." }, 503);
}

export async function GET() {
  if (!hasSupabasePublicConfig()) return response({ ok: true, configured: false, authenticated: false });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      // A network/auth service outage is not proof that the user signed out.
      if (error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403) {
        return response({ ok: true, configured: true, authenticated: false });
      }
      return unavailable();
    }
    if (!user) return response({ ok: true, configured: true, authenticated: false });
    const metadataAccountType = user.app_metadata?.account_type;
    const accountType = metadataAccountType === "brand" || metadataAccountType === "creator" ? metadataAccountType : "student";
    const { data: capabilityRows, error: capabilityError } = await supabase.from("account_capabilities")
      .select("capability")
      .eq("user_id", user.id)
      .is("revoked_at", null);
    if (capabilityError) return unavailable();
    const capabilities = (capabilityRows ?? []).flatMap((row) =>
      accountCapabilityValues.includes(row.capability as AccountCapability)
        ? [row.capability as AccountCapability]
        : [],
    );
    const canUseCampusTester = capabilities.includes("owner_campus_tester");

    if (accountType === "creator") {
      const [{ data: creator, error: creatorError }, { data: application, error: applicationError }] = await Promise.all([
        supabase.from("creator_profiles").select("id,user_id,display_name,username,bio,badge_tint").eq("user_id", user.id).maybeSingle(),
        supabase.from("creator_applications").select("id,platform,external_handle,status,control_status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (creatorError || applicationError) return unavailable();
      if (!creator) return response({ ok: true, configured: true, authenticated: true, accountType, capabilities, onboardingComplete: false, creator: null, canUseCampusTester });
      const creatorProfile: CreatorSessionProfile = {
        id: creator.id,
        userId: creator.user_id,
        displayName: creator.display_name,
        username: creator.username,
        bio: creator.bio,
        badgeTint: creator.badge_tint,
        creatorApproved: capabilities.includes("creator"),
        application: application ? {
          id: application.id,
          platform: application.platform,
          externalHandle: application.external_handle,
          status: application.status,
          controlStatus: application.control_status,
        } : null,
      };
      return response({ ok: true, configured: true, authenticated: true, accountType, capabilities, onboardingComplete: Boolean(application), creator: creatorProfile, canUseCampusTester });
    }

    if (accountType === "brand") {
      const { data: brand, error: brandError } = await supabase.from("brand_profiles")
        .select("id,user_id,display_name,username,bio,website_url,contact_email,business_category,verification_status,brand_channels(id,name,handle,description,status)")
        .eq("user_id", user.id).maybeSingle();
      if (brandError) return unavailable();
      if (!brand) return response({ ok: true, configured: true, authenticated: true, accountType, capabilities, onboardingComplete: false, brand: null, canUseCampusTester });
      const channelValue = brand.verification_status === "verified"
        ? (Array.isArray(brand.brand_channels) ? brand.brand_channels[0] : brand.brand_channels)
        : null;
      const brandProfile: BrandSessionProfile = {
        id: brand.id, userId: brand.user_id, displayName: brand.display_name, username: brand.username,
        bio: brand.bio, websiteUrl: brand.website_url, contactEmail: brand.contact_email,
        businessCategory: brand.business_category, verificationStatus: brand.verification_status,
        channel: channelValue ? { id: channelValue.id, name: channelValue.name, handle: channelValue.handle, description: channelValue.description, status: channelValue.status } : null,
      };
      return response({ ok: true, configured: true, authenticated: true, accountType, capabilities, onboardingComplete: true, brand: brandProfile, canUseCampusTester });
    }

    const smsRequired = isStudentSmsVerificationRequired();
    const [{ data: identity, error: identityError }, { data: profile, error: profileError }, { data: privacy, error: privacyError }, { data: creator, error: creatorError }, { data: application, error: applicationError }, { data: phoneState, error: phoneError }] = await Promise.all([
      supabase.from("profile_identities").select("user_id,university_id,role,verified_student,verified_alumni,created_at,updated_at").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("profile_privacy_settings").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("creator_profiles").select("id,user_id,display_name,username,bio,badge_tint").eq("user_id", user.id).maybeSingle(),
      supabase.from("creator_applications").select("id,platform,external_handle,status,control_status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      smsRequired
        ? supabase.from("phone_verification_states").select("verified_at,status").eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (identityError || profileError || privacyError || creatorError || applicationError || phoneError) return unavailable();
    const studentPhoneVerified = Boolean(phoneState?.verified_at && phoneState.status === "verified");
    const dualCreator: CreatorSessionProfile | null = creator ? {
      id: creator.id,
      userId: creator.user_id,
      displayName: creator.display_name,
      username: creator.username,
      bio: creator.bio,
      badgeTint: creator.badge_tint,
      creatorApproved: capabilities.includes("creator"),
      application: application ? {
        id: application.id,
        platform: application.platform,
        externalHandle: application.external_handle,
        status: application.status,
        controlStatus: application.control_status,
      } : null,
    } : null;
    if (!identity || !profile) return response({ ok: true, configured: true, authenticated: true, accountType, capabilities, onboardingComplete: false, user: null, creator: dualCreator, studentSmsVerificationRequired: smsRequired, studentPhoneVerified, canUseCampusTester });
    const universityId = configuredUniversityIds.includes(identity.university_id as UniversityId) ? identity.university_id as UniversityId : "tamu";
    const role = userRoleOptions.some((option) => option.id === identity.role) ? identity.role as UserRole : "student";
    const mapPrivacy = (key: keyof ProfilePrivacySettings) => privacy?.[key === "portfolioUrl" ? "portfolio_url" : key === "personalWebsite" ? "personal_website" : key] ?? defaultPrivacy[key];
    const campusUser: CampusMintUser = {
      account: {
        id: user.id, accountType: "student", capabilities, universityId, knownUniversityId: universityId,
        role, verifiedStudent: identity.verified_student, verifiedAlumni: identity.verified_alumni,
        studentEmail: user.email ?? null, primaryEmail: user.email ?? null,
        studentEmailVerifiedAt: user.email_confirmed_at ?? null, studentEmailVerificationMethod: "email_otp",
        onboardingCompletedAt: profile.created_at, isDevelopment: false,
        createdAt: identity.created_at, updatedAt: identity.updated_at,
      },
      profile: {
        ...profileValuesFromRow(profile),
        id: profile.user_id, accountId: profile.user_id,
        createdAt: profile.created_at, updatedAt: profile.updated_at,
      },
      privacy: {
        bio: mapPrivacy("bio"), major: mapPrivacy("major"), graduationYear: mapPrivacy("graduationYear"),
        classes: mapPrivacy("classes"), clubs: mapPrivacy("clubs"), interests: mapPrivacy("interests"),
        roommate: mapPrivacy("roommate"), tutoring: mapPrivacy("tutoring"), hometown: mapPrivacy("hometown"),
        instagram: mapPrivacy("instagram"), linkedin: mapPrivacy("linkedin"), portfolioUrl: mapPrivacy("portfolioUrl"),
        personalWebsite: mapPrivacy("personalWebsite"),
      },
      socialSettings: { accountType: "private", discoveryScope: "university" },
    };
    return response({ ok: true, configured: true, authenticated: true, accountType, capabilities, onboardingComplete: !smsRequired || studentPhoneVerified, user: campusUser, creator: dualCreator, studentSmsVerificationRequired: smsRequired, studentPhoneVerified, canUseCampusTester });
  } catch {
    return response({ ok: false, message: "Account status is temporarily unavailable." }, 503);
  }
}
