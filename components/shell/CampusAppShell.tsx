"use client";

import {
  useCallback,
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
import { BrandWorkspace } from "@/components/brands/BrandWorkspace";
import { DeveloperRoleSwitcher } from "@/components/developer/DeveloperRoleSwitcher";
import { DeveloperSoundPreview } from "@/components/developer/DeveloperSoundPreview";
import { CampusPreviewContext } from "@/components/developer/CampusPreviewContext";
import { GroupsSkeleton } from "@/components/groups/GroupsSkeleton";
import { MessagesSkeleton } from "@/components/messages/MessagesSkeleton";
import { NotificationsPanel } from "@/components/notifications/NotificationsPanel";
import { CampusMintFeed } from "@/components/mintz/CampusMintFeed";
import { AccountOnboarding } from "@/components/onboarding/AccountOnboarding";
import { CreatorEmailOnboarding } from "@/components/onboarding/CreatorEmailOnboarding";
import { CreatorWorkspace } from "@/components/creator/CreatorWorkspace";
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
import { getAppearanceCssVariables, getAppearanceTokens } from "@/data/appearance";
import { getOrganizationById } from "@/data/organizations";
import { type UserRole } from "@/data/userRoles";
import {
  type UniversityId,
  getAccountConfiguredUniversityId,
  getAccountUniversityDisplayTheme,
} from "@/data/universities";
import { useAppPreferences } from "@/hooks/useAppPreferences";
import { useSystemColorScheme } from "@/hooks/useSystemColorScheme";
import { useCampusNotifications } from "@/hooks/useCampusNotifications";
import { useCampusEvents } from "@/hooks/useCampusEvents";
import { useDirectMint } from "@/hooks/useDirectMint";
import { useEventMoments } from "@/hooks/useEventMoments";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useMintz } from "@/hooks/useMintz";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useProfiles } from "@/hooks/useProfiles";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useStories } from "@/hooks/useStories";
import { canJoinOrganization } from "@/lib/organizationPermissions";
import { clearPrivateSessionCache } from "@/lib/auth/privateSessionCache";
import {
  prepareLocalMintMedia,
  type LocalMintMediaSelection,
} from "@/lib/content/localMintMedia";
import { SectionMemory } from "@/lib/navigation/sectionMemory";
import {
  mainSectionUrl,
  parseCampusAppLocation,
  profileUrl,
  searchUrl,
  type CampusAppLocation,
} from "@/lib/navigation/appLocation";
import { resolveNotificationDeepLink } from "@/lib/notifications/campusNotifications";
import { rankPrivateMessageSuggestions } from "@/lib/social/privateMessages";
import { areDeveloperControlsEnabled, areDevelopmentFixturesEnabled } from "@/lib/runtime/fixturePolicy";
import { resolveCampusPreview, type CampusPreviewSelection } from "@/lib/runtime/campusPreview";
import {
  initialNotchScrollState,
  expandNotchPresentation,
  clampNavigationIndex,
  motion,
  resistFiniteNavigationEdge,
  resolveFiniteNavigationDestination,
  resolveGestureAxis,
  updateNotchScrollState,
  type FloatingSurfaceOrigin,
} from "@/lib/motion/interaction";
import {
  initialUnifiedSearchState,
  migrateUnifiedSearchCategory,
  requestUnifiedSearchDismiss,
  type UnifiedSearchState,
} from "@/lib/search/unifiedSearch";
import { getVisibleStories } from "@/lib/storyPermissions";
import type { Organization } from "@/types/organization";
import type { CampusNotification } from "@/types/notification";
import type { TemporaryUser } from "@/types/user";
import type { AccountSessionResponse, BrandSessionProfile, CreatorSessionProfile } from "@/types/accountSession";

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
const HORIZONTAL_SNAP_MS = motion.duration.settle;
const MINT_HOME_SWEEP_MS = motion.duration.settle;
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

const showDeveloperControls = areDeveloperControlsEnabled();
const marketplacePermissionMode =
  areDevelopmentFixturesEnabled()
    ? "development_role"
    : "verified_student";

type CampusAppShellProps = {
  initialLocation: CampusAppLocation;
};

