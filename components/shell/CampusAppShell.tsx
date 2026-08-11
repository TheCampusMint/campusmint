"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type TouchEvent,
} from "react";

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
import {
  type PrimarySection,
  dailyNavigation,
  secondaryNavigation,
} from "@/components/shell/navigation";
import { SettingsPanel } from "@/components/shell/SettingsPanel";
import { TopUtilityBar } from "@/components/shell/TopUtilityBar";
import { CareerSkeleton } from "@/components/secondary/CareerSkeleton";
import { FoodSkeleton } from "@/components/secondary/FoodSkeleton";
import { HousingSkeleton } from "@/components/secondary/HousingSkeleton";
import { DeveloperUniversitySwitcher } from "@/components/university/DeveloperUniversitySwitcher";
import { CURRENT_DEVELOPMENT_USER_ID } from "@/data/development/users";
import { getAppearanceTokens } from "@/data/appearance";
import { getOrganizationById } from "@/data/organizations";
import { type UserRole } from "@/data/userRoles";
import { universities, type UniversityId } from "@/data/universities";
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

type SwipeSection = Exclude<PrimarySection, "profile">;

type PageDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  axis: "pending" | "horizontal" | "vertical";
  velocity: number;
};

type SearchTouchState = {
  x: number;
  y: number;
  time: number;
} | null;

const navigation = [...dailyNavigation, ...secondaryNavigation];
const sectionSequence = navigation.map((item) => item.id) as SwipeSection[];
const SECTION_COUNT = sectionSequence.length;
const INITIAL_MINT_INDEX = sectionSequence.indexOf("mint");
const HORIZONTAL_SNAP_MS = 340;

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
const marketplacePermissionMode =
  process.env.NODE_ENV === "development"
    ? "development_role"
    : "verified_student";

function mod(value: number, length: number) {
  return ((value % length) + length) % length;
}

function nearestVirtualIndex(current: number, target: number) {
  const currentPosition = mod(current, SECTION_COUNT);
  let delta = target - currentPosition;

  if (delta > SECTION_COUNT / 2) delta -= SECTION_COUNT;
  if (delta < -SECTION_COUNT / 2) delta += SECTION_COUNT;

  return current + delta;
}

