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
import { StudentEmailOnboarding } from "@/components/onboarding/StudentEmailOnboarding";
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
import { FoodSkeleton } from "@/components/secondary/FoodSkeleton";
import { HousingSkeleton } from "@/components/secondary/HousingSkeleton";
import { DeveloperUniversitySwitcher } from "@/components/university/DeveloperUniversitySwitcher";
import { CURRENT_DEVELOPMENT_USER_ID } from "@/data/development/users";
import { getAppearanceTokens } from "@/data/appearance";
import { getOrganizationById } from "@/data/organizations";
import { type UserRole } from "@/data/userRoles";
import { universities,
  type UniversityId,
  getAccountConfiguredUniversityId,
  getAccountUniversityDisplayTheme,
} from "@/data/universities";
import { useAcademics } from "@/hooks/useAcademics";
import { useAppPreferences } from "@/hooks/useAppPreferences";
import { useDirectMint } from "@/hooks/useDirectMint";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useMintz } from "@/hooks/useMintz";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useProfiles } from "@/hooks/useProfiles";
import { useStories } from "@/hooks/useStories";
import { canJoinOrganization } from "@/lib/organizationPermissions";
import { getVisibleStories } from "@/lib/storyPermissions";
import type { Organization } from "@/types/organization";
import type { TemporaryUser } from "@/types/user";

