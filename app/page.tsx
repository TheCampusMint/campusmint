"use client";

import { useState } from "react";

import { AcademicHub } from "@/components/academics/AcademicHub";
import { ClubsHub } from "@/components/clubs/ClubsHub";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { DeveloperRoleSwitcher } from "@/components/developer/DeveloperRoleSwitcher";
import { DiningHub } from "@/components/dining/DiningHub";
import { EventsSection } from "@/components/events/EventsSection";
import { HousingHub } from "@/components/housing/HousingHub";
import { MarketplaceHub } from "@/components/marketplace/MarketplaceHub";
import { ProfilesHub } from "@/components/profile/ProfilesHub";
import { StoriesFeed } from "@/components/stories/StoriesFeed";
import { DeveloperUniversitySwitcher } from "@/components/university/DeveloperUniversitySwitcher";
import { sampleEvents } from "@/data/events";
import { CURRENT_DEVELOPMENT_USER_ID } from "@/data/development/users";
import { getOrganizationsForUniversity } from "@/data/organizations";
import { getUserRoleLabel, type UserRole } from "@/data/userRoles";
import {
  universities,
  type UniversityId,
} from "@/data/universities";
import { useAcademics } from "@/hooks/useAcademics";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useProfiles } from "@/hooks/useProfiles";
import { useStories } from "@/hooks/useStories";
import { getVisibleStories } from "@/lib/storyPermissions";
import type { TemporaryUser } from "@/types/user";

const navItems = [
  "Dashboard",
  "Stories",
  "Events",
  "Dining",
  "Academics",
  "Clubs",
  "People",
  "Marketplace",
  "Housing",
  "Career",
] as const;

type NavItem = (typeof navItems)[number] | "Profile";

// Temporary test user. Later this will come from the user's verified account.
const initialUser: TemporaryUser = {
  id: CURRENT_DEVELOPMENT_USER_ID,
  firstName: "Student",
  universityId: "blinn",
  role: "student",
  major: "Computer Science",
  graduationYear: 2029,
  verifiedStudent: false,
};

const showDeveloperControls = process.env.NODE_ENV === "development";
const marketplacePermissionMode = process.env.NODE_ENV === "development"
  ? "development_role"
  : "verified_student";

