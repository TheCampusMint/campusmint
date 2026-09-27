import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const entry = source("../components/onboarding/AccountOnboarding.tsx");
const studentOnboarding = source("../components/onboarding/StudentEmailOnboarding.tsx");
const creatorOnboarding = source("../components/onboarding/CreatorEmailOnboarding.tsx");
const creatorApply = source("../app/api/creator/apply/route.ts");
const creatorReview = source("../app/api/admin/creator-applications/[applicationId]/review/route.ts");
const communities = source("../app/api/communities/route.ts");
const accountMe = source("../app/api/account/me/route.ts");
const accountComplete = source("../app/api/account/complete/route.ts");
const authRequest = source("../app/api/student-verification/request/route.ts");
const authVerify = source("../app/api/student-verification/verify/route.ts");
const smsPolicy = source("../lib/auth/studentSmsPolicy.ts");
const mintRoute = source("../app/api/mintz/route.ts");
const badge = source("../components/creator/CreatorBadge.tsx");
const profile = source("../components/profile/ProfileView.tsx");
const settings = source("../components/shell/SettingsPanel.tsx");
const migration = source("../supabase/migrations/20260924002000_account_roles_creator_review_and_sms_gate.sql");

test("launch entry presents exactly Student, Creator, and Brand creation paths plus separate Sign In", () => {
  for (const label of ["Student", "Creator", "Brand"]) assert.match(entry, new RegExp(`>${label}<`));
  assert.match(entry, />Sign In</);
  assert.doesNotMatch(entry, />Public(?: user| account)?</i);
});

test("Student email OTP and minimal profile stay intact while SMS is disabled", () => {
  assert.match(authRequest, /signupAccountType === "student"/);
  assert.match(authRequest, /signInWithOtp/);
  assert.match(authVerify, /verifyOtp/);
  assert.match(accountComplete, /firstName = cleanText/);
  assert.match(accountComplete, /lastName = cleanText/);
  assert.doesNotMatch(studentOnboarding, /interests|hobbies|academicArea|tutoring|roommate|clubIds|phoneNumber/);
  assert.match(source("../.env.example"), /STUDENT_SMS_VERIFICATION_REQUIRED=false/);
});

test("the Student SMS requirement is server-owned and cannot be bypassed in a request body", () => {
  assert.match(smsPolicy, /process\.env\.STUDENT_SMS_VERIFICATION_REQUIRED/);
  assert.match(accountComplete, /isStudentSmsVerificationRequired\(\)/);
  assert.match(accountComplete, /phoneState\.status !== "verified"/);
  assert.doesNotMatch(accountComplete, /body\.(?:smsRequired|phoneVerified|phone_verification_status)/);
});

test("phone security data stays owner-only and is not returned by account hydration", () => {
  assert.match(migration, /phone_verification_status/);
  assert.match(migration, /phone_number_e164/);
  assert.match(migration, /phone_verification_states_verified_phone_unique_idx/);
  assert.match(source("../supabase/migrations/20260919001700_creator_phone_and_tester_authorization.sql"), /phone_verification_states_owner_read/);
  assert.doesNotMatch(accountMe, /select\("[^"]*phone_e164/);
  assert.doesNotMatch(accountMe, /phone_number_e164/);
});

test("Creator applications begin pending and policy-driven screening never grants approval", () => {
  assert.match(creatorApply, /creator_eligibility_policies/);
  assert.match(creatorApply, /screening_status: meetsFollowerGuide \? "eligible" : "needs_review"/);
  assert.match(creatorApply, /status: "pending"/);
  assert.doesNotMatch(creatorApply, /account_capabilities.*insert/s);
  assert.match(creatorOnboarding, /not automatic approval/i);
});

test("only a capability-authorized human review route can approve and grant Creator capabilities", () => {
  assert.match(creatorReview, /creator_reviewer/);
  assert.match(creatorReview, /admin\.rpc\("review_creator_application"/);
  assert.match(migration, /control_status <> 'verified'/);
  for (const capability of ["'creator'", "'create_groups'", "'create_channels'", "'future_monetization_eligible'"]) assert.match(migration, new RegExp(capability));
  assert.match(migration, /grant execute on function public\.review_creator_application[\s\S]*to service_role/);
  assert.match(migration, /revoke all on function public\.review_creator_application[\s\S]*authenticated/);
});

test("Student plus Creator remains additive and keeps the Student identity", () => {
  assert.match(accountMe, /accountType: "student", capabilities/);
  assert.match(accountMe, /creator: dualCreator/);
  assert.match(migration, /account_capabilities/);
  assert.doesNotMatch(migration, /update public\.profile_identities[\s\S]*account_type\s*=\s*'creator'/i);
});

test("approved non-Student Creators can publish while Student-only identity remains separately checked", () => {
  assert.match(mintRoute, /verifiedStudent/);
  assert.match(mintRoute, /approvedCreator/);
  assert.match(mintRoute, /verified Student or approved Creator profile/);
  assert.match(migration, /alter column university_id drop not null/);
  assert.match(migration, /verified_student/);
});

test("CreatorBadge is semantic, theme-token based, and approval gated", () => {
  assert.match(badge, /if \(!approved\) return null/);
  assert.match(badge, /--creator-badge-/);
  assert.match(profile, /CreatorBadge approved=\{owner\.account\.capabilities\?\.includes\("creator"\)/);
  assert.doesNotMatch(badge, /blue|purchase|paid/i);
});

test("Creator and Brand community creation uses distinct server-authoritative gates", () => {
  assert.match(communities, /requiredCapability/);
  assert.match(communities, /capabilities\.has\("creator"\)/);
  assert.match(communities, /verification_status !== "verified"/);
  assert.match(communities, /owner_kind: "creator"/);
  assert.match(communities, /owner_kind: "brand"/);
  assert.match(migration, /These are not official university organizations/);
});

test("Brands cannot self-verify and remain semantically separate from Creators", () => {
  assert.match(migration, /drop policy if exists "Brands update only their profile"/);
  assert.match(migration, /revoke update on public\.brand_profiles from authenticated/);
  assert.doesNotMatch(accountComplete, /verification_status: "verified"/);
  assert.doesNotMatch(communities, /verification_status\s*=\s*"verified"/);
});

test("account hydration restores persisted account type and active capabilities", () => {
  assert.match(accountMe, /account_capabilities/);
  assert.match(accountMe, /revoked_at/);
  assert.match(accountMe, /capabilities\.includes\("creator"\)/);
  assert.match(authRequest, /shouldCreateUser: false/);
  assert.match(authVerify, /accountType: metadataType/);
});

test("Creator review and eligibility contain no purchasable verification or payout implementation", () => {
  const combined = `${creatorApply}\n${creatorReview}\n${creatorOnboarding}\n${migration}`;
  assert.doesNotMatch(combined, /stripe|checkout|payment_intent|fake balance|\bCPM\b/i);
  assert.match(migration, /future_monetization_eligible/);
});

test("touched auth surfaces retain Mint leaf Back semantics", () => {
  assert.match(studentOnboarding, /MintLeafBackButton/);
  assert.match(creatorOnboarding, /MintLeafBackButton/);
  assert.match(creatorOnboarding, /step === "application" && emailAlreadyVerified/);
  assert.match(settings, /Apply for Creator/);
});
