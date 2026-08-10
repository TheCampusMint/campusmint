"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { ClubsDiscovery } from "@/components/clubs/ClubsDiscovery";
import { DeveloperRoleSwitcher } from "@/components/developer/DeveloperRoleSwitcher";
import { GroupsSkeleton } from "@/components/groups/GroupsSkeleton";
import { SimpleMarketplace } from "@/components/marketplace/SimpleMarketplace";
import { MessagesSkeleton } from "@/components/messages/MessagesSkeleton";
import { CampusMintFeed } from "@/components/mintz/CampusMintFeed";
import { PeopleSkeleton } from "@/components/people/PeopleSkeleton";
import { ProfilesHub } from "@/components/profile/ProfilesHub";
import { GlobalSearchSkeleton } from "@/components/search/GlobalSearchSkeleton";
import { BottomBubbleNav } from "@/components/shell/BottomBubbleNav";
import { type PrimarySection, dailyNavigation, secondaryNavigation } from "@/components/shell/navigation";
import { SectionTransition } from "@/components/shell/SectionTransition";
import { SettingsPanel } from "@/components/shell/SettingsPanel";
import { TopUtilityBar } from "@/components/shell/TopUtilityBar";
import { CareerSkeleton } from "@/components/secondary/CareerSkeleton";
import { FoodSkeleton } from "@/components/secondary/FoodSkeleton";
import { HousingSkeleton } from "@/components/secondary/HousingSkeleton";
import { DeveloperUniversitySwitcher } from "@/components/university/DeveloperUniversitySwitcher";
import { CURRENT_DEVELOPMENT_USER_ID } from "@/data/development/users";
import { getOrganizationById } from "@/data/organizations";
import { type UserRole } from "@/data/userRoles";
import { universities, type UniversityId } from "@/data/universities";
import { getAppearanceTokens } from "@/data/appearance";
import { useAcademics } from "@/hooks/useAcademics";
import { useAppPreferences } from "@/hooks/useAppPreferences";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useMintz } from "@/hooks/useMintz";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useProfiles } from "@/hooks/useProfiles";
import { useStories } from "@/hooks/useStories";
import { canJoinOrganization } from "@/lib/organizationPermissions";
import { getVisibleStories } from "@/lib/storyPermissions";
import type { Organization } from "@/types/organization";
import type { TemporaryUser } from "@/types/user";

const initialUser: TemporaryUser = {
  id: CURRENT_DEVELOPMENT_USER_ID,
  firstName: "Student",
  universityId: "tamu",
  role: "student",
  major: "Computer Science",
  graduationYear: 2029,
  verifiedStudent: false,
};

const showDeveloperControls = process.env.NODE_ENV === "development";
const marketplacePermissionMode = process.env.NODE_ENV === "development" ? "development_role" : "verified_student";

