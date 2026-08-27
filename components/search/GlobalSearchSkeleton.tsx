"use client";

import { useLayoutEffect, useMemo, useRef } from "react";

import { SearchDiscoveryResults } from "@/components/search/SearchDiscoveryResults";
import { SearchResultDetails } from "@/components/search/SearchResultDetails";
import { MarketplaceRestricted } from "@/components/marketplace/MarketplaceRestricted";
import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import { diningLocations } from "@/data/discovery/dining";
import { sampleEvents } from "@/data/events";
import { developmentOrganizations } from "@/data/organizations";
import {
  getAccountConfiguredUniversityId,
  getAccountUniversityName,
  type UniversityTheme,
} from "@/data/universities";
import type { EventMomentsState } from "@/hooks/useEventMoments";
import type { useMarketplace } from "@/hooks/useMarketplace";
import type { MintzState } from "@/hooks/useMintz";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import type { ProfilesState } from "@/hooks/useProfiles";
import {
  canViewMarketplace,
  type MarketplacePermissionMode,
} from "@/lib/marketplacePermissions";
import { canViewOrganization } from "@/lib/organizationPermissions";
import { rankEventContent } from "@/lib/content/eventRanking";
import {
  filterUnifiedSearchCandidates,
  getAnchoredSearchScrollY,
  getUnifiedSearchCategoryCount,
  openUnifiedSearchDetail,
  setUnifiedSearchCategory,
  type UnifiedSearchAccess,
  type UnifiedSearchCandidate,
  type UnifiedSearchCategory,
  type UnifiedSearchState,
} from "@/lib/search/unifiedSearch";
import {
  canViewClubs,
  canViewInterests,
  canViewMajor,
  canViewRoommate,
  canViewTutoring,
  createProfileViewerContext,
} from "@/lib/social/permissions";
import type { Organization } from "@/types/organization";
import type { CampusMintUser } from "@/types/profile";
import type { Story } from "@/types/story";
import type { TemporaryUser } from "@/types/user";

type MarketplaceState = ReturnType<typeof useMarketplace>;

const categoryOptions: {
  id: UnifiedSearchCategory;
  label: string;
  icon: string;
  description: string;
}[] = [
  { id: "people", label: "People", icon: "◉", description: "Students everywhere" },
  { id: "food", label: "Food", icon: "◒", description: "Places to eat" },
  { id: "tutoring", label: "Tutoring", icon: "✎", description: "Students who tutor" },
  { id: "clubs", label: "Clubs", icon: "♣", description: "Campus organizations" },
  { id: "events", label: "Events", icon: "◫", description: "What is happening" },
  { id: "marketplace", label: "Marketplace", icon: "◇", description: "Campus listings" },
];

const searchPlaceholders: Record<UnifiedSearchCategory, string> = {
  people: "Search people across Campus Mint…",
  food: "Search food and dining…",
  tutoring: "Search tutors or subjects…",
  clubs: "Search clubs…",
  events: "Search campus events…",
  marketplace: "Search Marketplace…",
};

function uniqueWords(values: Array<string | null | undefined>) {
  return values.filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
}

