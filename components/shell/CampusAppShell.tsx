"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type TouchEvent,
  } from "react";

import { CreateContentFlow } from "@/components/content/CreateContentFlow";
import { DeveloperRoleSwitcher } from "@/components/developer/DeveloperRoleSwitcher";
import { DeveloperSoundPreview } from "@/components/developer/DeveloperSoundPreview";
import { GroupsSkeleton } from "@/components/groups/GroupsSkeleton";
import { MessagesSkeleton } from "@/components/messages/MessagesSkeleton";
import { CampusMintFeed } from "@/components/mintz/CampusMintFeed";
import { StudentEmailOnboarding } from "@/components/onboarding/StudentEmailOnboarding";
import { ProfilesHub } from "@/components/profile/ProfilesHub";
import { GlobalSearchOverlay } from "@/components/search/GlobalSearchOverlay";
import { GlobalSearchSkeleton } from "@/components/search/GlobalSearchSkeleton";
import { SportsHub } from "@/components/sports/SportsHub";
import { BottomBubbleNav } from "@/components/shell/BottomBubbleNav";
import {
  type PrimarySection,
  type SwipeSection,
  dailyNavigation,
  migrateStoredPrimarySection,
  secondaryNavigation,
  } from "@/components/shell/navigation";
import { SettingsPanel } from "@/components/shell/SettingsPanel";
import { TopUtilityBar } from "@/components/shell/TopUtilityBar";
import { DeveloperUniversitySwitcher } from "@/components/university/DeveloperUniversitySwitcher";
import { CURRENT_DEVELOPMENT_USER_ID } from "@/data/development/users";
import { getAppearanceTokens } from "@/data/appearance";
import { getOrganizationById } from "@/data/organizations";
import { type UserRole } from "@/data/userRoles";
import {
  type UniversityId,
  getAccountConfiguredUniversityId,
  getAccountUniversityDisplayTheme,
} from "@/data/universities";
import { useAppPreferences } from "@/hooks/useAppPreferences";
import { useDirectMint } from "@/hooks/useDirectMint";
import { useEventMoments } from "@/hooks/useEventMoments";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useMintz } from "@/hooks/useMintz";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useProfiles } from "@/hooks/useProfiles";
import { useStories } from "@/hooks/useStories";
import { canJoinOrganization } from "@/lib/organizationPermissions";
import {
  prepareLocalMintMedia,
  type LocalMintMediaSelection,
} from "@/lib/content/localMintMedia";
import { SectionMemory } from "@/lib/navigation/sectionMemory";
import {
  initialUnifiedSearchState,
  migrateUnifiedSearchCategory,
  requestUnifiedSearchDismiss,
  type UnifiedSearchState,
} from "@/lib/search/unifiedSearch";
import { getVisibleStories } from "@/lib/storyPermissions";
import type { Organization } from "@/types/organization";
import type { TemporaryUser } from "@/types/user";

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
const sectionSequence: SwipeSection[] = navigation.map((item) => item.id);
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
const initialDeveloperUniversityOverride = showDeveloperControls
  ? initialUser.universityId
  : null;
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

    const savedSection = migrateStoredPrimarySection(
      window.localStorage.getItem(ACTIVE_SECTION_STORAGE_KEY),
    );

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
    useState<"profile" | null>(null);
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [createMintOpen, setCreateMintOpen] = useState(false);
  const [createMintMedia, setCreateMintMedia] =
    useState<LocalMintMediaSelection[]>([]);
  const [createMintMediaError, setCreateMintMediaError] =
    useState<string | null>(null);
  const [createMintMediaPreparing, setCreateMintMediaPreparing] =
    useState(false);
  const [mintHeaderHidden, setMintHeaderHidden] = useState(false);
  const [user, setUser] = useState<TemporaryUser>(initialUser);
  const [developerUniversityOverride, setDeveloperUniversityOverride] =
    useState<UniversityId | null>(initialDeveloperUniversityOverride);
  const [unifiedSearchState, setUnifiedSearchState] =
    useState<UnifiedSearchState>(() => ({ ...initialUnifiedSearchState }));
  const [onboardingOpen, setOnboardingOpen] = useState(true);

  const swipeProgressRef = useRef(0);
  const settleTimerRef = useRef<number | null>(null);
  const pageDragRef = useRef<PageDragState | null>(null);
  const searchTouchRef = useRef<SearchTouchState>(null);
  const searchScrollYRef = useRef(0);
  const profileHydrationAppliedRef = useRef(false);
  const mintReturnTimerRef = useRef<number | null>(null);
  const sectionCommitFrameRef = useRef<number | null>(null);
  const scrollRestoreFrameRef = useRef<number | null>(null);
  const createMintFileInputRef = useRef<HTMLInputElement>(null);
  const createMintMediaRequestRef = useRef(0);
  const profileReturnSectionRef =
    useRef<SwipeSection>("mint");
  const profileReturnScrollRef = useRef(0);
  const specialScrollPositionsRef = useRef(new Map<string, number>());
  const scrollOwnerSectionRef = useRef<SwipeSection | null>(null);
  const [specialPageLeaving, setSpecialPageLeaving] =
    useState(false);

  const marketplace = useMarketplace();
  const mintz = useMintz();
  const directMint = useDirectMint(
    CURRENT_DEVELOPMENT_USER_ID,
  );
  const eventMoments = useEventMoments();
  const organizations = useOrganizations(CURRENT_DEVELOPMENT_USER_ID);
  const profiles = useProfiles();
  const stories = useStories();
  const preferenceState = useAppPreferences();

  useEffect(() => {
    if (
      !profiles.developmentProfileHydrated ||
      profileHydrationAppliedRef.current
    ) {
      return;
    }

    profileHydrationAppliedRef.current = true;

    const account = profiles.currentUser.account;

    // Profile hydration is the external boundary that opens/closes onboarding.
    setOnboardingOpen(
      !account.onboardingCompletedAt,
    );

    setUser((current) => ({
      ...current,
      firstName:
        profiles.currentUser.profile.firstName ||
        current.firstName,
      universityId:
        account.onboardingCompletedAt
          ? account.knownUniversityId ?? account.universityId
          : current.universityId,
      role: account.role,
      verifiedStudent:
        account.verifiedStudent,
    }));

    if (account.onboardingCompletedAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeveloperUniversityOverride(null);
    }
  }, [
    profiles.currentUser,
    profiles.developmentProfileHydrated,
  ]);

  const currentNavigationSection =
    sectionSequence[mod(navIndex, SECTION_COUNT)] ?? "mint";

  const sectionMemoryRef = useRef<SectionMemory<SwipeSection> | null>(null);

  if (sectionMemoryRef.current === null) {
    sectionMemoryRef.current = new SectionMemory(currentNavigationSection, 2);
    scrollOwnerSectionRef.current = currentNavigationSection;
  }

  const committedSectionRef = useRef<SwipeSection>(
    currentNavigationSection,
  );
  const [viewportScrollY, setViewportScrollY] = useState(0);
  const [, setSectionMemoryRevision] = useState(0);

  useEffect(() => {
    let animationFrame: number | null = null;

    const captureScroll = () => {
      const scrollY = window.scrollY;
      const owner = scrollOwnerSectionRef.current;

      if (owner) {
        sectionMemoryRef.current?.capture(owner, scrollY);
      }

      if (animationFrame !== null) return;

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        setViewportScrollY(window.scrollY);
      });
    };

    captureScroll();
    window.addEventListener("scroll", captureScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", captureScroll);
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(ACTIVE_SECTION_STORAGE_KEY);
    const migrated = migrateStoredPrimarySection(saved);
    if (saved !== migrated) {
      window.localStorage.setItem(ACTIVE_SECTION_STORAGE_KEY, migrated);
    }
  }, []);

  useEffect(() => {
    // Normalize legacy in-memory/HMR Search state without touching preferences.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnifiedSearchState((current) => {
      const category = migrateUnifiedSearchCategory(current.category);
      return category === current.category
        ? current
        : { ...current, category, history: [] };
    });
  }, []);

  const activeSection: PrimarySection =
    specialSection ?? currentNavigationSection;

  const viewer = useMemo(
    () => {
      const account = developerUniversityOverride
        ? {
            ...profiles.currentUser.account,
            universityId: developerUniversityOverride,
            universityIdentityId: null,
            universityDomain: null,
            universityName: null,
            universityShortName: null,
            knownUniversityId: developerUniversityOverride,
          }
        : profiles.currentUser.account;

      return {
        ...profiles.currentUser,
        account: {
          ...account,
          role: user.role,
          verifiedStudent: user.verifiedStudent ?? false,
        },
      };
    },
    [
      developerUniversityOverride,
      profiles.currentUser,
      user.role,
      user.verifiedStudent,
    ],
  );

  const theme = getAccountUniversityDisplayTheme(viewer.account);

  const configuredUniversityId =
    getAccountConfiguredUniversityId(viewer.account);

  const appearanceTokens = useMemo(
    () =>
      getAppearanceTokens(
        preferenceState.preferences.appearance,
        theme,
      ),
    [preferenceState.preferences.appearance, theme],
  );

  const createMintUsers = useMemo(
    () =>
      profiles.users.map((candidate) =>
        candidate.account.id === viewer.account.id ? viewer : candidate,
      ),
    [profiles.users, viewer],
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
      : sectionSequence[mod(navIndex - 1, SECTION_COUNT)] ?? "groups";

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

  function captureCurrentMainScroll() {
    const owner = scrollOwnerSectionRef.current;
    if (!owner) return;

    sectionMemoryRef.current?.capture(owner, window.scrollY);
  }

  function restoreWindowScroll(scrollY: number) {
    const nextScrollY = Math.max(0, scrollY);

    if (scrollRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollRestoreFrameRef.current);
    }

    scrollRestoreFrameRef.current = window.requestAnimationFrame(() => {
      scrollRestoreFrameRef.current = window.requestAnimationFrame(() => {
        scrollRestoreFrameRef.current = null;
        window.scrollTo({ top: nextScrollY, behavior: "auto" });
        setViewportScrollY(nextScrollY);
      });
    });
  }

  function commitMainSection(
    section: SwipeSection,
    scrollOverride?: number,
  ) {
    const result = sectionMemoryRef.current?.commit(section);

    committedSectionRef.current = section;
    scrollOwnerSectionRef.current = section;
    window.localStorage.setItem(ACTIVE_SECTION_STORAGE_KEY, section);

    if (result?.refreshed) {
      if (section === "mint") {
        mintz.refreshMintz();
      }

      setSectionMemoryRevision((current) => current + 1);
    }

    restoreWindowScroll(scrollOverride ?? result?.scrollY ?? 0);
  }

  function scheduleMainSectionCommit(
    section: SwipeSection,
    scrollOverride?: number,
  ) {
    if (sectionCommitFrameRef.current !== null) {
      window.cancelAnimationFrame(sectionCommitFrameRef.current);
    }

    sectionCommitFrameRef.current = window.requestAnimationFrame(() => {
      sectionCommitFrameRef.current = null;
      commitMainSection(section, scrollOverride);
    });
  }

  function cancelScheduledMainSectionCommit() {
    if (sectionCommitFrameRef.current === null) return;

    window.cancelAnimationFrame(sectionCommitFrameRef.current);
    sectionCommitFrameRef.current = null;
  }

  function specialPageKey(
    section: "profile",
    profileUserId = selectedProfileUserId,
  ) {
    return section === "profile"
      ? `profile:${profileUserId}`
      : section;
  }

  function captureSpecialPageScroll() {
    if (!specialSection) return;

    specialScrollPositionsRef.current.set(
      specialPageKey(specialSection),
      window.scrollY,
    );
  }

  function restoreSpecialPageScroll(key: string) {
    scrollOwnerSectionRef.current = null;
    restoreWindowScroll(specialScrollPositionsRef.current.get(key) ?? 0);
  }

  function changeUniversity(universityId: UniversityId) {
    setUser((current) => ({ ...current, universityId }));
    setDeveloperUniversityOverride(universityId);
    setUnifiedSearchState((current) => ({ ...current, history: [] }));
  }

  function changeRole(role: UserRole) {
    setUser((current) => ({ ...current, role }));
    setUnifiedSearchState((current) => ({ ...current, history: [] }));
  }

  function selectSection(section: PrimarySection) {
    clearSettleTimer();
    setSwipeSettling(false);
    setGestureProgress(0);

    if (section === "messages") {
      setDirectMintReturnUserId(null);
    }

    if (section === "profile") {
      cancelScheduledMainSectionCommit();
      openProfile(CURRENT_DEVELOPMENT_USER_ID);
      return;
    }

    const targetIndex = sectionSequence.indexOf(section);
    if (targetIndex < 0) return;

    captureCurrentMainScroll();
    captureSpecialPageScroll();
    setSpecialSection(null);
    setNavIndex((current) => nearestVirtualIndex(current, targetIndex));
    scheduleMainSectionCommit(section);
  }

  function openProfile(userId: string) {
    cancelScheduledMainSectionCommit();
    clearSettleTimer();
    setGestureProgress(0);
    setSwipeSettling(false);

    if (!specialSection) {
      profileReturnSectionRef.current =
        committedSectionRef.current;
      profileReturnScrollRef.current = window.scrollY;
      captureCurrentMainScroll();
    } else {
      captureSpecialPageScroll();
    }

    setSpecialPageLeaving(false);
    setSelectedProfileUserId(userId);
    setSpecialSection("profile");
    restoreSpecialPageScroll(specialPageKey("profile", userId));
  }

  function leaveProfileTo(section: SwipeSection) {
    captureSpecialPageScroll();

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
      scheduleMainSectionCommit(
        section,
        section === profileReturnSectionRef.current
          ? profileReturnScrollRef.current
          : undefined,
      );
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
    captureSpecialPageScroll();
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
      scrollOwnerSectionRef.current = null;
      restoreWindowScroll(0);
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

  function openDirectMintFromSearch(userId: string) {
    directMint.startConversation(userId);
    setDirectMintReturnUserId(null);
    setSearchOpen(false);
    selectSection("messages");
  }

  function openSearchOverlay() {
    setSettingsOpen(false);
    setNotificationsOpen(false);
    setSearchOpen(true);
  }

  function dismissSearchOverlay() {
    const result = requestUnifiedSearchDismiss(unifiedSearchState);

    if (result.closeOverlay) {
      setSearchOpen(false);
      return;
    }

    setUnifiedSearchState(result.state);
  }

  function openCreateMintMediaPicker() {
    const input = createMintFileInputRef.current;
    if (!input) return;

    input.value = "";
    input.click();
  }

  function beginCreateMint() {
    createMintMediaRequestRef.current += 1;
    setCreateMintMedia([]);
    setCreateMintMediaError(null);
    setCreateMintMediaPreparing(false);
    setCreateMintOpen(true);
    openCreateMintMediaPicker();
  }

  async function selectCreateMintMedia(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length === 0) return;

    const requestId = createMintMediaRequestRef.current + 1;
    createMintMediaRequestRef.current = requestId;
    setCreateMintMediaPreparing(true);
    setCreateMintMediaError(null);

    const prepared = await prepareLocalMintMedia(files);
    if (requestId !== createMintMediaRequestRef.current) return;

    setCreateMintMedia(prepared.accepted);
    setCreateMintMediaPreparing(false);

    if (prepared.rejectedFileNames.length > 0) {
      setCreateMintMediaError(
        `${prepared.rejectedFileNames.length} unsupported or unreadable file${prepared.rejectedFileNames.length === 1 ? " was" : "s were"} skipped.`,
      );
    }
  }

  function closeCreateMint() {
    createMintMediaRequestRef.current += 1;
    setCreateMintOpen(false);
    setCreateMintMedia([]);
    setCreateMintMediaError(null);
    setCreateMintMediaPreparing(false);
  }

  function logoutDevelopmentUser() {
    profiles.logoutDevelopmentUser();
    closeCreateMint();
    setSearchOpen(false);
    setSpecialSection(null);
    setSelectedProfileUserId(CURRENT_DEVELOPMENT_USER_ID);
    setUnifiedSearchState({ ...initialUnifiedSearchState });
    setUser(initialUser);
    setDeveloperUniversityOverride(initialDeveloperUniversityOverride);
    setOnboardingOpen(true);
  }

  function returnToProfileFromDirectMint() {
    if (!directMintReturnUserId) return;

    setSelectedProfileUserId(
      directMintReturnUserId,
    );

    /*
     * Do NOT call openProfile() here.
     * That would overwrite the original profile return
     * destination with Messages.
     */
    setDirectMintReturnUserId(null);
    setSpecialPageLeaving(false);
    setSpecialSection("profile");
    setGestureProgress(0);
    restoreSpecialPageScroll(
      specialPageKey("profile", directMintReturnUserId),
    );
  }

  function clearMintReturnTimer() {
    if (mintReturnTimerRef.current === null) return;

    window.clearTimeout(mintReturnTimerRef.current);
    mintReturnTimerRef.current = null;
  }

  function scrollMintHomeToTop() {
    setMintHeaderHidden(false);
    sectionMemoryRef.current?.capture("mint", 0);
    window.scrollTo({ top: 0, behavior: "auto" });
    setViewportScrollY(0);

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
    captureCurrentMainScroll();

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
      scheduleMainSectionCommit("mint", 0);
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
      scheduleMainSectionCommit("mint", 0);
    }, MINT_HOME_SWEEP_MS);
  }

  function handleMintTap() {
    clearMintReturnTimer();

    if (specialSection === "profile") {
      captureSpecialPageScroll();
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

    captureCurrentMainScroll();
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

    const destinationIndex =
      navIndex + (target < 0 ? 1 : target > 0 ? -1 : 0);
    const destinationSection =
      sectionSequence[mod(destinationIndex, SECTION_COUNT)] ?? "mint";

    if (preferenceState.preferences.content.reducedMotion) {
      if (target < 0) {
        setNavIndex((current) => current + 1);
      } else if (target > 0) {
        setNavIndex((current) => current - 1);
      }

      setGestureProgress(0);
      scheduleMainSectionCommit(destinationSection);
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
      scheduleMainSectionCommit(destinationSection);
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

    captureCurrentMainScroll();

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
      searchOpen ||
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
      openSearchOverlay();
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

  function refreshMintFeed() {
    const result = sectionMemoryRef.current?.refresh("mint");
    mintz.refreshMintz();
    setMintHeaderHidden(false);
    setSectionMemoryRevision((current) => current + 1);

    if (result) {
      restoreWindowScroll(result.scrollY);
    }
  }

  function sectionContent(section: PrimarySection): ReactNode {
    if (section === "mint") {
      return (
        <CampusMintFeed
          viewer={viewer}
          theme={theme}
          profiles={profiles}
          mintz={mintz}
          organizations={organizations}
          eventMoments={eventMoments}
          onCreateStory={stories.addStory}
          onOpenProfile={openProfile}
          onRequestOrganization={(organizationId) => {
            const organization = getOrganizationById(organizationId);
            if (organization) handleOrganizationMembership(organization);
          }}
          reducedMotion={preferenceState.preferences.content.reducedMotion}
          autoplayVideo={preferenceState.preferences.content.autoplayVideo}
          onFeedChromeChange={setMintHeaderHidden}
          onRefresh={refreshMintFeed}
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

    if (section === "sports") {
      return (
        <SportsHub
          key={configuredUniversityId ?? theme.shortName}
          theme={theme}
          universityId={configuredUniversityId}
        />
      );
    }

    if (section === "groups") {
      return (
        <GroupsSkeleton
          currentUserId={CURRENT_DEVELOPMENT_USER_ID}
          user={user}
          configuredUniversityId={configuredUniversityId}
          theme={theme}
          organizations={organizations}
          onOrganizationMembershipAction={handleOrganizationMembership}
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
            onLogout={logoutDevelopmentUser}
          />
        </div>
      );
    }

    return null;
  }

  function sectionFrame(section: SwipeSection) {
    const rememberedScrollY =
      sectionMemoryRef.current?.getScrollY(section) ?? 0;
    const refreshGeneration =
      sectionMemoryRef.current?.getRefreshGeneration(section) ?? 0;

    return (
      <div
        className={`mx-auto pb-24 pt-1 sm:pb-36 sm:pt-3 ${
          section === "mint"
            ? "max-w-[44rem] px-2.5 sm:px-5 lg:px-6"
            : "max-w-5xl px-4 sm:px-6"
        }`}
        style={{
          transform: `translate3d(0, ${viewportScrollY - rememberedScrollY}px, 0)`,
        }}
      >
        <div key={`${section}:${refreshGeneration}`}>
          {sectionContent(section)}
        </div>
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

      if (sectionCommitFrameRef.current !== null) {
        window.cancelAnimationFrame(sectionCommitFrameRef.current);
      }

      if (scrollRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollRestoreFrameRef.current);
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
          const onboardingCompletedAt =
            new Date().toISOString();

          profiles.updateCurrentAccount({
            studentEmail: resolved.email,
            personalEmail,
            primaryEmail,
            phoneNumber: profileSetup.phoneNumber,
            studentEmailDomain: resolved.domain,
            studentEmailVerifiedAt:
              resolved.mailboxVerifiedAt,
            studentEmailVerificationMethod:
              resolved.mailboxVerificationMethod,
            studentEmailVerificationChallengeId:
              resolved.verificationChallengeId,
            onboardingCompletedAt,
            universityIdentityId: resolved.identity.id,
            universityDomain: resolved.identity.domain,
            universityName: resolved.identity.name,
            universityShortName: resolved.identity.shortName,
            knownUniversityId:
              resolved.identity.knownUniversityId,
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
              resolved.identity.knownUniversityId ??
              current.universityId,
            verifiedStudent: true,
          }));

          setDeveloperUniversityOverride(null);
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
        onOpenSearch={openSearchOverlay}
        onOpenSettings={() => {
          setSearchOpen(false);
          setNotificationsOpen(false);
          setSettingsOpen(true);
        }}
        onOpenNotifications={() => {
          setSearchOpen(false);
          setSettingsOpen(false);
          setNotificationsOpen((open) => !open);
        }}
        onOpenProfile={() => {
          setSearchOpen(false);
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
              <DeveloperSoundPreview
                enabled={preferenceState.preferences.notifications.sounds}
              />
            </>
          ) : undefined
        }
      />

      {searchOpen && (
        <GlobalSearchOverlay
          theme={theme}
          historyDepth={unifiedSearchState.history.length}
          initialScrollY={searchScrollYRef.current}
          onRequestClose={dismissSearchOverlay}
          onScrollYChange={(scrollY) => {
            searchScrollYRef.current = scrollY;
          }}
        >
          <GlobalSearchSkeleton
            viewer={viewer}
            user={user}
            theme={theme}
            profiles={profiles}
            mintz={mintz}
            eventMoments={eventMoments}
            marketplace={marketplace}
            marketplacePermissionMode={marketplacePermissionMode}
            organizations={organizations}
            stories={visibleStories}
            searchState={unifiedSearchState}
            onSearchStateChange={setUnifiedSearchState}
            onOpenDirectMint={openDirectMintFromSearch}
            onLogout={logoutDevelopmentUser}
            onOrganizationMembershipAction={handleOrganizationMembership}
            autoFocus
          />
        </GlobalSearchOverlay>
      )}

      {specialSection ? (
        <div className="mx-auto max-w-5xl px-4 pb-36 pt-5 sm:px-6">
          {sectionContent(specialSection)}
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
              <div
                key={section}
                className="w-1/3 shrink-0"
                data-active-swipe-frame={section === activeSection ? "true" : "false"}
                style={{ height: section === activeSection ? "auto" : 0 }}
              >
                {sectionFrame(section)}
              </div>
            ))}
          </div>
        </div>
      )}

      <input
        ref={createMintFileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={selectCreateMintMedia}
      />

      <BottomBubbleNav
        activeSection={activeSection}
        navigationSection={currentNavigationSection}
        scrollY={viewportScrollY}
        swipeProgress={swipeProgress}
        swipeSettling={swipeSettling}
        reducedMotion={preferenceState.preferences.content.reducedMotion}
        onSelect={selectSection}
        onMintTap={handleMintTap}
        onCreateMint={beginCreateMint}
      />

      {createMintOpen && (
        <CreateContentFlow
          viewer={viewer}
          users={createMintUsers}
          theme={theme}
          onCreateMint={mintz.createMint}
          onClose={closeCreateMint}
          organizationMemberships={organizations.memberships}
          organizationRoles={organizations.roles}
          selectedMedia={createMintMedia}
          mediaError={createMintMediaError}
          mediaPreparing={createMintMediaPreparing}
          onChooseMedia={openCreateMintMediaPicker}
          onClearMedia={() => {
            setCreateMintMedia([]);
            setCreateMintMediaError(null);
          }}
          defaultCommentsEnabled={
            preferenceState.preferences.content.commentsDefault
          }
          defaultHideLikeCounts={
            preferenceState.preferences.content.hideLikeCountsDefault
          }
        />
      )}

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