type SwipeSection = Exclude<PrimarySection, "profile" | "search">;

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
const HORIZONTAL_SNAP_MS = 460;
const MINT_HOME_SWEEP_MS = 460;
const ACTIVE_SECTION_STORAGE_KEY =
  "campusmint:active-section:v1";

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
  const [navIndex, setNavIndex] = useState(() => {
    if (typeof window === "undefined") {
      return INITIAL_MINT_INDEX >= 0
        ? INITIAL_MINT_INDEX
        : 0;
    }

    const savedSection =
      window.localStorage.getItem(
        ACTIVE_SECTION_STORAGE_KEY,
      ) as SwipeSection | null;

    const savedIndex = savedSection
      ? sectionSequence.indexOf(savedSection)
      : -1;

    return savedIndex >= 0
      ? savedIndex
      : INITIAL_MINT_INDEX >= 0
        ? INITIAL_MINT_INDEX
        : 0;
  });
  const [specialSection, setSpecialSection] =
    useState<"profile" | "search" | null>(null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [swipeSettling, setSwipeSettling] = useState(false);
  const [mintSweepProgress, setMintSweepProgress] =
    useState<-1 | 1 | null>(null);
  const [selectedProfileUserId, setSelectedProfileUserId] =
    useState(CURRENT_DEVELOPMENT_USER_ID);
  const [directMintReturnUserId, setDirectMintReturnUserId] =
    useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mintHeaderHidden, setMintHeaderHidden] = useState(false);
  const [user, setUser] = useState<TemporaryUser>(initialUser);
  const [onboardingOpen, setOnboardingOpen] = useState(true);

  const swipeProgressRef = useRef(0);
  const settleTimerRef = useRef<number | null>(null);
  const pageDragRef = useRef<PageDragState | null>(null);
  const searchTouchRef = useRef<SearchTouchState>(null);
  const mintReturnTimerRef = useRef<number | null>(null);
  const profileReturnSectionRef =
    useRef<SwipeSection>("mint");
  const [specialPageLeaving, setSpecialPageLeaving] =
    useState(false);

  const academics = useAcademics();
  const marketplace = useMarketplace();
  const mintz = useMintz();
  const directMint = useDirectMint(
    CURRENT_DEVELOPMENT_USER_ID,
  );
  const organizations = useOrganizations(CURRENT_DEVELOPMENT_USER_ID);
  const profiles = useProfiles();
  const stories = useStories();
  const preferenceState = useAppPreferences();

  useEffect(() => {
    if (!profiles.developmentProfileHydrated) return;

    const account = profiles.currentUser.account;

    setOnboardingOpen(
      !account.onboardingCompletedAt,
    );

    setUser((current) => ({
      ...current,
      firstName:
        profiles.currentUser.profile.firstName ||
        current.firstName,
      universityId:
        account.knownUniversityId ??
        account.universityId,
      role: account.role,
      verifiedStudent:
        account.verifiedStudent,
    }));
  }, [
    profiles.currentUser,
    profiles.developmentProfileHydrated,
  ]);

  const theme =
    getAccountUniversityDisplayTheme(
      profiles.currentUser.account,
    );

  const configuredUniversityId =
    getAccountConfiguredUniversityId(
      profiles.currentUser.account,
    );

  const currentNavigationSection =
    sectionSequence[mod(navIndex, SECTION_COUNT)] ?? "mint";

  useEffect(() => {
    window.localStorage.setItem(
      ACTIVE_SECTION_STORAGE_KEY,
      currentNavigationSection,
    );
  }, [currentNavigationSection]);

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
    mintSweepProgress === 1
      ? "mint"
      : sectionSequence[mod(navIndex - 1, SECTION_COUNT)] ?? "marketplace";

  const nextSection =
    mintSweepProgress === -1
      ? "mint"
      : sectionSequence[mod(navIndex + 1, SECTION_COUNT)] ?? "messages";

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

    if (section === "messages") {
      setDirectMintReturnUserId(null);
    }

    if (section === "profile" || section === "search") {
      setSpecialSection(section);
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

    if (!specialSection) {
      profileReturnSectionRef.current =
        currentNavigationSection;
    }

    setSpecialPageLeaving(false);
    setSelectedProfileUserId(userId);
    setSpecialSection("profile");
  }

  function leaveProfileTo(section: SwipeSection) {
    const finish = () => {
      const targetIndex =
        sectionSequence.indexOf(section);

      if (targetIndex >= 0) {
        setNavIndex((current) =>
          nearestVirtualIndex(
            current,
            targetIndex,
          ),
        );
      }

      setSpecialSection(null);
      setSpecialPageLeaving(false);
      setGestureProgress(0);
    };

    if (
      preferenceState.preferences.content
        .reducedMotion
    ) {
      finish();
      return;
    }

    setSpecialPageLeaving(true);

    window.setTimeout(finish, 460);
  }

  function goBackFromProfile() {
    leaveProfileTo(
      profileReturnSectionRef.current,
    );
  }


  function openDirectMintFromProfile(
    userId: string,
  ) {
    directMint.startConversation(userId);
    setDirectMintReturnUserId(userId);

    const targetIndex =
      sectionSequence.indexOf("messages");

    const finish = () => {
      if (targetIndex >= 0) {
        setNavIndex((current) =>
          nearestVirtualIndex(
            current,
            targetIndex,
          ),
        );
      }

      setSpecialSection(null);
      setSpecialPageLeaving(false);
      setGestureProgress(0);
    };

    if (
      preferenceState.preferences.content
        .reducedMotion
    ) {
      finish();
      return;
    }

    setSpecialPageLeaving(true);
    window.setTimeout(finish, 460);
  }

  function returnToProfileFromDirectMint() {
    if (!directMintReturnUserId) return;

    setSelectedProfileUserId(
      directMintReturnUserId,
    );

    /*
     * Do NOT call openProfile() here.
     * That would overwrite the original People return
     * destination with Messages.
     */
    setDirectMintReturnUserId(null);
    setSpecialPageLeaving(false);
    setSpecialSection("profile");
    setGestureProgress(0);
  }

  function clearMintReturnTimer() {
    if (mintReturnTimerRef.current === null) return;

    window.clearTimeout(mintReturnTimerRef.current);
    mintReturnTimerRef.current = null;
  }

  function scrollMintHomeToTop() {
    setMintHeaderHidden(false);

    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          "[data-mint-snap-feed]",
        )
        ?.scrollTo({
          top: 0,
          behavior:
            preferenceState.preferences.content.reducedMotion
              ? "auto"
              : "smooth",
        });
    });
  }

  function animateTrackToMint(startingIndex = navIndex) {
    clearSettleTimer();
    clearMintReturnTimer();

    const mintIndex = sectionSequence.indexOf("mint");
    if (mintIndex < 0) return;

    const destination =
      nearestVirtualIndex(startingIndex, mintIndex);

    if (
      preferenceState.preferences.content.reducedMotion ||
      destination === startingIndex
    ) {
      setMintSweepProgress(null);
      setNavIndex(destination);
      setGestureProgress(0);
      setSwipeSettling(false);
      scrollMintHomeToTop();
      return;
    }

    const sweepProgress: -1 | 1 =
      destination > startingIndex ? -1 : 1;

    /*
     * Mint becomes the immediate visual neighbor,
     * regardless of how many navigation sections away it is.
     * This gives us one continuous iOS-style sweep instead
     * of pausing at every intermediate tab.
     */
    setMintSweepProgress(sweepProgress);
    setSwipeSettling(true);
    setGestureProgress(0);

    // Give React one frame to paint Mint into the destination
    // slot before moving the track.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setGestureProgress(sweepProgress);
      });
    });

    mintReturnTimerRef.current = window.setTimeout(() => {
      setNavIndex(destination);
      setGestureProgress(0);
      setSwipeSettling(false);
      setMintSweepProgress(null);
      mintReturnTimerRef.current = null;

      scrollMintHomeToTop();
    }, MINT_HOME_SWEEP_MS);
  }

  function handleMintTap() {
    clearMintReturnTimer();

    if (specialSection === "search") {
      setSpecialSection(null);
      animateTrackToMint(navIndex);
      return;
    }

    if (specialSection === "profile") {
      if (
        preferenceState.preferences.content.reducedMotion
      ) {
        setSpecialSection(null);
        setSpecialPageLeaving(false);
        animateTrackToMint(navIndex);
        return;
      }

      // First slide the profile away, then visibly travel
      // through the section track until Mint is centered.
      setSpecialPageLeaving(true);

      mintReturnTimerRef.current = window.setTimeout(() => {
        setSpecialSection(null);
        setSpecialPageLeaving(false);
        animateTrackToMint(navIndex);
      }, 330);

      return;
    }

    if (currentNavigationSection !== "mint") {
      animateTrackToMint(navIndex);
      return;
    }

    scrollMintHomeToTop();
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
      swipeProgressRef.current + velocitySectionsPerMs * 255;

    let target = 0;

    if (projected <= -0.14) target = -1;
    if (projected >= 0.14) target = 1;

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
    clearMintReturnTimer();

    if (mintSweepProgress !== null) {
      setMintSweepProgress(null);
      setGestureProgress(0);
      setSwipeSettling(false);
    }

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
      if (Math.max(Math.abs(totalX), Math.abs(totalY)) < 5) return;

      if (Math.abs(totalX) > Math.abs(totalY) * 1.08) {
        drag.axis = "horizontal";
        drag.lastX = event.clientX;
        drag.lastTime = event.timeStamp;

        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }

        return;
      }

      if (Math.abs(totalY) > Math.abs(totalX) * 1.08) {
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

    applyHorizontalDelta(
      deltaX / (viewportWidth * 0.86),
      drag.velocity / 0.86,
    );
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

    // Settings category controls keep perfectly stable geometry.
    if (control.hasAttribute("data-static-control")) return null;

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

  function scrollMintFeedToTop() {
    setMintHeaderHidden(false);

    const scrollFeed = () => {
      const feed =
        document.querySelector<HTMLElement>(
          "[data-mint-snap-feed]",
        );

      feed?.scrollTo({
        top: 0,
        behavior:
          preferenceState.preferences.content
            .reducedMotion
            ? "auto"
            : "smooth",
      });
    };

    if (activeSection !== "mint") {
      selectSection("mint");
      window.setTimeout(scrollFeed, 0);
      return;
    }

    scrollFeed();
  }

  function refreshMintFeed() {
    window.location.reload();
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
          defaultHideLikeCounts={preferenceState.preferences.content.hideLikeCountsDefault} onFeedChromeChange={setMintHeaderHidden} onRefresh={refreshMintFeed}
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
          configuredUniversityId={
            configuredUniversityId
          }
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
          directMint={directMint}
          requestedUserId={
            directMintReturnUserId
          }
          onBackToProfile={
            directMintReturnUserId
              ? returnToProfileFromDirectMint
              : undefined
          }
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
          universityId={
            configuredUniversityId
          }
          theme={theme}
        />
      );
    }

    if (section === "housing") {
      return (
        <HousingSkeleton
          universityId={
            configuredUniversityId
          }
          theme={theme}
        />
      );
    }

    if (section === "marketplace") {
      return (
        <SimpleMarketplace
          user={user}
          configuredUniversityId={
            configuredUniversityId
          }
          theme={theme}
          marketplace={marketplace}
          permissionMode={marketplacePermissionMode}
          onOpenProfile={openProfile}
        />
      );
    }

    if (section === "profile") {
      return (
        <div
          className={`cm-special-page ${
            specialPageLeaving
              ? "is-leaving"
              : ""
          }`}
        >
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
            onOpenDirectMint={openDirectMintFromProfile}
            onOpenProfile={openProfile}
            onBack={goBackFromProfile}
          />
        </div>
      );
    }

    return null;
  }

  function sectionFrame(section: SwipeSection, isActive: boolean) {
    return (
      <div
        className={`mx-auto pb-3 pt-2 sm:pb-36 sm:pt-5 ${
          section === "mint"
            ? "max-w-[44rem] px-2.5 sm:px-5 lg:px-6"
            : "max-w-5xl px-4 sm:px-6"
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

      if (mintReturnTimerRef.current) {
        window.clearTimeout(mintReturnTimerRef.current);
      }
    };
  }, []);

  if (!profiles.developmentProfileHydrated) {
    return (
      <main className="min-h-dvh bg-white" />
    );
  }

  if (onboardingOpen) {
    return (
      <StudentEmailOnboarding
        onVerified={(
          resolved,
          personalEmail,
          primaryEmail,
          profileSetup,
        ) => {
          const verifiedAt = new Date().toISOString();

          profiles.updateCurrentAccount({
            studentEmail: resolved.email,
            personalEmail,
            primaryEmail,
            phoneNumber: profileSetup.phoneNumber,
            studentEmailDomain: resolved.domain,
            studentEmailVerifiedAt: verifiedAt,
            studentEmailVerificationMethod: "edu_email",
            onboardingCompletedAt: verifiedAt,
            universityIdentityId: resolved.identity.id,
            universityDomain: resolved.identity.domain,
            universityName: resolved.identity.name,
            universityShortName: resolved.identity.shortName,
            knownUniversityId:
              resolved.identity.knownUniversityId as UniversityId | null,
            verifiedStudent: true,
          });

          const profileResult =
            profiles.updateCurrentProfile({
              firstName: profileSetup.firstName,
              lastName: profileSetup.lastName,
              displayName: `${profileSetup.firstName} ${profileSetup.lastName}`,
              username: profileSetup.username,
              bio: profileSetup.bio,
              interests: profileSetup.interests,
              hobbies: profileSetup.hobbies,
              academicArea:
                profileSetup.academicArea,
              lookingForRoommate:
                profileSetup.lookingForRoommate,
              roommatePreferences:
                profileSetup.roommatePreferences,
              offersTutoring:
                profileSetup.offersTutoring,
              tutoringSubjects:
                profileSetup.tutoringSubjects,
              clubIds: profileSetup.clubIds,
            });

          if (!profileResult.ok) {
            return;
          }

          for (const clubId of profileSetup.clubIds) {
            const organization =
              getOrganizationById(clubId);

            if (organization) {
              organizations.joinOrRequest(
                organization,
              );
            }
          }

          setUser((current) => ({
            ...current,
            firstName: profileSetup.firstName,
            universityId:
              (resolved.identity.knownUniversityId as UniversityId | null) ??
              current.universityId,
            verifiedStudent: true,
          }));

          setOnboardingOpen(false);
        }}
      />
    );
  }


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
        hidden={activeSection === "mint" && mintHeaderHidden} viewer={viewer}
        theme={theme}
        onOpenSettings={() => {
          setNotificationsOpen(false);
          setSettingsOpen(true);
        }}
        onOpenNotifications={() => {
          setSettingsOpen(false);
          setNotificationsOpen((open) => !open);
        }}
        onOpenProfile={() => {
          setNotificationsOpen(false);
          openProfile(CURRENT_DEVELOPMENT_USER_ID);
        }}
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

      {specialSection ? (
        <div className="mx-auto max-w-5xl px-4 pb-36 pt-5 sm:px-6">
          {sectionContent(specialSection, true)}
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
        onMintTap={handleMintTap}
      />

      {notificationsOpen && (
        <div className="fixed right-3 top-[4.35rem] z-[70] w-[min(22rem,calc(100vw-1.5rem))] rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-[0_18px_55px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-black text-slate-950">
              Notifications
            </h2>
            <button
              type="button"
              onClick={() => setNotificationsOpen(false)}
              aria-label="Close notifications"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-600"
            >
              ×
            </button>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Notifications will appear here as Campus Mint activity is connected.
          </p>
        </div>
      )}

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