export function GlobalSearchSkeleton({
  viewer,
  user,
  theme,
  profiles,
  mintz,
  eventMoments,
  marketplace,
  marketplacePermissionMode,
  organizations,
  stories,
  searchState,
  onSearchStateChange,
  onOpenDirectMint,
  onLogout,
  onOrganizationMembershipAction,
  autoFocus = false,
}: {
  viewer: CampusMintUser;
  user: TemporaryUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  mintz: MintzState;
  eventMoments: EventMomentsState;
  marketplace: MarketplaceState;
  marketplacePermissionMode: MarketplacePermissionMode;
  organizations: OrganizationsState;
  stories: Story[];
  searchState: UnifiedSearchState;
  onSearchStateChange: (state: UnifiedSearchState) => void;
  onOpenDirectMint: (userId: string) => void;
  onLogout: () => void;
  onOrganizationMembershipAction: (organization: Organization) => void;
  autoFocus?: boolean;
}) {
  const controlsAnchorRef = useRef<HTMLDivElement>(null);
  const pendingAnchorYRef = useRef<number | null>(null);
  const configuredUniversityId =
    getAccountConfiguredUniversityId(viewer.account);
  const campusNetworkId = configuredUniversityId
    ? getCampusNetworkForUniversity(configuredUniversityId)?.id ?? null
    : null;
  const marketplaceAllowed = canViewMarketplace(
    user,
    marketplacePermissionMode,
  );

  const blockedUserIds = useMemo(
    () =>
      profiles.blocks.flatMap((block) => {
        if (block.blockerId === viewer.account.id) return [block.blockedId];
        if (block.blockedId === viewer.account.id) return [block.blockerId];
        return [];
      }),
    [profiles.blocks, viewer.account.id],
  );

  const access: UnifiedSearchAccess = {
    configuredUniversityId,
    accessibleCampusIds: theme.accessibleCampuses,
    campusNetworkId,
    blockedUserIds,
    marketplaceAllowed,
  };

  const candidates = useMemo<UnifiedSearchCandidate[]>(() => {
    const peopleResults: UnifiedSearchCandidate[] = profiles.users
      .filter((candidate) => candidate.account.id !== viewer.account.id)
      .map((candidate) => {
        const friendshipStatus = profiles.getFriendshipStatus(
          candidate.account.id,
        );
        const context = createProfileViewerContext(
          viewer,
          candidate,
          friendshipStatus,
        );
        const academicArea = canViewMajor(context)
          ? candidate.profile.academicArea
          : null;
        const interests = canViewInterests(context)
          ? [
              ...(candidate.profile.interests ?? []),
              ...(candidate.profile.hobbies ?? []),
            ]
          : [];
        const clubNames = canViewClubs(context)
          ? developmentOrganizations
              .filter((organization) =>
                candidate.profile.clubIds.includes(organization.id),
              )
              .map((organization) => organization.name)
          : [];
        const roommateTerms =
          canViewRoommate(context) && candidate.profile.lookingForRoommate
            ? [
                "roommate",
                "looking for roommate",
                ...(candidate.profile.roommatePreferences ?? []),
              ]
            : [];
        const tutoringAllowed =
          canViewTutoring(context) &&
          Boolean(candidate.profile.offersTutoring);
        const tutoringTerms = tutoringAllowed
          ? [
              "tutor",
              "tutoring",
              ...(candidate.profile.tutoringSubjects ?? []),
            ]
          : [];
        const universityName = getAccountUniversityName(candidate.account);

        return {
          id: candidate.account.id,
          title: candidate.profile.displayName,
          subtitle: `@${candidate.profile.username} · ${universityName}`,
          category: "people",
          typeLabel: "Person",
          profileId: candidate.account.id,
          tutoring: tutoringAllowed,
          tutoringSubjects: tutoringAllowed
            ? candidate.profile.tutoringSubjects ?? []
            : [],
          scope: {
            kind: "global_person",
            userId: candidate.account.id,
          },
          searchText: uniqueWords([
            candidate.profile.displayName,
            candidate.profile.username,
            universityName,
            academicArea,
            ...interests,
            ...clubNames,
            ...roommateTerms,
            ...tutoringTerms,
          ])
            .join(" ")
            .toLocaleLowerCase(),
        };
      });

    const clubResults: UnifiedSearchCandidate[] = developmentOrganizations
      .filter((organization) => canViewOrganization(user, organization))
      .map((organization) => ({
        id: organization.id,
        title: organization.name,
        subtitle: organization.shortDescription,
        category: "clubs",
        typeLabel: "Club",
        detail: { kind: "club", id: organization.id },
        scope: { kind: "campus", campusId: organization.universityId },
        searchText: uniqueWords([
          organization.name,
          organization.category,
          organization.shortDescription,
          organization.fullDescription,
          organization.meetingLocation,
          organization.meetingSchedule,
          ...organization.keywords,
        ])
          .join(" ")
          .toLocaleLowerCase(),
      }));

    const foodResults: UnifiedSearchCandidate[] = diningLocations
      .filter(
        (item) =>
          process.env.NODE_ENV === "development" || !item.source.isDevelopment,
      )
      .map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: item.area,
        category: "food",
        typeLabel: "Food",
        detail: { kind: "food", id: item.id },
        scope: {
          kind: "universities",
          universityIds: item.accessibleUniversityIds,
        },
        searchText: uniqueWords([
          item.name,
          item.area,
          item.address,
          item.description,
          ...item.categories,
          "food dining restaurant coffee menu",
        ])
          .join(" ")
          .toLocaleLowerCase(),
      }));

    const eventResults: UnifiedSearchCandidate[] = rankEventContent(sampleEvents).map((event) => ({
      id: event.id,
      title: event.title,
      subtitle: `${event.date} · ${event.location}`,
      category: "events",
      typeLabel: "Event",
      detail: { kind: "event", id: event.id },
      scope: { kind: "campus", campusId: event.campus },
      searchText: uniqueWords([
        event.title,
        event.description,
        event.category,
        event.date,
        event.time,
        event.location,
        event.audience,
        "event",
      ])
        .join(" ")
        .toLocaleLowerCase(),
    }));

    const marketplaceResults: UnifiedSearchCandidate[] = marketplace.listings
      .filter(
        (listing) =>
          listing.status === "active" &&
          !marketplace.blockedSellerIds.includes(listing.sellerId),
      )
      .map((listing) => ({
        id: listing.id,
        title: listing.title,
        subtitle: `$${listing.askingPrice.toFixed(2)} · ${listing.description}`,
        category: "marketplace",
        typeLabel: "Market",
        detail: { kind: "marketplace", id: listing.id },
        scope: {
          kind: "campus_network",
          campusNetworkId: listing.campusNetworkId,
        },
        searchText: uniqueWords([
          listing.title,
          listing.description,
          listing.category,
          listing.condition,
          listing.pickupArea,
          "market marketplace listing",
        ])
          .join(" ")
          .toLocaleLowerCase(),
      }));

    return [
      ...peopleResults,
      ...clubResults,
      ...foodResults,
      ...eventResults,
      ...marketplaceResults,
    ];
  }, [
    marketplace.blockedSellerIds,
    marketplace.listings,
    profiles,
    user,
    viewer,
  ]);

  const filtered = filterUnifiedSearchCandidates(
    candidates,
    searchState,
    access,
  );
  const selectedCategory = categoryOptions.find(
    (option) => option.id === searchState.category,
  );
  const campusOnlyCategory = [
    "food",
    "clubs",
    "events",
    "marketplace",
  ].includes(searchState.category);

  useLayoutEffect(() => {
    const previousAnchorY = pendingAnchorYRef.current;
    const anchor = controlsAnchorRef.current;
    pendingAnchorYRef.current = null;

    if (previousAnchorY === null || !anchor) return;

    const scrollContainer = anchor.closest<HTMLElement>(
      "[data-search-scroll-container]",
    );
    const currentScrollY = scrollContainer?.scrollTop ?? window.scrollY;
    const nextScrollY = getAnchoredSearchScrollY({
      currentScrollY,
      previousAnchorY,
      nextAnchorY: anchor.getBoundingClientRect().top,
    });

    if (Math.abs(nextScrollY - currentScrollY) > 0.5) {
      (scrollContainer ?? window).scrollTo({
        top: nextScrollY,
        behavior: "auto",
      });
    }
  }, [searchState.category]);

  function selectCategory(category: UnifiedSearchCategory) {
    if (category === searchState.category) return;

    pendingAnchorYRef.current =
      controlsAnchorRef.current?.getBoundingClientRect().top ?? null;
    const next = setUnifiedSearchCategory(
      searchState,
      category,
    );
    onSearchStateChange(next);
  }

  return (
    <div className="space-y-5">
      <div ref={controlsAnchorRef} className="space-y-5" data-search-controls-anchor>
        <label className="relative block">
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-400"
            aria-hidden="true"
          >
            ⌕
          </span>
          <input
            autoFocus={autoFocus}
            value={searchState.query}
            onChange={(event) =>
              onSearchStateChange({
                ...searchState,
                query: event.target.value,
                history: [],
              })
            }
            placeholder={searchPlaceholders[searchState.category]}
            className="w-full rounded-3xl border border-white/80 bg-white/95 py-4 pl-12 pr-4 text-base shadow-sm outline-none placeholder:text-slate-400/80 focus:ring-2"
            style={{ caretColor: theme.primary }}
          />
        </label>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {categoryOptions.map((option) => {
            const selected = searchState.category === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => selectCategory(option.id)}
                className="interactive-pop min-h-[92px] rounded-3xl border p-4 text-left shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2"
                style={
                  selected
                    ? {
                        backgroundColor: theme.primary,
                        borderColor: theme.primary,
                        color: theme.secondary,
                        outlineColor: theme.secondary,
                      }
                    : {
                        backgroundColor: "rgba(255,255,255,0.94)",
                        borderColor: "rgba(226,232,240,0.9)",
                        color: "#0f172a",
                        outlineColor: theme.primary,
                      }
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-2xl font-black" aria-hidden="true">
                    {option.icon}
                  </span>
                  <span
                    className={`cm-eyebrow rounded-full px-2 py-0.5 ${
                      selected ? "bg-white/15" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {getUnifiedSearchCategoryCount(candidates, option.id, access)}
                  </span>
                </div>
                <strong className="mt-3 block text-sm font-black">
                  {option.label}
                </strong>
                <span
                  className={`mt-0.5 block text-[11px] ${
                    selected ? "opacity-75" : "text-slate-500"
                  }`}
                >
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {campusOnlyCategory && !configuredUniversityId ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center">
          <h2 className="font-black text-slate-900">
            {selectedCategory?.label} is not configured for your university yet
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your student identity still works across Campus Mint. Campus-specific
            discovery will appear here when your university is configured.
          </p>
        </div>
      ) : searchState.category === "marketplace" && !marketplaceAllowed ? (
        <MarketplaceRestricted user={user} theme={theme} />
      ) : (
        <SearchDiscoveryResults
          state={searchState}
          candidates={filtered}
          viewer={viewer}
          user={
            configuredUniversityId
              ? { ...user, universityId: configuredUniversityId }
              : user
          }
          theme={theme}
          profiles={profiles}
          eventMoments={eventMoments}
          marketplace={marketplace}
          organizations={organizations}
          onOpen={(detail) =>
            onSearchStateChange(
              openUnifiedSearchDetail(searchState, detail),
            )
          }
          onSelectTutoringSubject={(subject) =>
            onSearchStateChange({
              ...searchState,
              categoryFilters: {
                ...searchState.categoryFilters,
                tutoringSubject: subject,
              },
              history: [],
            })
          }
          onOrganizationMembershipAction={onOrganizationMembershipAction}
        />
      )}

      <SearchResultDetails
        state={searchState}
        onStateChange={onSearchStateChange}
        viewer={viewer}
        user={user}
        configuredUniversityId={configuredUniversityId}
        theme={theme}
        profiles={profiles}
        mintz={mintz}
        eventMoments={eventMoments}
        marketplace={marketplace}
        marketplacePermissionMode={marketplacePermissionMode}
        organizations={organizations}
        stories={stories}
        onOpenDirectMint={onOpenDirectMint}
        onLogout={onLogout}
        onOrganizationMembershipAction={onOrganizationMembershipAction}
      />
    </div>
  );
}
