import { NextResponse } from "next/server";

import { configuredUniversityIds, type UniversityId } from "@/data/universities";
import { userRoleOptions, type UserRole } from "@/data/userRoles";
import { createSupabaseServerClient, hasSupabasePublicConfig } from "@/lib/supabase/server";
import type { AccountSessionResponse, BrandSessionProfile } from "@/types/accountSession";
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

export async function GET() {
  if (!hasSupabasePublicConfig()) return response({ ok: true, configured: false, authenticated: false });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return response({ ok: true, configured: true, authenticated: false });
    const accountType = user.app_metadata?.account_type === "brand" ? "brand" : "student";

    if (accountType === "brand") {
      const { data: brand } = await supabase.from("brand_profiles")
        .select("id,user_id,display_name,username,bio,website_url,contact_email,business_category,verification_status,brand_channels(id,name,handle,description,status)")
        .eq("user_id", user.id).maybeSingle();
      if (!brand) return response({ ok: true, configured: true, authenticated: true, accountType, onboardingComplete: false, brand: null });
      const channelValue = Array.isArray(brand.brand_channels) ? brand.brand_channels[0] : brand.brand_channels;
      const brandProfile: BrandSessionProfile = {
        id: brand.id, userId: brand.user_id, displayName: brand.display_name, username: brand.username,
        bio: brand.bio, websiteUrl: brand.website_url, contactEmail: brand.contact_email,
        businessCategory: brand.business_category, verificationStatus: brand.verification_status,
        channel: channelValue ? { id: channelValue.id, name: channelValue.name, handle: channelValue.handle, description: channelValue.description, status: channelValue.status } : null,
      };
      return response({ ok: true, configured: true, authenticated: true, accountType, onboardingComplete: true, brand: brandProfile });
    }

    const [{ data: identity }, { data: profile }, { data: privacy }] = await Promise.all([
      supabase.from("profile_identities").select("user_id,university_id,role,verified_student,verified_alumni,created_at,updated_at").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("profile_privacy_settings").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    if (!identity || !profile) return response({ ok: true, configured: true, authenticated: true, accountType, onboardingComplete: false, user: null });
    const universityId = configuredUniversityIds.includes(identity.university_id as UniversityId) ? identity.university_id as UniversityId : "tamu";
    const role = userRoleOptions.some((option) => option.id === identity.role) ? identity.role as UserRole : "student";
    const mapPrivacy = (key: keyof ProfilePrivacySettings) => privacy?.[key === "portfolioUrl" ? "portfolio_url" : key === "personalWebsite" ? "personal_website" : key] ?? defaultPrivacy[key];
    const campusUser: CampusMintUser = {
      account: {
        id: user.id, accountType: "student", universityId, knownUniversityId: universityId,
        role, verifiedStudent: identity.verified_student, verifiedAlumni: identity.verified_alumni,
        studentEmail: user.email ?? null, primaryEmail: user.email ?? null,
        studentEmailVerifiedAt: user.email_confirmed_at ?? null, studentEmailVerificationMethod: "email_otp",
        onboardingCompletedAt: profile.created_at, isDevelopment: false,
        createdAt: identity.created_at, updatedAt: identity.updated_at,
      },
      profile: {
        id: profile.user_id, accountId: profile.user_id, username: profile.username,
        usernameNormalized: profile.username_normalized, firstName: profile.first_name,
        lastName: profile.last_name, displayName: profile.display_name,
        photo: { kind: "initials", placeholderId: profile.profile_photo_placeholder, storagePath: profile.profile_photo_storage_path },
        bio: profile.bio, major: profile.major, academicArea: profile.major,
        graduationYear: profile.graduation_year, classIds: [], clubIds: [], interests: profile.interests ?? [],
        hometown: profile.hometown, instagram: profile.instagram, linkedin: profile.linkedin,
        portfolioUrl: profile.portfolio_url, personalWebsite: profile.personal_website,
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
    return response({ ok: true, configured: true, authenticated: true, accountType, onboardingComplete: true, user: campusUser });
  } catch {
    return response({ ok: false, message: "Account status is temporarily unavailable." }, 503);
  }
}