export function CampusAppShell({ initialLocation }: CampusAppShellProps) {
  const initialSection = initialLocation.kind === "section"
    ? initialLocation.section
    : initialLocation.returnSection;
  const initialSectionIndex = sectionSequence.indexOf(initialSection);
  const [navIndex, setNavIndex] = useState(
    initialSectionIndex >= 0
      ? initialSectionIndex
      : INITIAL_MINT_INDEX >= 0
        ? INITIAL_MINT_INDEX
        : 0,
  );
  const [specialSection, setSpecialSection] =
    useState<"profile" | null>(initialLocation.kind === "profile" ? "profile" : null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [swipeSettling, setSwipeSettling] = useState(false);
  const [mintSweepProgress, setMintSweepProgress] =
    useState<-1 | 1 | null>(null);
  const [selectedProfileUserId, setSelectedProfileUserId] =
    useState(
      initialLocation.kind === "profile"
        ? initialLocation.profileUserId
        : CURRENT_DEVELOPMENT_USER_ID,
    );
  const [directMintReturnUserId, setDirectMintReturnUserId] =
    useState<string | null>(null);
  const [requestedMessageUserId, setRequestedMessageUserId] =
    useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creatorApplicationOpen, setCreatorApplicationOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationOrigin, setNotificationOrigin] =
    useState<FloatingSurfaceOrigin | null>(null);
  const [notificationReturnScene, setNotificationReturnScene] = useState<
    "profile" | "messages" | "groups" | "sports" | "search" | null
  >(null);
  const [requestedGroupOrganizationId, setRequestedGroupOrganizationId] =
    useState<string | null>(null);
  const [requestedSportsSport, setRequestedSportsSport] = useState<
    "football" | "basketball" | "baseball" | null
  >(null);
  const [searchOpen, setSearchOpen] = useState(initialLocation.kind === "search");
  const [createMintOpen, setCreateMintOpen] = useState(false);
  const [createMintMedia, setCreateMintMedia] =
    useState<LocalMintMediaSelection[]>([]);
  const [createMintMediaError, setCreateMintMediaError] =
    useState<string | null>(null);
  const [createMintMediaPreparing, setCreateMintMediaPreparing] =
    useState(false);
  const [mintHeaderHidden, setMintHeaderHidden] = useState(false);
  const [user, setUser] = useState<TemporaryUser>(initialUser);
  const [campusPreviewSelection, setCampusPreviewSelection] = useState<CampusPreviewSelection>(null);
  const [developerControlsOpen, setDeveloperControlsOpen] = useState(false);
  const [campusPreviewNotice, setCampusPreviewNotice] = useState<string | null>(null);
  const [unifiedSearchState, setUnifiedSearchState] =
    useState<UnifiedSearchState>(() => initialLocation.kind === "search"
      ? initialLocation.searchState
      : { ...initialUnifiedSearchState });
  const [onboardingOpen, setOnboardingOpen] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<"checking" | "signed_out" | "student" | "brand" | "creator">("checking");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionRefreshing, setSessionRefreshing] = useState(false);
  const sessionRequestRef = useRef(0);
  const [brandProfile, setBrandProfile] = useState<BrandSessionProfile | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<CreatorSessionProfile | null>(null);
  const [canUseCampusTester, setCanUseCampusTester] = useState(false);

  const swipeProgressRef = useRef(0);
  const settleTimerRef = useRef<number | null>(null);
  const pageDragRef = useRef<PageDragState | null>(null);
  const searchTouchRef = useRef<SearchTouchState>(null);
  const searchScrollYRef = useRef(0);
  const searchNavigationInFlightRef = useRef(false);
  const profileHydrationAppliedRef = useRef(false);
  const mintReturnTimerRef = useRef<number | null>(null);
  const sectionCommitFrameRef = useRef<number | null>(null);
  const scrollRestoreFrameRef = useRef<number | null>(null);
  const createMintFileInputRef = useRef<HTMLInputElement>(null);
  const createMintMediaRequestRef = useRef(0);
  const profileReturnSectionRef = useRef<SwipeSection>(
    initialLocation.kind === "profile"
      ? initialLocation.returnSection
      : initialSection,
  );
  const searchReturnSectionRef = useRef<SwipeSection>(
    initialLocation.kind === "search"
      ? initialLocation.returnSection
      : initialSection,
  );
  const profileReturnScrollRef = useRef(0);
  const specialScrollPositionsRef = useRef(new Map<string, number>());
  const scrollOwnerSectionRef = useRef<SwipeSection | null>(null);
  const notchScrollStateRef = useRef(initialNotchScrollState);
  const [specialPageLeaving, setSpecialPageLeaving] =
    useState(false);
  const [notchPresentation, setNotchPresentation] = useState(initialNotchScrollState.presentation);

  const profiles = useProfiles();
  const currentUserId = profiles.currentUser.account.id;
  const developerUniversityOverride = resolveCampusPreview(campusPreviewSelection, currentUserId, getAccountConfiguredUniversityId(profiles.currentUser.account), showDeveloperControls || canUseCampusTester);
  const campusPreviewActive = developerUniversityOverride !== null;
  const currentProfileOnboardingCompletedAt =
    profiles.currentUser.account.onboardingCompletedAt;
  const clearAuthenticatedProfile = profiles.clearAuthenticatedUser;
  const hydrateAuthenticatedProfile = profiles.hydrateAuthenticatedUser;
  const marketplace = useMarketplace();
  const mintz = useMintz(currentUserId, developerUniversityOverride);
  const directMint = useDirectMint(currentUserId);
  const eventMoments = useEventMoments();
  const campusEventState = useCampusEvents(developerUniversityOverride, currentUserId);
  const organizations = useOrganizations(currentUserId);
  const campusNotifications = useCampusNotifications(
    currentUserId,
    profiles.blocks,
  );
  const stories = useStories();
  const preferenceState = useAppPreferences();
  const reducedMotion = useReducedMotion(
    preferenceState.preferences.content.reducedMotion,
  );

  const refreshAccountSession = useCallback(async () => {
    const requestId = ++sessionRequestRef.current;
    setSessionRefreshing(true);
    try {
      const response = await fetch("/api/account/me", { cache: "no-store" });
      const result = await response.json() as AccountSessionResponse;
      if (requestId !== sessionRequestRef.current) return false;
      if (!response.ok) throw new Error(result.ok ? "We couldn't load your saved account." : result.message);
      if (!result.ok) throw new Error(result.message);
      setSessionError(null);
      if (!result.configured && areDevelopmentFixturesEnabled()) {
        setSessionStatus("student");
        setOnboardingOpen(!currentProfileOnboardingCompletedAt);
        return true;
      }
      if (!result.authenticated) {
        clearAuthenticatedProfile();
        setBrandProfile(null);
        setCreatorProfile(null);
        setCanUseCampusTester(false);
        setCampusPreviewSelection(null);
        setDeveloperControlsOpen(false);
        setSessionStatus("signed_out");
        setOnboardingOpen(true);
        return true;
      }
      setCanUseCampusTester(Boolean(result.canUseCampusTester));
      const sessionUserId = result.accountType === "student" ? result.user?.account.id : null;
      setCampusPreviewSelection((current) => current && result.canUseCampusTester && current.accountId === sessionUserId ? current : null);
      if (result.accountType === "brand") {
        setBrandProfile(result.brand);
        setSessionStatus("brand");
        setOnboardingOpen(!result.onboardingComplete);
        return true;
      }
      if (result.accountType === "creator") {
        setCreatorProfile(result.creator);
        setBrandProfile(null);
        setSessionStatus("creator");
        setOnboardingOpen(!result.onboardingComplete);
        return true;
      }
      setCreatorProfile(result.creator);
      setSessionStatus("student");
      setOnboardingOpen(!result.onboardingComplete);
      if (result.user) {
        hydrateAuthenticatedProfile(result.user);
        setSelectedProfileUserId(result.user.account.id);
        setUser((current) => ({ ...current, id: result.user!.account.id, firstName: result.user!.profile.firstName, universityId: result.user!.account.universityId, role: result.user!.account.role, verifiedStudent: result.user!.account.verifiedStudent }));
      }
      return true;
    } catch (error) {
      if (requestId !== sessionRequestRef.current) return false;
      // Preserve the current account on a transient failure. A failed lookup must
      // never send an existing user back into new-account setup.
      setSessionError(error instanceof Error ? error.message : "We couldn't load your saved account. Please try again.");
      return false;
    } finally {
      if (requestId === sessionRequestRef.current) setSessionRefreshing(false);
    }
  }, [clearAuthenticatedProfile, currentProfileOnboardingCompletedAt, hydrateAuthenticatedProfile]);

  useEffect(() => {
    if (!profiles.developmentProfileHydrated) return;
    const timer = window.setTimeout(() => { void refreshAccountSession(); }, 0);
    return () => window.clearTimeout(timer);
  }, [profiles.developmentProfileHydrated, refreshAccountSession]);

  useEffect(() => {
    const reconnect = () => { void refreshAccountSession(); };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [refreshAccountSession]);

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
      setCampusPreviewSelection(null);
    }
  }, [
    profiles.currentUser,
    profiles.developmentProfileHydrated,
  ]);

  const currentNavigationSection =
    sectionSequence[clampNavigationIndex(navIndex, SECTION_COUNT)] ?? "mint";

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
        const next = updateNotchScrollState(
          notchScrollStateRef.current,
          window.scrollY,
        );
        notchScrollStateRef.current = next;
        setNotchPresentation((current) =>
          current === next.presentation ? current : next.presentation,
        );
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
    const applyLocation = () => {
      searchNavigationInFlightRef.current = false;
      const location = parseCampusAppLocation(
        new URLSearchParams(window.location.search),
      );
      const section = location.kind === "section"
        ? location.section
        : location.returnSection;
      const sectionIndex = sectionSequence.indexOf(section);
      clearSettleTimer();
      cancelScheduledMainSectionCommit();
      setGestureProgress(0);
      setSwipeSettling(false);
      setSettingsOpen(false);
      setNotificationsOpen(false);
      if (location.kind === "profile") {
        setSearchOpen(false);
        profileReturnSectionRef.current = location.returnSection;
        setSelectedProfileUserId(location.profileUserId);
        setSpecialSection("profile");
        restoreSpecialPageScroll(
          specialPageKey("profile", location.profileUserId),
        );
        return;
      }
      if (location.kind === "search") {
        setSpecialSection(null);
        searchReturnSectionRef.current = location.returnSection;
        setUnifiedSearchState(location.searchState);
        setSearchOpen(true);
        if (sectionIndex >= 0) setNavIndex(sectionIndex);
        committedSectionRef.current = section;
        scrollOwnerSectionRef.current = section;
        return;
      }
      setSearchOpen(false);
      setSpecialSection(null);
      if (sectionIndex >= 0) setNavIndex(sectionIndex);
      committedSectionRef.current = section;
      scrollOwnerSectionRef.current = section;
      window.localStorage.setItem(ACTIVE_SECTION_STORAGE_KEY, section);
      restoreWindowScroll(sectionMemoryRef.current?.getScrollY(section) ?? 0);
    };
    window.addEventListener("popstate", applyLocation);
    return () => window.removeEventListener("popstate", applyLocation);
    // Route listener reads current refs; it must not churn during gestures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          verifiedStudent: campusPreviewActive ? false : user.verifiedStudent ?? false,
        },
      };
    },
    [
      developerUniversityOverride,
      profiles.currentUser,
      user.role,
      user.verifiedStudent,
      campusPreviewActive,
    ],
  );

  const campusUser = developerUniversityOverride ? { ...user, universityId: developerUniversityOverride, verifiedStudent: false } : user;
  const visibleEventMoments = campusPreviewActive ? {
    ...eventMoments,
    rsvps: [], moments: [], prompts: [], attendanceEvidence: [],
    isAttending: () => false,
    getPrompt: () => null,
    getEligibility: () => ({ eligible: false, basis: null, qualifyingEvidence: [] }),
    toggleRsvp: () => undefined,
    simulateQualifyingLocationAttendance: () => false,
    dismissPrompt: () => undefined,
    captureMoment: () => null,
    keepMoment: () => undefined,
  } : eventMoments;

  const campusTheme = getAccountUniversityDisplayTheme(viewer.account);

  const configuredUniversityId =
    getAccountConfiguredUniversityId(viewer.account);

  const systemColorScheme = useSystemColorScheme();
  const appearanceTokens = useMemo(
    () =>
      getAppearanceTokens(
        preferenceState.preferences.appearance,
        campusTheme,
        systemColorScheme,
      ),
    [preferenceState.preferences.appearance, campusTheme, systemColorScheme],
  );

  // Legacy feature controls consume this palette; university identity stays in campusTheme.
  const theme = {
    ...campusTheme,
    primary: appearanceTokens.accent,
    secondary: appearanceTokens.accentContrast,
    accent: appearanceTokens.accentSoft,
  };

  useEffect(() => {
    const root = document.documentElement;
    const variables = getAppearanceCssVariables(appearanceTokens);
    const previous = Object.fromEntries(
      Object.keys(variables).map((name) => [name, root.style.getPropertyValue(name)]),
    );
    const previousScheme = root.style.colorScheme;
    for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
    root.style.colorScheme = appearanceTokens.colorScheme;
    return () => {
      for (const [name, value] of Object.entries(previous)) {
        if (value) root.style.setProperty(name, value);
        else root.style.removeProperty(name);
      }
      root.style.colorScheme = previousScheme;
    };
  }, [appearanceTokens]);

  const createMintUsers = useMemo(
    () => {
      const candidates = profiles.users.map((candidate) =>
        candidate.account.id === viewer.account.id ? viewer : candidate,
      );
      const blockedUserIds = profiles.blocks.flatMap((block) =>
        block.blockerId === viewer.account.id
          ? [block.blockedId]
          : block.blockedId === viewer.account.id
            ? [block.blockerId]
            : [],
      );

      return rankPrivateMessageSuggestions({
        viewer,
        candidates,
        friendships: profiles.friendships,
        follows: profiles.follows,
        blockedUserIds,
        existingConversationUserIds: [],
      }).map(({ user: candidate }) => candidate);
    }, [
      profiles.blocks,
      profiles.follows,
      profiles.friendships,
      profiles.users,
      viewer,
    ],
  );

  const visibleStories = getVisibleStories(
    stories.stories,
    theme.accessibleCampuses,
    user.role,
    stories.currentTime,
    {
      id: user.id,
      universityId: campusUser.universityId,
    },
    organizations.memberships,
  );

  const previousSection: SwipeSection | null =
    mintSweepProgress === 1
      ? "mint"
      : sectionSequence[navIndex - 1] ?? null;

  const nextSection: SwipeSection | null =
    mintSweepProgress === -1
      ? "mint"
      : sectionSequence[navIndex + 1] ?? null;

  const swipeSections: Array<SwipeSection | null> = [
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
    const targetUrl = mainSectionUrl(section);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== targetUrl) {
      window.history.pushState({ campusMintView: "section", section }, "", targetUrl);
    }

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

  function changeUniversity(universityId: UniversityId | null) {
    if (!showDeveloperControls && !canUseCampusTester) return;
    setCampusPreviewSelection(universityId ? { accountId: currentUserId, universityId } : null);
    setCampusPreviewNotice(null);
    closeCreateMint();
    setSearchOpen(false);
    setSettingsOpen(false);
    setNotificationsOpen(false);
    setSpecialSection(null);
    setRequestedMessageUserId(null);
    setRequestedGroupOrganizationId(null);
    setRequestedSportsSport(null);
    setNotificationReturnScene(null);
    setDirectMintReturnUserId(null);
    setUnifiedSearchState({ ...initialUnifiedSearchState });
    setMintHeaderHidden(false);
    clearSettleTimer();
    clearMintReturnTimer();
    cancelScheduledMainSectionCommit();
    setMintSweepProgress(null);
    setGestureProgress(0);
    setSwipeSettling(false);
    specialScrollPositionsRef.current.clear();
    sectionMemoryRef.current = new SectionMemory(currentNavigationSection, 2);
    window.history.replaceState({ campusMintView: "section", section: currentNavigationSection }, "", mainSectionUrl(currentNavigationSection));
    restoreWindowScroll(0);
  }

  function changeRole(role: UserRole) {
    setUser((current) => ({ ...current, role }));
    setUnifiedSearchState((current) => ({ ...current, history: [] }));
  }

  function selectSection(section: PrimarySection) {
    clearSettleTimer();
    setSwipeSettling(false);
    setGestureProgress(0);

    if (
      notificationReturnScene &&
      notificationReturnScene !== section
    ) {
      setNotificationReturnScene(null);
      setRequestedMessageUserId(null);
      setRequestedGroupOrganizationId(null);
      setRequestedSportsSport(null);
    }

    if (section === "messages") {
      setDirectMintReturnUserId(null);
    }

    if (section === "profile") {
      cancelScheduledMainSectionCommit();
      openProfile(viewer.account.id);
      return;
    }

    const targetIndex = sectionSequence.indexOf(section);
    if (targetIndex < 0) return;

    captureCurrentMainScroll();
    captureSpecialPageScroll();
    setSpecialSection(null);
    setNavIndex(targetIndex);
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
    window.history.pushState(
      { campusMintView: "profile", profileUserId: userId, returnSection: profileReturnSectionRef.current, hasReturnEntry: true },
      "",
      profileUrl(userId, profileReturnSectionRef.current),
    );
    restoreSpecialPageScroll(specialPageKey("profile", userId));
  }

  function leaveProfileTo(section: SwipeSection) {
    captureSpecialPageScroll();

    const finish = () => {
      const targetIndex =
        sectionSequence.indexOf(section);

      if (targetIndex >= 0) {
        setNavIndex(targetIndex);
      }

      setSpecialSection(null);
      setSpecialPageLeaving(false);
      setGestureProgress(0);
      window.history.replaceState({ campusMintView: "section", section }, "", mainSectionUrl(section));
      scheduleMainSectionCommit(
        section,
        section === profileReturnSectionRef.current
          ? profileReturnScrollRef.current
          : undefined,
      );
    };

    if (
      reducedMotion
    ) {
      finish();
      return;
    }

    setSpecialPageLeaving(true);

    window.setTimeout(finish, motion.duration.fast);
  }

  function goBackFromProfile() {
    if (notificationReturnScene === "profile") {
      captureSpecialPageScroll();
      setSpecialSection(null);
      setSpecialPageLeaving(false);
      setNotificationReturnScene(null);
      setNotificationsOpen(true);
      scheduleMainSectionCommit(committedSectionRef.current);
      return;
    }
    if (window.history.state?.campusMintView === "profile" && window.history.state?.hasReturnEntry) {
      window.history.back();
      return;
    }
    leaveProfileTo(
      profileReturnSectionRef.current,
    );
  }


  function openDirectMintFromProfile(
    userId: string,
  ) {
    captureSpecialPageScroll();
    setRequestedMessageUserId(userId);
    setDirectMintReturnUserId(userId);

    const targetIndex =
      sectionSequence.indexOf("messages");

    const finish = () => {
      if (targetIndex >= 0) {
        setNavIndex(targetIndex);
      }

      setSpecialSection(null);
      setSpecialPageLeaving(false);
      setGestureProgress(0);
      scrollOwnerSectionRef.current = null;
      restoreWindowScroll(0);
    };

    if (reducedMotion) {
      finish();
      return;
    }

    setSpecialPageLeaving(true);
    window.setTimeout(finish, motion.duration.fast);
  }

  function openDirectMintFromSearch(userId: string) {
    setRequestedMessageUserId(userId);
    setDirectMintReturnUserId(null);
    setSearchOpen(false);
    selectSection("messages");
  }

  function returnToNotifications() {
    setRequestedMessageUserId(null);
    setRequestedGroupOrganizationId(null);
    setRequestedSportsSport(null);
    setNotificationReturnScene(null);
    setNotificationsOpen(true);
  }

  function openNotification(notification: CampusNotification) {
    campusNotifications.markRead(notification.id);
    setNotificationsOpen(false);
    const destination = resolveNotificationDeepLink(notification);

    if (destination.scene === "profile") {
      setNotificationReturnScene("profile");
      openProfile(destination.userId);
      return;
    }

    if (destination.scene === "message") {
      setRequestedMessageUserId(destination.userId);
      setDirectMintReturnUserId(null);
      setNotificationReturnScene("messages");
      selectSection("messages");
      return;
    }

    if (destination.scene === "organization") {
      setRequestedGroupOrganizationId(destination.organizationId);
      setNotificationReturnScene("groups");
      selectSection("groups");
      return;
    }

    if (destination.scene === "sports") {
      setRequestedSportsSport(destination.sport);
      setNotificationReturnScene("sports");
      selectSection("sports");
      return;
    }

    const eventSearchState: UnifiedSearchState = {
      ...initialUnifiedSearchState,
      category: "events",
      history: [{ kind: "event", id: destination.eventId }],
    };
    setNotificationReturnScene("search");
    openSearchOverlayWithState(eventSearchState);
  }

  function updateSearchState(next: UnifiedSearchState) {
    const previousDepth = unifiedSearchState.history.length;
    if (
      searchOpen &&
      next.history.length < previousDepth &&
      window.history.state?.campusMintView === "search" &&
      window.history.state?.hasPreviousSearchEntry
    ) {
      searchNavigationInFlightRef.current = true;
      window.history.go(next.history.length - previousDepth);
      return;
    }

    setUnifiedSearchState(next);
    if (!searchOpen) return;

    const targetUrl = searchUrl(next, searchReturnSectionRef.current);
    if (next.history.length > previousDepth) {
      window.history.pushState(
        {
          campusMintView: "search",
          searchDepth: next.history.length,
          hasPreviousSearchEntry: true,
        },
        "",
        targetUrl,
      );
      return;
    }

    window.history.replaceState(
      {
        ...window.history.state,
        campusMintView: "search",
        searchDepth: next.history.length,
      },
      "",
      targetUrl,
    );
  }

  function openSearchOverlayWithState(nextState: UnifiedSearchState) {
    setSettingsOpen(false);
    setNotificationsOpen(false);
    searchReturnSectionRef.current = committedSectionRef.current;
    setUnifiedSearchState(nextState);
    setSearchOpen(true);
    window.history.pushState(
      {
        campusMintView: "search",
        searchDepth: nextState.history.length,
        hasReturnEntry: true,
      },
      "",
      searchUrl(nextState, searchReturnSectionRef.current),
    );
  }

  function openSearchOverlay() {
    openSearchOverlayWithState(unifiedSearchState);
  }

  function backSearchOverlay() {
    if (searchNavigationInFlightRef.current) return;
    if (
      window.history.state?.campusMintView === "search" &&
      window.history.state?.hasPreviousSearchEntry
    ) {
      searchNavigationInFlightRef.current = true;
      window.history.back();
      return;
    }

    const next = requestUnifiedSearchDismiss(unifiedSearchState).state;
    updateSearchState(next);
  }

  function closeSearchOverlay() {
    if (searchNavigationInFlightRef.current) return;
    if (
      window.history.state?.campusMintView === "search" &&
      window.history.state?.hasReturnEntry
    ) {
      searchNavigationInFlightRef.current = true;
      window.history.back();
    } else {
      setSearchOpen(false);
      window.history.replaceState(
        {
          campusMintView: "section",
          section: searchReturnSectionRef.current,
        },
        "",
        mainSectionUrl(searchReturnSectionRef.current),
      );
    }
    if (notificationReturnScene === "search") {
      setNotificationReturnScene(null);
      setNotificationsOpen(true);
    }
  }

  function openCreateMintMediaPicker() {
    const input = createMintFileInputRef.current;
    if (!input) return;

    input.value = "";
    input.click();
  }

  function beginCreateMint() {
    if (campusPreviewActive) {
      setCampusPreviewNotice("Exit campus preview to post from your own account.");
      return;
    }
    createMintMediaRequestRef.current += 1;
    setCreateMintMedia([]);
    setCreateMintMediaError(null);
    setCreateMintMediaPreparing(false);
    setCreateMintOpen(true);
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

    const prepared = await prepareLocalMintMedia(files, preferenceState.preferences.content.highQualityUploads);
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

  async function logoutDevelopmentUser() {
    sessionRequestRef.current += 1;
    setCampusPreviewSelection(null);
    setDeveloperControlsOpen(false);
    setCampusPreviewNotice(null);
    setSessionError(null);
    setSessionRefreshing(false);
    await fetch("/api/account/logout", { method: "POST" }).catch(() => null);
    clearPrivateSessionCache(window.localStorage, currentUserId);
    profiles.logoutDevelopmentUser();
    profiles.clearAuthenticatedUser();
    closeCreateMint();
    setSearchOpen(false);
    setSpecialSection(null);
    setSelectedProfileUserId(profiles.currentUser.account.id);
    setUnifiedSearchState({ ...initialUnifiedSearchState });
    setUser(initialUser);
    setCampusPreviewSelection(null);
    setDeveloperControlsOpen(false);
    setCampusPreviewNotice(null);
    setOnboardingOpen(true);
    setBrandProfile(null);
    setCreatorProfile(null);
    setCanUseCampusTester(false);
    setSessionStatus("signed_out");
    window.history.replaceState({ campusMintView: "section", section: "mint" }, "", "/");
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
            reducedMotion
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

    const destination = mintIndex;

    if (
      reducedMotion ||
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
        reducedMotion
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
    if (campusPreviewActive) return;
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

    const rawProgress = swipeProgressRef.current + deltaSections;
    const resistedProgress = resistFiniteNavigationEdge(
      rawProgress,
      navIndex,
      SECTION_COUNT,
    );

    setGestureProgress(Math.min(1, Math.max(-1, resistedProgress)));
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

    const destinationIndex = resolveFiniteNavigationDestination(
      navIndex,
      target as -1 | 0 | 1,
      SECTION_COUNT,
    );
    if (destinationIndex === navIndex) target = 0;
    const destinationSection =
      sectionSequence[destinationIndex] ?? currentNavigationSection;

    if (reducedMotion) {
      setNavIndex(destinationIndex);

      setGestureProgress(0);
      scheduleMainSectionCommit(destinationSection);
      return;
    }

    setSwipeSettling(true);
    setGestureProgress(target);

    settleTimerRef.current = window.setTimeout(() => {
      setNavIndex(destinationIndex);

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
    setViewportScrollY(window.scrollY);

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
      const axis = resolveGestureAxis(totalX, totalY);

      if (axis === "horizontal") {
        drag.axis = "horizontal";
        drag.lastX = event.clientX;
        drag.lastTime = event.timeStamp;

        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }

        return;
      }

      if (axis === "vertical") {
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

  function refreshMintFeed() {
    mintz.refreshMintz();
    scrollMintHomeToTop();
  }

  function sectionContent(section: PrimarySection): ReactNode {
    if (campusPreviewActive && (section === "messages" || section === "profile")) {
      return <section className="mx-auto max-w-lg py-16 text-center"><h1 className="text-xl font-bold text-[var(--app-text-primary)]">{section === "messages" ? "Messages stay with your account" : "Your profile stays with your campus"}</h1><p className="mt-3 text-sm text-[var(--app-text-secondary)]">Campus preview shows public content. Return to your campus to use your personal account.</p><button type="button" onClick={() => changeUniversity(null)} className="mt-5 rounded-full bg-[var(--app-accent)] px-5 py-2.5 text-sm font-bold text-[var(--app-accent-contrast)]">Use my campus</button></section>;
    }
    if (section === "mint") {
      return (
        <CampusMintFeed
          viewer={viewer}
          theme={theme}
          profiles={profiles}
          mintz={mintz}
          organizations={organizations}
          eventMoments={visibleEventMoments}
          events={campusEventState.events}
          directMint={directMint}
          onCreateStory={stories.addStory}
          onOpenProfile={openProfile}
          onMessageUser={openDirectMintFromSearch}
          onRequestOrganization={(organizationId) => {
            const organization = getOrganizationById(organizationId);
            if (organization) handleOrganizationMembership(organization);
          }}
          reducedMotion={reducedMotion}
          autoplayVideo={preferenceState.preferences.content.autoplayVideo}
          onFeedChromeChange={setMintHeaderHidden}
          onRefresh={refreshMintFeed}
          surfaceActive={!specialSection}
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
            requestedMessageUserId
          }
          onThreadChange={setRequestedMessageUserId}
          onOpenProfile={openProfile}
          onBackToNotifications={
            notificationReturnScene === "messages"
              ? returnToNotifications
              : undefined
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
          initialSport={requestedSportsSport}
          onBack={
            notificationReturnScene === "sports"
              ? returnToNotifications
              : undefined
          }
        />
      );
    }

    if (section === "groups") {
      return (
        <GroupsSkeleton
          currentUserId={viewer.account.id}
          user={campusUser}
          configuredUniversityId={configuredUniversityId}
          theme={theme}
          organizations={organizations}
          onOrganizationMembershipAction={handleOrganizationMembership}
          requestedOrganizationId={requestedGroupOrganizationId}
          onRequestedOrganizationHandled={() =>
            setRequestedGroupOrganizationId(null)
          }
          onBackToNotifications={
            notificationReturnScene === "groups"
              ? returnToNotifications
              : undefined
          }
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
          transform:
            section === currentNavigationSection
              ? "none"
              : `translate3d(0, ${viewportScrollY - rememberedScrollY}px, 0)`,
        }}
      >
        <div key={`${currentUserId}:${developerUniversityOverride ?? "home"}:${section}:${refreshGeneration}`}>
          {sectionContent(section)}
        </div>
      </div>
    );
  }

  const shellStyle = {
    "--campus-primary": campusTheme.primary,
    "--campus-secondary": campusTheme.secondary,
    "--campus-accent": campusTheme.accent,
    ...getAppearanceCssVariables(appearanceTokens),
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

  if (sessionError) {
    return <main className="campus-app-shell flex min-h-dvh items-center justify-center bg-[var(--app-background)] p-6 text-[var(--app-text-primary)]" style={shellStyle}><section className="max-w-md rounded-3xl bg-[var(--app-surface)] p-6"><h1 className="text-xl font-black">Your account couldn&apos;t load</h1><p role="alert" className="mt-3 text-sm text-[var(--app-text-secondary)]">{sessionError}</p><p className="mt-2 text-sm text-[var(--app-text-secondary)]">Retry to restore your session and continue.</p><button type="button" disabled={sessionRefreshing} onClick={() => { void refreshAccountSession(); }} className="mt-5 rounded-full bg-[var(--app-accent)] px-5 py-2.5 text-sm font-bold text-[var(--app-accent-contrast)] disabled:opacity-60">{sessionRefreshing ? "Retrying…" : "Retry"}</button></section></main>;
  }

  if (sessionStatus === "checking") {
    return <main className="min-h-dvh bg-[var(--app-background)]" style={shellStyle} aria-label="Loading account" />;
  }

  if (sessionStatus === "brand" && brandProfile && !onboardingOpen) {
    return <div className="campus-app-shell" style={shellStyle} data-appearance={preferenceState.preferences.appearance.scheme}><BrandWorkspace brand={brandProfile} onLogout={() => { void logoutDevelopmentUser(); }} /></div>;
  }

  if (sessionStatus === "creator" && creatorProfile && !onboardingOpen) {
    return <div className="campus-app-shell" style={shellStyle} data-appearance={preferenceState.preferences.appearance.scheme}><CreatorWorkspace creator={creatorProfile} onLogout={() => { void logoutDevelopmentUser(); }} /></div>;
  }

  if (sessionStatus === "student" && creatorApplicationOpen) {
    return <CreatorEmailOnboarding emailAlreadyVerified onBack={() => setCreatorApplicationOpen(false)} onComplete={() => { setCreatorApplicationOpen(false); void refreshAccountSession(); }} />;
  }

  if (onboardingOpen) {
    return (
      <div className="campus-app-shell" style={shellStyle} data-appearance={preferenceState.preferences.appearance.scheme}><AccountOnboarding
        initialAccountType={sessionStatus === "brand" ? "brand" : sessionStatus === "creator" ? "creator" : sessionStatus === "student" ? "student" : null}
        brandSessionVerified={sessionStatus === "brand"}
        creatorSessionVerified={sessionStatus === "creator"}
        onBrandComplete={() => { void refreshAccountSession(); }}
        onCreatorComplete={() => { void refreshAccountSession(); }}
        onSignInComplete={() => { void refreshAccountSession(); }}
        onStudentVerified={async (
          _resolved,
          _personalEmail,
          _primaryEmail,
          profileSetup,
        ) => {
          const accountResponse = await fetch("/api/account/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountType: "student", ...profileSetup }),
          });
          const accountResult = await accountResponse.json().catch(() => null) as { ok?: boolean; message?: string } | null;
          if (!accountResponse.ok || !accountResult?.ok) {
            return { ok: false, message: accountResult?.message ?? "We couldn't save your account." };
          }
          setCampusPreviewSelection(null);
          // Rehydrate the saved server identity rather than editing the anonymous
          // placeholder (or a previous account) and pretending setup is durable.
          return await refreshAccountSession()
            ? { ok: true }
            : { ok: false, message: "Your account was saved, but we couldn't reload it yet. Please retry." };
        }}
      /></div>
    );
  }


  return (
    <CampusPreviewContext value={campusPreviewActive}>
    <main
      className="campus-app-shell min-h-dvh overflow-x-hidden text-slate-950"
      style={shellStyle}
      data-appearance={preferenceState.preferences.appearance.scheme}
      data-reduced-motion={
        reducedMotion ? "true" : "false"
      }
      onTouchStart={beginSearchTouch}
      onTouchEnd={finishSearchTouch}
      onTouchCancel={() => {
        searchTouchRef.current = null;
      }}
    >
      <TopUtilityBar
        hidden={!campusPreviewActive && !developerControlsOpen && activeSection === "mint" && mintHeaderHidden}
        compact={notchPresentation !== "expanded"}
        viewer={viewer}
        theme={theme}
        onOpenSearch={openSearchOverlay}
        onOpenSettings={() => {
          setSearchOpen(false);
          setNotificationsOpen(false);
          setSettingsOpen(true);
        }}
        onOpenNotifications={(origin) => {
          if (campusPreviewActive) { setCampusPreviewNotice("Exit campus preview to view your notifications."); return; }
          setSearchOpen(false);
          setSettingsOpen(false);
          setNotificationOrigin(origin);
          setNotificationsOpen((open) => !open);
        }}
        onOpenProfile={() => {
          setSearchOpen(false);
          setNotificationsOpen(false);
          openProfile(viewer.account.id);
        }}
        unreadNotificationCount={campusPreviewActive ? 0 : campusNotifications.unreadCount}
        developerControlsOpen={developerControlsOpen}
        onToggleDeveloperControls={() => setDeveloperControlsOpen((open) => !open)}
        campusPreviewLabel={campusPreviewActive ? campusTheme.shortName : undefined}
        onExitCampusPreview={() => changeUniversity(null)}
        developerControls={
          showDeveloperControls || canUseCampusTester ? (
            <>
              <DeveloperUniversitySwitcher
                selectedUniversityId={developerUniversityOverride}
                onUniversityChange={changeUniversity}
                label="Preview campus"
              />
              {showDeveloperControls && <DeveloperRoleSwitcher
                selectedRole={user.role}
                onRoleChange={changeRole}
                primaryColor={theme.primary}
                secondaryColor={theme.secondary}
              />}
              {showDeveloperControls && <DeveloperSoundPreview
                enabled={preferenceState.preferences.notifications.sounds}
              />}
            </>
          ) : undefined
        }
      />

      {campusPreviewActive && campusPreviewNotice && <div role="status" className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 text-sm text-[var(--app-text-secondary)]"><span>{campusPreviewNotice}</span><button type="button" onClick={() => changeUniversity(null)} className="shrink-0 rounded-full px-2 py-1 font-bold text-[var(--app-accent)]">Use my campus</button></div>}

      {searchOpen && (
        <GlobalSearchOverlay
          theme={theme}
          historyDepth={unifiedSearchState.history.length}
          initialScrollY={searchScrollYRef.current}
          onRequestBack={backSearchOverlay}
          onRequestClose={closeSearchOverlay}
          onScrollYChange={(scrollY) => {
            searchScrollYRef.current = scrollY;
          }}
        >
          <GlobalSearchSkeleton
            viewer={viewer}
            user={campusUser}
            theme={theme}
            profiles={profiles}
            mintz={mintz}
            eventMoments={visibleEventMoments}
            events={campusEventState.events}
            marketplace={marketplace}
            marketplacePermissionMode={campusPreviewActive ? "verified_student" : marketplacePermissionMode}
            organizations={organizations}
            stories={visibleStories}
            searchState={unifiedSearchState}
            onSearchStateChange={updateSearchState}
            onOpenDirectMint={openDirectMintFromSearch}
            onLogout={logoutDevelopmentUser}
            autoFocus
          />
        </GlobalSearchOverlay>
      )}

      {specialSection && (
        <div className="mx-auto max-w-5xl px-4 pb-36 pt-5 sm:px-6">
          {sectionContent(specialSection)}
        </div>
      )}

      <div
        aria-hidden={specialSection ? "true" : undefined}
        className={specialSection ? "invisible h-0 overflow-hidden" : undefined}
      >
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
                reducedMotion ||
                !swipeSettling
                  ? "none"
                  : `transform ${HORIZONTAL_SNAP_MS}ms cubic-bezier(.22,1,.36,1)`,
            }}
          >
            {swipeSections.map((section, frameIndex) => (
              <div
                key={`${frameIndex}:${section ?? "edge"}`}
                className="w-1/3 shrink-0"
                data-active-swipe-frame={section === activeSection ? "true" : "false"}
                style={{ height: section === activeSection ? "auto" : 0 }}
              >
                {section ? sectionFrame(section) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

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
        presentation={notchPresentation}
        swipeProgress={swipeProgress}
        swipeSettling={swipeSettling}
        reducedMotion={reducedMotion}
        onSelect={selectSection}
        onMintTap={handleMintTap}
        onCreateMint={beginCreateMint}
        onExpand={() => {
          const presentation = expandNotchPresentation(notchScrollStateRef.current.presentation);
          notchScrollStateRef.current = { ...notchScrollStateRef.current, presentation, travel: 0 };
          setNotchPresentation(presentation);
        }}
      />

      {createMintOpen && !campusPreviewActive && (
        <CreateContentFlow
          viewer={viewer}
          users={createMintUsers}
          theme={theme}
          onCreateMint={mintz.createMint}
          onClose={closeCreateMint}
          organizationMemberships={organizations.memberships}
          organizationRoles={organizations.roles}
          selectedMedia={createMintMedia}
          onRestoreMedia={setCreateMintMedia}
          mediaError={createMintMediaError}
          mediaPreparing={createMintMediaPreparing}
          onChooseMedia={openCreateMintMediaPicker}
          onClearMedia={() => {
            setCreateMintMedia([]);
            setCreateMintMediaError(null);
          }}
          drafts={mintz.drafts}
          onSaveDraft={mintz.saveDraft}
          onDeleteDraft={mintz.deleteDraft}
          highQualityUploads={preferenceState.preferences.content.highQualityUploads}
          defaultCommentsEnabled={
            preferenceState.preferences.content.commentsDefault
          }
        />
      )}

      {notificationsOpen && (
        <NotificationsPanel
          notifications={campusNotifications}
          users={profiles.users}
          theme={theme}
          origin={notificationOrigin}
          reducedMotion={reducedMotion}
          onOpen={openNotification}
          onClose={() => setNotificationsOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          viewer={campusPreviewActive ? profiles.currentUser : viewer}
          theme={theme}
          profiles={profiles}
          preferenceState={preferenceState}
          onOpenProfile={() => openProfile(viewer.account.id)}
          onApplyCreator={() => setCreatorApplicationOpen(true)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
    </CampusPreviewContext>
  );
}