export default function Home() {
  const [active, setActive] = useState<NavItem>("Dashboard");
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(CURRENT_DEVELOPMENT_USER_ID);
  const [user, setUser] = useState<TemporaryUser>(initialUser);
  const academics = useAcademics();
  const marketplace = useMarketplace();
  const organizations = useOrganizations();
  const profiles = useProfiles();
  const {
    stories,
    currentTime,
    toggleLike,
    addComment,
    addStory,
  } = useStories();
  const theme = universities[user.universityId];
  const viewer = {
    ...profiles.currentUser,
    account: {
      ...profiles.currentUser.account,
      universityId: user.universityId,
      role: user.role,
      verifiedStudent: user.verifiedStudent ?? false,
    },
  };
  const storyUser: TemporaryUser = {
    ...user,
    firstName: viewer.profile.displayName,
    major: viewer.profile.major ?? user.major,
    graduationYear: viewer.profile.graduationYear ?? user.graduationYear,
  };
  const visibleStories = getVisibleStories(
    stories,
    theme.accessibleCampuses,
    user.role,
    currentTime,
  );
  const joinedClubCount = user.role === "student" ? getOrganizationsForUniversity(user.universityId).filter((organization) => {
    const status = organizations.getMembershipStatus(organization.id);
    return status === "member" || status === "officer";
  }).length : 0;

  function changeUniversity(universityId: UniversityId) {
    setUser((currentUser) => ({ ...currentUser, universityId }));
  }

  function changeRole(role: UserRole) {
    setUser((currentUser) => ({ ...currentUser, role }));
  }

  function openProfile(userId: string) {
    setSelectedProfileUserId(userId);
    setActive("Profile");
  }

  return (
    <main
      className="min-h-screen"
      style={{
        backgroundColor: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <header
        className="border-b"
        style={{
          backgroundColor: theme.primary,
          color: theme.secondary,
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold">The Campus Mint</h1>

            <p className="text-sm opacity-85">{theme.shortName}</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {showDeveloperControls && (
              <>
                <DeveloperUniversitySwitcher
                  selectedUniversityId={user.universityId}
                  onUniversityChange={changeUniversity}
                />
                <DeveloperRoleSwitcher
                  selectedRole={user.role}
                  onRoleChange={changeRole}
                  primaryColor={theme.primary}
                  secondaryColor={theme.secondary}
                />
              </>
            )}

            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-medium"
              style={{
                backgroundColor: theme.secondary,
                color: theme.primary,
              }}
            >
              Notifications
            </button>

            <button
              type="button"
              aria-label="Open My Profile"
              onClick={() => openProfile(CURRENT_DEVELOPMENT_USER_ID)}
              className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                outlineColor: theme.secondary,
              }}
            >
              <span className="hidden sm:block"><span className="block max-w-40 truncate text-sm font-bold">{viewer.profile.displayName}</span><span className="block text-xs opacity-75">{getUserRoleLabel(user.role)}</span></span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full font-bold" style={{ backgroundColor: theme.secondary, color: theme.primary }}>{viewer.profile.photo.placeholderId ?? "CM"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl bg-white p-4 shadow-sm">
          <nav aria-label="Campus Mint sections" className="space-y-2">
            {navItems.map((item) => {
              const isActive = active === item;

              return (
                <button
                  key={item}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setActive(item)}
                  className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    backgroundColor: isActive
                      ? theme.primary
                      : "transparent",
                    color: isActive ? theme.secondary : "#334155",
                    outlineColor: theme.primary,
                  }}
                >
                  {item}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="space-y-6">
          {active !== "People" && active !== "Profile" && <div
            className="rounded-2xl p-8 shadow-sm"
            style={{ backgroundColor: theme.accent }}
          >
            <p
              className="text-sm font-medium"
              style={{ color: theme.primary }}
            >
              Welcome back
            </p>

            <h2 className="mt-2 text-4xl font-bold">{viewer.profile.firstName}</h2>

            <p className="mt-3 text-lg font-medium">{theme.name}</p>

            <p className="mt-1 text-slate-600">
              {viewer.profile.major ?? user.major} • Class of {viewer.profile.graduationYear ?? user.graduationYear}
            </p>

            <span
              className="mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: theme.secondary,
                borderColor: theme.primary,
                color: theme.primary,
              }}
            >
              {getUserRoleLabel(user.role)}
            </span>
          </div>}

          {active === "Dashboard" && (
            <DashboardOverview
              theme={theme}
              newestStory={visibleStories[0]}
              joinedClubCount={joinedClubCount}
              onOpenStories={() => setActive("Stories")}
              onOpenClubs={() => setActive("Clubs")}
              onOpenMarketplace={() => setActive("Marketplace")}
            />
          )}

          {active === "Stories" && (
            <StoriesFeed
              stories={stories}
              currentUser={storyUser}
              accessibleCampuses={theme.accessibleCampuses}
              currentTime={currentTime}
              theme={theme}
              onToggleLike={toggleLike}
              onAddComment={addComment}
              onCreateStory={addStory}
              onOpenProfile={openProfile}
            />
          )}

          {active === "Events" && (
            <EventsSection
              events={sampleEvents}
              accessibleCampuses={theme.accessibleCampuses}
              theme={theme}
            />
          )}

          {active === "Dining" && (
            <DiningHub
              key={user.universityId}
              universityId={user.universityId}
              accessibleCampuses={theme.accessibleCampuses}
              theme={theme}
            />
          )}

          {active === "Academics" && (
            <AcademicHub
              key={user.universityId}
              universityId={user.universityId}
              theme={theme}
              profile={academics.profiles[user.universityId]}
              submissions={academics.submissions}
              onSetProgram={(programId, customProgram) =>
                academics.setProgram(user.universityId, programId, customProgram)
              }
              onAddEnrollment={(enrollment) =>
                academics.addEnrollment(user.universityId, enrollment)
              }
              onRemoveEnrollment={(enrollmentId) =>
                academics.removeEnrollment(user.universityId, enrollmentId)
              }
              onSubmitMissing={(entityType, value) =>
                academics.submitMissing(user.universityId, entityType, value)
              }
            />
          )}

          {active === "Clubs" && (
            <ClubsHub
              user={user}
              theme={theme}
              events={sampleEvents}
              stories={visibleStories}
              organizations={organizations}
            />
          )}

          {(active === "People" || active === "Profile") && (
            <ProfilesHub
              mode={active === "People" ? "people" : "profile"}
              selectedUserId={selectedProfileUserId}
              viewer={viewer}
              theme={theme}
              visibleStories={visibleStories}
              marketplaceListings={marketplace.listings}
              profiles={profiles}
              onOpenProfile={openProfile}
              onBackToPeople={() => setActive("People")}
            />
          )}

          {active === "Housing" && (
            <HousingHub
              key={user.universityId}
              universityId={user.universityId}
              accessibleCampuses={theme.accessibleCampuses}
              theme={theme}
            />
          )}

          {active === "Marketplace" && (
            <MarketplaceHub
              user={user}
              theme={theme}
              permissionMode={marketplacePermissionMode}
              marketplace={marketplace}
              onOpenProfile={openProfile}
            />
          )}

          {active !== "Dashboard" &&
            active !== "Stories" &&
            active !== "Events" &&
            active !== "Dining" &&
            active !== "Academics" &&
            active !== "Clubs" &&
            active !== "People" &&
            active !== "Profile" &&
            active !== "Marketplace" &&
            active !== "Housing" && (
              <div className="rounded-2xl border border-dashed bg-white p-12 text-center">
                <h3
                  className="text-2xl font-semibold"
                  style={{ color: theme.primary }}
                >
                  {active}
                </h3>

                <p className="mt-2 text-slate-500">
                  We&apos;ll build this feature next.
                </p>
              </div>
            )}
        </section>
      </div>
    </main>
  );
}
