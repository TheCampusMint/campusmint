import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { campusMintDarkTokens, campusMintLightTokens } from "../data/appearance.ts";
import { areDeveloperControlsEnabled, areDevelopmentFixturesEnabled } from "../lib/runtime/fixturePolicy.ts";

const source = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const requestRoute = source("../app/api/student-verification/request/route.ts");
const verifyRoute = source("../app/api/student-verification/verify/route.ts");
const studentOnboarding = source("../components/onboarding/StudentEmailOnboarding.tsx");
const brandOnboarding = source("../components/onboarding/BrandEmailOnboarding.tsx");
const accountCompletion = source("../app/api/account/complete/route.ts");
const migration = source("../supabase/migrations/20260910001400_production_auth_events_brands.sql");
const accountPrivileges = source("../supabase/migrations/20260910001500_account_completion_privileges.sql");
const messages = source("../components/messages/ConversationBubble.tsx");
const notes = source("../components/messages/ProfileNotesStrip.tsx");
const search = source("../components/search/GlobalSearchSkeleton.tsx");
const topBar = source("../components/shell/TopUtilityBar.tsx");
const mintRoute = source("../app/mint/[mintId]/page.tsx");

function luminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((part) => Number.parseInt(part, 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(left, right) {
  const [bright, dark] = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (bright + 0.05) / (dark + 0.05);
}

test("production auth requests use Supabase passwordless OTP after the student eligibility gate", () => {
  assert.match(requestRoute, /assessStudentEmail\(email\)/);
  assert.match(requestRoute, /signInWithOtp/);
  assert.match(requestRoute, /shouldCreateUser:\s*true/);
  assert.doesNotMatch(requestRoute, /developmentCode|otp\s*:/i);
  assert.doesNotMatch(requestRoute, /password|sms/i);
});

test("six-digit email OTP verification creates an authenticated Supabase session with server-owned account type", () => {
  assert.match(verifyRoute, /\^\\d\{6\}\$/);
  assert.match(verifyRoute, /verifyOtp\(\{\s*email,\s*token:\s*body\.code,\s*type:\s*"email"/);
  assert.match(verifyRoute, /app_metadata/);
  assert.match(verifyRoute, /admin\.updateUserById/);
  assert.doesNotMatch(verifyRoute, /password|sms/i);
  assert.match(studentOnboarding, /inputMode="numeric"/);
  assert.match(studentOnboarding, /autoComplete="one-time-code"/);
});

test("Brand onboarding stays separate from student fields and still verifies email ownership", () => {
  assert.match(brandOnboarding, /requestEmailOtp/);
  assert.match(brandOnboarding, /verifyEmailOtp/);
  assert.doesNotMatch(brandOnboarding, /major|graduation|roommate|student clubs|class information/i);
  assert.match(accountCompletion, /user\.app_metadata\?\.account_type/);
});

test("student completion uses the minimal verified profile contract and reports database failures locally", () => {
  assert.match(studentOnboarding, /displayName: string/);
  assert.match(studentOnboarding, /username: string/);
  assert.doesNotMatch(studentOnboarding, /interests|hobbies|academicArea|tutoring|roommate|clubIds|phoneNumber/);
  assert.match(accountCompletion, /user\.email_confirmed_at/);
  assert.match(accountCompletion, /display_name: displayName/);
  assert.match(accountCompletion, /process\.env\.NODE_ENV === "production"/);
  assert.match(accountCompletion, /That username is already taken/);
  assert.match(accountPrivileges, /profile_identities[\s\S]*profiles[\s\S]*profile_privacy_settings[\s\S]*to service_role/);
  assert.match(accountPrivileges, /to authenticated/);
});

test("production and preview cannot enable demo fixtures or developer controls", () => {
  assert.equal(areDevelopmentFixturesEnabled({ NODE_ENV: "production", NEXT_PUBLIC_CAMPUS_MINT_ENABLE_FIXTURES: "true" }), false);
  assert.equal(areDevelopmentFixturesEnabled({ NODE_ENV: "development", NEXT_PUBLIC_CAMPUS_MINT_ENABLE_FIXTURES: "true" }), true);
  assert.equal(areDevelopmentFixturesEnabled({ NODE_ENV: "test" }), true);
  assert.equal(areDeveloperControlsEnabled({ NODE_ENV: "production", NEXT_PUBLIC_CAMPUS_MINT_ENABLE_DEV_CONTROLS: "true" }), false);
  assert.match(mintRoute, /areDevelopmentFixturesEnabled\(\)/);
  assert.match(mintRoute, /if \(!areDevelopmentFixturesEnabled\(\)\) notFound\(\)/);
});

test("production migration establishes owner/participant/recipient-only private data policies", () => {
  for (const policy of ["Students update their own public profile", "Participants read direct messages", "Pin owner only", "Notification recipient only", "Private appreciation owner only", "Event attendance is private to attendee", "Users manage their Channel memberships"]) assert.match(migration, new RegExp(policy));
  assert.match(migration, /Dwell never client-readable/);
  assert.match(migration, /Students create one-to-one conversations/);
  assert.match(migration, /membership\.channel_id = brand_channel_posts\.channel_id/);
  assert.doesNotMatch(migration, /membership\.channel_id = channel_id/);
  assert.doesNotMatch(migration, /to anon[^;]*for (?:insert|update|delete)/i);
});

test("service-role credentials remain server-only and never receive a NEXT_PUBLIC name", () => {
  const client = source("../lib/supabase/client.ts");
  assert.doesNotMatch(client, /SERVICE_ROLE/);
  assert.doesNotMatch(source("../.env.example"), /NEXT_PUBLIC_SUPABASE_SERVICE/);
});

test("message list renders a plain display-name row with private Pin and no legacy clutter", () => {
  assert.match(messages, /user\.profile\.displayName/);
  assert.match(messages, /PinIcon/);
  assert.doesNotMatch(messages, /user\.profile\.username|latestMessage\.body|\.\.\.|drag|overflow/i);
  assert.match(notes, /data-profile-note-unit/);
  assert.match(notes, /translateY\(\$\{offset\}px\)/);
});

test("Search exposes exactly Food, Events, and Sell with canonical icons", () => {
  assert.match(search, /id: "food", label: "Food", icon: <FoodIcon/);
  assert.match(search, /id: "events", label: "Events", icon: <CalendarIcon/);
  assert.match(search, /id: "marketplace", label: "Sell", icon: <SellIcon/);
  assert.doesNotMatch(search, /id: "(?:people|tutoring|clubs|housing)"/);
  assert.match(topBar, /SearchIcon/);
});

test("Campus Mint light and dark text/surface pairs meet normal-text contrast", () => {
  assert.equal(campusMintLightTokens.accent, "#6f1d2c");
  assert.ok(contrast(campusMintLightTokens.textPrimary, campusMintLightTokens.surface) >= 4.5);
  assert.ok(contrast(campusMintDarkTokens.textPrimary, campusMintDarkTokens.surface) >= 4.5);
  assert.ok(contrast(campusMintDarkTokens.accent, campusMintDarkTokens.background) >= 4.5);
});

test("Sports supports server-refreshed campus snapshots while bundled data remains a last-verified fallback", () => {
  const hub = source("../components/sports/SportsHub.tsx");
  const sportsRoute = source("../app/api/sports/route.ts");
  const refreshRoute = source("../app/api/sports/refresh/route.ts");
  assert.match(hub, /fetch\(`\/api\/sports\?universityId=/);
  assert.match(sportsRoute, /identity\?\.university_id !== requestedUniversityId/);
  assert.match(refreshRoute, /CAMPUS_DATA_SYNC_SECRET/);
  assert.match(refreshRoute, /verifiedAt/);
  assert.match(migration, /sports_program_snapshots/);
});
