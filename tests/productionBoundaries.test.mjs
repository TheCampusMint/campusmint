import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { campusMintDarkTokens, campusMintLightTokens, getAppearanceTokens } from "../data/appearance.ts";
import { universities } from "../data/universities.ts";
import { areDeveloperControlsEnabled, areDevelopmentFixturesEnabled } from "../lib/runtime/fixturePolicy.ts";
import { canViewMint } from "../lib/social/mintPermissions.ts";
import { clearPrivateSessionCache } from "../lib/auth/privateSessionCache.ts";
import { launchFreeMediaEntitlement } from "../lib/content/mediaPolicy.ts";

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
const mintPersistenceRoute = source("../app/api/mintz/route.ts");
const mintComposer = source("../components/content/CreateContentFlow.tsx");
const mintHook = source("../hooks/useMintz.ts");
const mintPersistenceMigration = source("../supabase/migrations/20260919001600_production_mint_persistence.sql");
const creatorMigration = source("../supabase/migrations/20260919001700_creator_phone_and_tester_authorization.sql");
const lifecycleMigration = source("../supabase/migrations/20260919001800_media_lifecycle_archive_and_review_foundation.sql");
const verifiedBrandMigration = source("../supabase/migrations/20260919001900_verified_brand_privilege_boundary.sql");
const accountEntry = source("../components/onboarding/AccountOnboarding.tsx");
const closeControl = source("../components/ui/CloseButton.tsx");
const brandPostRoute = source("../app/api/brand/channel/posts/route.ts");
const brandEventRoute = source("../app/api/brand/events/route.ts");

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
  assert.match(verifyRoute, /verifyOtp\(\{\s*email,\s*token:\s*input\.code,\s*type:\s*"email"/);
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
  assert.doesNotMatch(accountCompletion, /brand_channels/);
  assert.match(brandPostRoute, /verification_status !== "verified"/);
  assert.match(brandEventRoute, /verification_status !== "verified"/);
  assert.match(verifiedBrandMigration, /Verified Brands publish only to their Channel/);
  assert.match(verifiedBrandMigration, /Verified Brands create own sourced events/);
});