export function CampusAppShell() {
  const [activeSection, setActiveSection] = useState<PrimarySection>("mint");
  const [activeSet, setActiveSet] = useState<0 | 1>(0);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(CURRENT_DEVELOPMENT_USER_ID);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [user, setUser] = useState<TemporaryUser>(initialUser);
  const academics = useAcademics();
  const marketplace = useMarketplace();
  const mintz = useMintz();
  const organizations = useOrganizations(CURRENT_DEVELOPMENT_USER_ID);
  const profiles = useProfiles();
  const stories = useStories();
  const preferenceState = useAppPreferences();
  const theme = universities[user.universityId];
  const viewer = useMemo(() => ({
    ...profiles.currentUser,
    account: {
      ...profiles.currentUser.account,
      universityId: user.universityId,
      role: user.role,
      verifiedStudent: user.verifiedStudent ?? false,
    },
  }), [profiles.currentUser, user.role, user.universityId, user.verifiedStudent]);
  const appearanceTokens = useMemo(() => getAppearanceTokens(preferenceState.preferences.appearance, theme), [preferenceState.preferences.appearance, theme]);
  const visibleStories = getVisibleStories(stories.stories, theme.accessibleCampuses, user.role, stories.currentTime, { id: user.id, universityId: user.universityId }, organizations.memberships);

  function changeUniversity(universityId: UniversityId) {
    setUser((current) => ({ ...current, universityId }));
  }

  function changeRole(role: UserRole) {
    setUser((current) => ({ ...current, role }));
  }

  function selectSection(section: PrimarySection) {
    setActiveSection(section);
    if (dailyNavigation.some((item) => item.id === section)) setActiveSet(0);
    if (secondaryNavigation.some((item) => item.id === section)) setActiveSet(1);
  }

  function openProfile(userId: string) {
    setSelectedProfileUserId(userId);
    setActiveSection("profile");
  }

  function handleOrganizationMembership(organization: Organization) {
    if (!canJoinOrganization(user, organization)) return;
    const status = organizations.getMembershipStatus(organization.id);
    if (status === "requested" || status === "member") {
      organizations.leaveOrganization(organization);
      return;
    }
    if (status === "none" || status === "rejected") organizations.joinOrRequest(organization);
  }

  function sectionContent(): ReactNode {
    if (activeSection === "mint") return <CampusMintFeed viewer={viewer} theme={theme} profiles={profiles} mintz={mintz} organizations={organizations} onCreateStory={stories.addStory} onOpenProfile={openProfile} onRequestOrganization={(organizationId) => { const organization = getOrganizationById(organizationId); if (organization) handleOrganizationMembership(organization); }} reducedMotion={preferenceState.preferences.content.reducedMotion} autoplayVideo={preferenceState.preferences.content.autoplayVideo} defaultCommentsEnabled={preferenceState.preferences.content.commentsDefault} defaultHideLikeCounts={preferenceState.preferences.content.hideLikeCountsDefault} />;
    if (activeSection === "people") return <PeopleSkeleton viewer={viewer} theme={theme} profiles={profiles} onOpenProfile={openProfile} />;
    if (activeSection === "clubs") return <ClubsDiscovery user={user} theme={theme} organizations={organizations} onMembershipAction={handleOrganizationMembership} />;
    if (activeSection === "messages") return <MessagesSkeleton viewer={viewer} theme={theme} profiles={profiles} />;
    if (activeSection === "search") return <GlobalSearchSkeleton viewer={viewer} theme={theme} profiles={profiles} listings={marketplace.listings} onOpenProfile={openProfile} onSelectSection={selectSection} />;
    if (activeSection === "groups") return <GroupsSkeleton currentUserId={CURRENT_DEVELOPMENT_USER_ID} theme={theme} organizations={organizations} />;
    if (activeSection === "food") return <FoodSkeleton universityId={user.universityId} theme={theme} />;
    if (activeSection === "housing") return <HousingSkeleton universityId={user.universityId} theme={theme} />;
    if (activeSection === "career") return <CareerSkeleton universityId={user.universityId} theme={theme} profile={academics.profiles[user.universityId]} />;
    if (activeSection === "marketplace") return <SimpleMarketplace user={user} theme={theme} marketplace={marketplace} permissionMode={marketplacePermissionMode} onOpenProfile={openProfile} />;
    if (activeSection === "profile") return <ProfilesHub mode="profile" selectedUserId={selectedProfileUserId} viewer={viewer} theme={theme} visibleStories={visibleStories} marketplaceListings={marketplace.listings} profiles={profiles} mintz={mintz} organizations={organizations} onOpenProfile={openProfile} onBackToPeople={() => selectSection("people")} />;
    return null;
  }

  const shellStyle = {
    "--campus-primary": theme.primary,
    "--campus-secondary": theme.secondary,
    "--campus-accent": theme.accent,
    "--app-background": appearanceTokens.background,
    "--app-surface": appearanceTokens.surface,
    "--app-surface-elevated": appearanceTokens.surfaceElevated,
    "--app-text-primary": appearanceTokens.textPrimary,
    "--app-text-secondary": appearanceTokens.textSecondary,
    "--app-border": appearanceTokens.border,
    "--app-accent": appearanceTokens.accent,
    "--app-accent-soft": appearanceTokens.accentSoft,
    "--app-accent-contrast": appearanceTokens.accentContrast,
    "--app-danger": appearanceTokens.danger,
    "--app-success": appearanceTokens.success,
    colorScheme: appearanceTokens.colorScheme,
  } as CSSProperties;

  return (
    <main className="campus-app-shell min-h-dvh text-slate-950" style={shellStyle} data-appearance={preferenceState.preferences.appearance.mode} data-reduced-motion={preferenceState.preferences.content.reducedMotion ? "true" : "false"}>
      <TopUtilityBar viewer={viewer} theme={theme} onOpenSettings={() => setSettingsOpen(true)} onOpenProfile={() => openProfile(CURRENT_DEVELOPMENT_USER_ID)} developerControls={showDeveloperControls ? <><DeveloperUniversitySwitcher selectedUniversityId={user.universityId} onUniversityChange={changeUniversity} /><DeveloperRoleSwitcher selectedRole={user.role} onRoleChange={changeRole} primaryColor={theme.primary} secondaryColor={theme.secondary} /></> : undefined} />
      <div className={`mx-auto px-4 pb-36 pt-5 sm:px-6 ${activeSection === "mint" ? "max-w-[42rem]" : "max-w-5xl"}`}>
        <SectionTransition sectionKey={activeSection}>{sectionContent()}</SectionTransition>
      </div>
      <BottomBubbleNav activeSection={activeSection} activeSet={activeSet} reducedMotion={preferenceState.preferences.content.reducedMotion} onSelect={selectSection} onSetChange={setActiveSet} />
      {settingsOpen && <SettingsPanel viewer={viewer} theme={theme} profiles={profiles} preferenceState={preferenceState} onOpenProfile={() => openProfile(CURRENT_DEVELOPMENT_USER_ID)} onClose={() => setSettingsOpen(false)} />}
    </main>
  );
}