export function CampusAppShell() {
  const [navIndex, setNavIndex] = useState(
    INITIAL_MINT_INDEX >= 0 ? INITIAL_MINT_INDEX : 0,
  );
  const [specialSection, setSpecialSection] =
    useState<"profile" | null>(null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [swipeSettling, setSwipeSettling] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] =
    useState(CURRENT_DEVELOPMENT_USER_ID);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [user, setUser] = useState<TemporaryUser>(initialUser);

  const swipeProgressRef = useRef(0);
  const settleTimerRef = useRef<number | null>(null);
  const pageDragRef = useRef<PageDragState | null>(null);
  const searchTouchRef = useRef<SearchTouchState>(null);

  const academics = useAcademics();
  const marketplace = useMarketplace();
  const mintz = useMintz();
  const organizations = useOrganizations(CURRENT_DEVELOPMENT_USER_ID);
  const profiles = useProfiles();
  const stories = useStories();
  const preferenceState = useAppPreferences();

  const theme = universities[user.universityId];

  const currentNavigationSection =
    sectionSequence[mod(navIndex, SECTION_COUNT)] ?? "mint";

  const activeSection: PrimarySection =
    specialSection ?? currentNavigationSection;

  const viewer = useMemo(
    () => ({
      ...profiles.currentUser,
      account: {
        ...profiles.currentUser.account,
        universityId: user.universityId,
        role: user.role,
        verifiedStudent: user.verifiedStudent ?? false,
      },
    }),
    [
      profiles.currentUser,
      user.role,
      user.universityId,
      user.verifiedStudent,
    ],
  );

  const appearanceTokens = useMemo(
    () =>
      getAppearanceTokens(
        preferenceState.preferences.appearance,
        theme,
      ),
    [preferenceState.preferences.appearance, theme],
  );

  const visibleStories = getVisibleStories(
    stories.stories,
    theme.accessibleCampuses,
    user.role,
    stories.currentTime,
    {
      id: user.id,
      universityId: user.universityId,
    },
    organizations.memberships,
  );

  const previousSection =
    sectionSequence[mod(navIndex - 1, SECTION_COUNT)] ?? "marketplace";

  const nextSection =
    sectionSequence[mod(navIndex + 1, SECTION_COUNT)] ?? "messages";

  const swipeSections: SwipeSection[] = [
    previousSection,
    currentNavigationSection,
    nextSection,
  ];

  function setGestureProgress(value: number) {
    swipeProgressRef.current = value;
    setSwipeProgress(value);
  }

  function clearSettleTimer() {
    if (!settleTimerRef.current) return;

    window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;
  }

  function changeUniversity(universityId: UniversityId) {
    setUser((current) => ({ ...current, universityId }));
  }

  function changeRole(role: UserRole) {
    setUser((current) => ({ ...current, role }));
  }

  function selectSection(section: PrimarySection) {
    clearSettleTimer();
    setSwipeSettling(false);
    setGestureProgress(0);

    if (section === "profile") {
      setSpecialSection("profile");
      return;
    }

    const targetIndex = sectionSequence.indexOf(section);
    if (targetIndex < 0) return;

    setSpecialSection(null);
    setNavIndex((current) => nearestVirtualIndex(current, targetIndex));
  }

  function openProfile(userId: string) {
    clearSettleTimer();
    setGestureProgress(0);
    setSwipeSettling(false);
    setSelectedProfileUserId(userId);
    setSpecialSection("profile");
  }

  function handleOrganizationMembership(organization: Organization) {
    if (!canJoinOrganization(user, organization)) return;

    const status = organizations.getMembershipStatus(organization.id);

    if (status === "requested" || status === "member") {
      organizations.leaveOrganization(organization);
      return;
    }

    if (status === "none" || status === "rejected") {
      organizations.joinOrRequest(organization);
    }
  }

  function applyHorizontalDelta(
    deltaSections: number,
    velocitySectionsPerMs: number,
  ) {
    if (specialSection || settingsOpen) return;

    clearSettleTimer();

    if (swipeSettling) setSwipeSettling(false);

    let next = swipeProgressRef.current + deltaSections;
    let sectionSteps = 0;

    while (next <= -1) {
      next += 1;
      sectionSteps += 1;
    }

    while (next >= 1) {
      next -= 1;
      sectionSteps -= 1;
    }

    if (sectionSteps !== 0) {
      setNavIndex((current) => current + sectionSteps);
    }

    setGestureProgress(next);
    void velocitySectionsPerMs;
  }

  function finishHorizontalGesture(velocitySectionsPerMs: number) {
    if (specialSection || settingsOpen) {
      setGestureProgress(0);
      return;
    }

    clearSettleTimer();

    const projected =
      swipeProgressRef.current + velocitySectionsPerMs * 220;

    let target = 0;

    if (projected <= -0.20) target = -1;
    if (projected >= 0.20) target = 1;

    if (preferenceState.preferences.content.reducedMotion) {
      if (target < 0) {
        setNavIndex((current) => current + 1);
      } else if (target > 0) {
        setNavIndex((current) => current - 1);
      }

      setGestureProgress(0);
      return;
    }

    setSwipeSettling(true);
    setGestureProgress(target);

    settleTimerRef.current = window.setTimeout(() => {
      if (target < 0) {
        setNavIndex((current) => current + 1);
      } else if (target > 0) {
        setNavIndex((current) => current - 1);
      }

      setGestureProgress(0);
      setSwipeSettling(false);
      settleTimerRef.current = null;
    }, HORIZONTAL_SNAP_MS);
  }

  function cancelHorizontalGesture() {
    finishHorizontalGesture(0);
  }

  function gestureStartsOnInteractiveTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;

    return Boolean(
      target.closest(
        [
          "button",
          "a",
          "input",
          "textarea",
          "select",
          "summary",
          "details",
          "[data-mint-carousel]",
          "[data-bottom-bubble-nav]",
          "[data-horizontal-gesture-ignore]",
        ].join(","),
      ),
    );
  }

  function beginPageSwipe(event: PointerEvent<HTMLDivElement>) {
    if (
      specialSection ||
      settingsOpen ||
      gestureStartsOnInteractiveTarget(event.target)
    ) {
      return;
    }

    pageDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      axis: "pending",
      velocity: 0,
    };
  }

  function updatePageSwipe(event: PointerEvent<HTMLDivElement>) {
    const drag = pageDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const totalX = event.clientX - drag.startX;
    const totalY = event.clientY - drag.startY;

    if (drag.axis === "pending") {
      if (Math.max(Math.abs(totalX), Math.abs(totalY)) < 8) return;

      if (Math.abs(totalX) > Math.abs(totalY) * 1.18) {
        drag.axis = "horizontal";
        drag.lastX = event.clientX;
        drag.lastTime = event.timeStamp;

        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }

        return;
      }

      if (Math.abs(totalY) > Math.abs(totalX) * 1.18) {
        drag.axis = "vertical";
        return;
      }
    }

    if (drag.axis !== "horizontal") return;

    const elapsed = Math.max(1, event.timeStamp - drag.lastTime);
    const deltaX = event.clientX - drag.lastX;
    const viewportWidth = Math.max(1, window.innerWidth);

    drag.velocity = deltaX / viewportWidth / elapsed;
    drag.lastX = event.clientX;
    drag.lastTime = event.timeStamp;

    applyHorizontalDelta(deltaX / viewportWidth, drag.velocity);
  }

  function finishPageSwipe(event: PointerEvent<HTMLDivElement>) {
    const drag = pageDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    pageDragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (drag.axis === "horizontal") {
      finishHorizontalGesture(drag.velocity);
    }
  }

  function cancelPageSwipe() {
    const drag = pageDragRef.current;
    pageDragRef.current = null;

    if (drag?.axis === "horizontal") {
      cancelHorizontalGesture();
    }
  }

  function beginSearchTouch(event: TouchEvent<HTMLElement>) {
    if (
      event.touches.length !== 1 ||
      settingsOpen ||
      activeSection === "search" ||
      gestureStartsOnInteractiveTarget(event.target)
    ) {
      searchTouchRef.current = null;
      return;
    }

    const touch = event.touches[0];

    if (touch.clientY > window.innerHeight * 0.25) {
      searchTouchRef.current = null;
      return;
    }

    searchTouchRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: event.timeStamp,
    };
  }

  function finishSearchTouch(event: TouchEvent<HTMLElement>) {
    const start = searchTouchRef.current;
    searchTouchRef.current = null;

    if (!start || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const elapsed = event.timeStamp - start.time;

    const deliberateDownSwipe =
      deltaY >= 140 &&
      deltaY > Math.abs(deltaX) * 2 &&
      Math.abs(deltaX) <= 70 &&
      elapsed <= 700;

    if (deliberateDownSwipe) {
      selectSection("search");
    }
  }

  function findGlobalMotionTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return null;

    const control = target.closest(
      "button:not(:disabled), summary",
    );

    if (!(control instanceof HTMLElement)) return null;

    // Bottom nav already has its own motion system.
    if (control.closest("[data-bottom-bubble-nav]")) return null;

    // Feed tabs already use the copied bottom-icon engine.
    if (control.hasAttribute("data-feed-motion-tab")) return null;

    // EVENT / CLUB floating tabs intentionally stay solid.
    if (control.hasAttribute("data-static-badge")) return null;

    return control;
  }

  function resetGlobalMotionTarget(control: HTMLElement) {
    if (preferenceState.preferences.content.reducedMotion) return;

    control.style.transition =
      "transform 460ms cubic-bezier(.2,1.5,.3,1), filter 300ms ease, box-shadow 300ms ease";

    control.style.transform =
      "translate3d(0, 0, 10px) rotateX(0deg) rotateY(0deg) scale(1)";
  }

  function handleGlobalIconPointerMove(
    event: PointerEvent<HTMLElement>,
  ) {
    if (preferenceState.preferences.content.reducedMotion) return;

    const control = findGlobalMotionTarget(event.target);
    if (!control) return;

    const bounds = control.getBoundingClientRect();

    const nx =
      (event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5;

    const ny =
      (event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5;

    const x = nx * 6.5;
    const y = ny * 5;
    const rotateX = ny * -24;
    const rotateY = nx * 26;

    control.style.transition =
      "transform 80ms linear, filter 120ms ease, box-shadow 120ms ease";

    control.style.transformOrigin = "center";
    control.style.willChange = "transform";
    control.style.transformStyle = "preserve-3d";

    control.style.transform =
      `translate3d(${x}px, ${y}px, 16px) ` +
      `rotateX(${rotateX}deg) ` +
      `rotateY(${rotateY}deg) scale(1.11)`;
  }

  function handleGlobalIconPointerDown(
    event: PointerEvent<HTMLElement>,
  ) {
    if (preferenceState.preferences.content.reducedMotion) return;

    const control = findGlobalMotionTarget(event.target);
    if (!control) return;

    control.style.transition = "transform 80ms linear";

    control.style.transform =
      "translate3d(0, 1px, 5px) rotateX(8deg) rotateY(0deg) scale(.91)";
  }

  function handleGlobalIconPointerUp(
    event: PointerEvent<HTMLElement>,
  ) {
    const control = findGlobalMotionTarget(event.target);
    if (!control) return;

    resetGlobalMotionTarget(control);
  }

  function handleGlobalIconPointerOut(
    event: PointerEvent<HTMLElement>,
  ) {
    const control = findGlobalMotionTarget(event.target);
    if (!control) return;

    const nextTarget = event.relatedTarget;

    if (
      nextTarget instanceof Node &&
      control.contains(nextTarget)
    ) {
      return;
    }

    resetGlobalMotionTarget(control);
  }

  function sectionContent(
    section: PrimarySection,
    isActive = false,
  ): ReactNode {
    if (section === "mint") {
      return (
        <CampusMintFeed
          viewer={viewer}
          theme={theme}
          profiles={profiles}
          mintz={mintz}
          organizations={organizations}
          onCreateStory={stories.addStory}
          onOpenProfile={openProfile}
          onRequestOrganization={(organizationId) => {
            const organization = getOrganizationById(organizationId);
            if (organization) handleOrganizationMembership(organization);
          }}
          reducedMotion={preferenceState.preferences.content.reducedMotion}
          autoplayVideo={preferenceState.preferences.content.autoplayVideo}
          defaultCommentsEnabled={
            preferenceState.preferences.content.commentsDefault
          }
          defaultHideLikeCounts={preferenceState.preferences.content.hideLikeCountsDefault}
        />
      );
    }

    if (section === "people") {
      return (
        <PeopleSkeleton
          viewer={viewer}
          theme={theme}
          profiles={profiles}
          onOpenProfile={openProfile}
        />
      );
    }

    if (section === "clubs") {
      return (
        <ClubsDiscovery
          user={user}
          theme={theme}
          organizations={organizations}
          onMembershipAction={handleOrganizationMembership}
        />
      );
    }

    if (section === "messages") {
      return (
        <MessagesSkeleton
          viewer={viewer}
          theme={theme}
          profiles={profiles}
        />
      );
    }

    if (section === "search") {
      return (
        <GlobalSearchSkeleton
          viewer={viewer}
          theme={theme}
          profiles={profiles}
          listings={marketplace.listings}
          onOpenProfile={openProfile}
          onSelectSection={selectSection}
          autoFocus={isActive}
        />
      );
    }

    if (section === "groups") {
      return (
        <GroupsSkeleton
          currentUserId={CURRENT_DEVELOPMENT_USER_ID}
          theme={theme}
          organizations={organizations}
        />
      );
    }

    if (section === "food") {
      return (
        <FoodSkeleton
          universityId={user.universityId}
          theme={theme}
        />
      );
    }

    if (section === "housing") {
      return (
        <HousingSkeleton
          universityId={user.universityId}
          theme={theme}
        />
      );
    }

    if (section === "career") {
      return (
        <CareerSkeleton
          universityId={user.universityId}
          theme={theme}
          profile={academics.profiles[user.universityId]}
        />
      );
    }

    if (section === "marketplace") {
      return (
        <SimpleMarketplace
          user={user}
          theme={theme}
          marketplace={marketplace}
          permissionMode={marketplacePermissionMode}
          onOpenProfile={openProfile}
        />
      );
    }

    if (section === "profile") {
      return (
        <ProfilesHub
          mode="profile"
          selectedUserId={selectedProfileUserId}
          viewer={viewer}
          theme={theme}
          visibleStories={visibleStories}
          marketplaceListings={marketplace.listings}
          profiles={profiles}
          mintz={mintz}
          organizations={organizations}
          onOpenProfile={openProfile}
          onBackToPeople={() => selectSection("people")}
        />
      );
    }

    return null;
  }

  function sectionFrame(section: SwipeSection, isActive: boolean) {
    return (
      <div
        className={`mx-auto px-4 pb-36 pt-5 sm:px-6 ${
          section === "mint" ? "max-w-[42rem]" : "max-w-5xl"
        }`}
      >
        {sectionContent(section, isActive)}
      </div>
    );
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

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  return (
    <main
      className="campus-app-shell min-h-dvh overflow-x-hidden text-slate-950"
      style={shellStyle}
      data-appearance={preferenceState.preferences.appearance.mode}
      data-reduced-motion={
        preferenceState.preferences.content.reducedMotion ? "true" : "false"
      }
      onPointerMoveCapture={handleGlobalIconPointerMove}
      onPointerDownCapture={handleGlobalIconPointerDown}
      onPointerUpCapture={handleGlobalIconPointerUp}
      onPointerCancelCapture={handleGlobalIconPointerUp}
      onPointerOutCapture={handleGlobalIconPointerOut}
      onTouchStart={beginSearchTouch}
      onTouchEnd={finishSearchTouch}
      onTouchCancel={() => {
        searchTouchRef.current = null;
      }}
    >
      <TopUtilityBar
        viewer={viewer}
        theme={theme}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenProfile={() => openProfile(CURRENT_DEVELOPMENT_USER_ID)}
        developerControls={
          showDeveloperControls ? (
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
          ) : undefined
        }
      />

      {activeSection === "profile" ? (
        <div className="mx-auto max-w-5xl px-4 pb-36 pt-5 sm:px-6">
          {sectionContent("profile", true)}
        </div>
      ) : (
        <div
          className="relative touch-pan-y overflow-hidden"
          onPointerDown={beginPageSwipe}
          onPointerMove={updatePageSwipe}
          onPointerUp={finishPageSwipe}
          onPointerCancel={cancelPageSwipe}
        >
          <div
            className="flex w-[300%] transform-gpu items-start will-change-transform"
            style={{
              transform: `translate3d(calc(-33.333333% + ${
                swipeProgress * 33.333333
              }%), 0, 0)`,
              transition:
                preferenceState.preferences.content.reducedMotion ||
                !swipeSettling
                  ? "none"
                  : `transform ${HORIZONTAL_SNAP_MS}ms cubic-bezier(.22,1,.36,1)`,
            }}
          >
            {swipeSections.map((section) => (
              <div key={section} className="w-1/3 shrink-0">
                {sectionFrame(section, section === activeSection)}
              </div>
            ))}
          </div>
        </div>
      )}

      <BottomBubbleNav
        activeSection={activeSection}
        virtualIndex={navIndex}
        swipeProgress={swipeProgress}
        swipeSettling={swipeSettling}
        reducedMotion={preferenceState.preferences.content.reducedMotion}
        onSelect={selectSection}
        onSwipeDelta={applyHorizontalDelta}
        onSwipeEnd={finishHorizontalGesture}
        onSwipeCancel={cancelHorizontalGesture}
      />

      {settingsOpen && (
        <SettingsPanel
          viewer={viewer}
          theme={theme}
          profiles={profiles}
          preferenceState={preferenceState}
          onOpenProfile={() => openProfile(CURRENT_DEVELOPMENT_USER_ID)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}