test("student completion uses the minimal verified profile contract and reports database failures locally", () => {
  assert.match(studentOnboarding, /firstName: string/);
  assert.match(studentOnboarding, /lastName: string/);
  assert.match(studentOnboarding, /username: string/);
  assert.doesNotMatch(studentOnboarding, /interests|hobbies|academicArea|tutoring|roommate|clubIds|phoneNumber/);
  assert.match(accountCompletion, /user\.email_confirmed_at/);
  assert.match(accountCompletion, /firstName = cleanText/);
  assert.match(accountCompletion, /lastName = cleanText/);
  assert.match(accountCompletion, /const displayName = \[firstName, lastName\]\.filter\(Boolean\)\.join\(" "\)/);
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
  assert.match(mintRoute, /publicMint\(mintId\)/);
  assert.doesNotMatch(mintRoute, /getDevelopmentMintById|createDevelopmentMintz/);
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

test("surface scheme and accent source compose without falling back to maroon", () => {
  const darkForest = getAppearanceTokens(
    { scheme: "dark", accentSource: "curated", tint: "forest" },
    universities.tamu,
  );
  const oregonCampus = getAppearanceTokens(
    { scheme: "light", accentSource: "campus", tint: "slate" },
    universities.oregon,
  );
  assert.equal(darkForest.colorScheme, "dark");
  assert.notEqual(darkForest.accent, campusMintDarkTokens.accent);
  assert.equal(oregonCampus.accent, universities.oregon.primary);
  assert.notEqual(oregonCampus.accent, campusMintLightTokens.accent);
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

test("production Mint publishing waits for authenticated storage and database persistence", () => {
  assert.match(mintPersistenceRoute, /session\.auth\.getUser\(\)/);
  assert.match(mintPersistenceRoute, /storage\.from\("mint-media"\)\.upload/);
  assert.match(mintPersistenceRoute, /admin\.from\("social_content"\)\.insert/);
  assert.match(mintPersistenceRoute, /client_request_id/);
  assert.match(mintPersistenceRoute, /removeUploadedMedia/);
  assert.match(mintPersistenceMigration, /unique index social_content_author_request_unique_idx/);
  assert.match(mintHook, /fetch\(["`]\/api\/mintz/);
  assert.match(mintHook, /uploadToSignedUrl/);
  assert.match(source("../lib/content/publishMint.ts"), /JSON\.stringify\(body\)/);
  assert.match(mintComposer, /if \(!result.ok\)/);
  assert.doesNotMatch(mintComposer, /onCreateMint\(input\);\s*onClose/);
});

test("media entitlements stay centralized, finite, and do not claim original retention", () => {
  assert.equal(Number.isFinite(launchFreeMediaEntitlement.published.maxRequestBytes), true);
  assert.equal(launchFreeMediaEntitlement.retainOriginalUploads, false);
  assert.equal(launchFreeMediaEntitlement.originalArchiveBytes, 0);
  assert.doesNotMatch(JSON.stringify(launchFreeMediaEntitlement), /unlimited|price|stripe/i);
});

test("sign out clears only the active user's private browser cache", () => {
  const values = new Map([
    ["campusmint:private-messages:user-a:v3", "private"],
    ["campusmint:mint-feed:user-a:v1", "private"],
    ["campusmint:mint-feed:user-b:v1", "other-user"],
    ["campusmint.preferences.v1", "public-safe"],
  ]);
  const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
  };
  clearPrivateSessionCache(storage, "user-a");
  assert.equal(values.has("campusmint:private-messages:user-a:v3"), false);
  assert.equal(values.has("campusmint:mint-feed:user-a:v1"), false);
  assert.equal(values.get("campusmint:mint-feed:user-b:v1"), "other-user");
  assert.equal(values.get("campusmint.preferences.v1"), "public-safe");
});

test("existing-account sign in does not create a new Supabase user", () => {
  assert.match(accountEntry, />Sign In</);
  assert.match(requestRoute, /shouldCreateUser:\s*false/);
  assert.match(verifyRoute, /No Campus Mint account is associated/);
});

test("creator and owner capabilities cannot be self-approved by browser state", () => {
  assert.match(accountEntry, />Creator</);
  assert.match(creatorMigration, /creator_application_status/);
  assert.match(creatorMigration, /control_status = 'verified'/);
  assert.match(creatorMigration, /granted_by uuid not null/);
  assert.match(creatorMigration, /owner_campus_tester/);
  assert.doesNotMatch(creatorMigration, /insert into public\.account_capabilities/i);
  assert.match(creatorMigration, /enforcement_enabled boolean not null default false/);
});

test("media lifecycle foundations separate public cleanup from owner-only Archive storage", () => {
  assert.match(lifecycleMigration, /media_cleanup_jobs/);
  assert.match(lifecycleMigration, /mark_expired_social_content/);
  assert.match(lifecycleMigration, /private_content_archives/);
  assert.match(lifecycleMigration, /mint-archive/);
  assert.match(lifecycleMigration, /WebAuthn/i);
  assert.match(lifecycleMigration, /human_decision/);
});

test("Back and Close have separate shared branded controls", () => {
  assert.match(brandOnboarding, /MintLeafBackButton/);
  assert.match(closeControl, /aria-label/);
  assert.match(closeControl, /CloseIcon/);
  assert.doesNotMatch(closeControl, />×</);
});

test("an eligible public Mint is visible across universities while campus products keep separate scopes", () => {
  const account = (id, universityId) => ({ account: { id, universityId, knownUniversityId: universityId, role: "student" }, socialSettings: { accountType: "public", discoveryScope: "university" } });
  assert.equal(canViewMint({
    viewer: account("viewer", "tamu"),
    author: account("author", "lsu"),
    mint: { id: "global-public", authorId: "author", status: "active", archivedAt: null, expiresAt: null, privacy: "public", commentsEnabled: true, likesVisible: true },
    friendshipStatus: "none",
    viewerFollowsAuthor: false,
    authorFollowsViewer: false,
    blocked: false,
    currentTime: Date.now(),
  }), true);
});


test("every accent keeps neutral surfaces and readable controls in both schemes", () => {
  for (const scheme of ["light", "dark"]) {
    for (const tint of ["slate", "warm-gray", "forest", "deep-navy", "muted-maroon"]) {
      for (const accentSource of ["brand", "campus", "curated"]) {
        const tokens = getAppearanceTokens({ scheme, tint, accentSource }, universities.tamu);
        for (const key of ["background", "surface", "surfaceElevated"]) {
          const hex = tokens[key].slice(1);
          assert.equal(hex.slice(0, 2), hex.slice(2, 4));
          assert.equal(hex.slice(2, 4), hex.slice(4, 6));
          assert.ok(contrast(tokens.accent, tokens[key]) >= 4.5);
          assert.ok(contrast(tokens.textSecondary, tokens[key]) >= 4.5);
        }
        assert.ok(contrast(tokens.accent, tokens.accentContrast) >= 4.5);
      }
    }
  }
});
