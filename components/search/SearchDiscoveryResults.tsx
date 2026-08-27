"use client";

import { DiningLocationCard } from "@/components/dining/DiningLocationCard";
import { EventCard } from "@/components/events/EventCard";
import { MarketplaceCard } from "@/components/marketplace/MarketplaceCard";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { diningLocations } from "@/data/discovery/dining";
import { sampleEvents } from "@/data/events";
import { developmentOrganizations } from "@/data/organizations";
import {
  getCampusName,
  getAccountUniversityShortName,
  universities,
  type UniversityTheme,
} from "@/data/universities";
import type { EventMomentsState } from "@/hooks/useEventMoments";
import type { useMarketplace } from "@/hooks/useMarketplace";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import type { ProfilesState } from "@/hooks/useProfiles";
import { rankEventContent } from "@/lib/content/eventRanking";
import { canJoinOrganization } from "@/lib/organizationPermissions";
import {
  canViewClubs,
  canViewInterests,
  canViewMajor,
  canViewTutoring,
  createProfileViewerContext,
} from "@/lib/social/permissions";
import type {
  UnifiedSearchCandidate,
  UnifiedSearchCategory,
  UnifiedSearchDetail,
  UnifiedSearchState,
} from "@/lib/search/unifiedSearch";
import type { Organization } from "@/types/organization";
import type { CampusMintUser } from "@/types/profile";
import type { TemporaryUser } from "@/types/user";

type MarketplaceState = ReturnType<typeof useMarketplace>;

function CategoryHeading({
  title,
  count,
}: {
  title: string;
  count: number;
}) {
  return (
    <div className="mb-3 px-1">
      <div>
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        <p className="mt-0.5 text-xs font-semibold text-slate-400">
          {count} {count === 1 ? "result" : "results"}
        </p>
      </div>
    </div>
  );
}

function EmptyResults({ query }: { query: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/65 p-9 text-center">
      <h2 className="font-black text-slate-900">
        {query.trim() ? "No matches yet" : "Nothing available here yet"}
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        {query.trim()
          ? "Try another name, school, subject, place, or keyword."
          : "Choose another discovery category."}
      </p>
    </div>
  );
}

function PeopleResults({
  candidates,
  viewer,
  profiles,
  theme,
  tutoringOnly = false,
  onOpenProfile,
}: {
  candidates: readonly UnifiedSearchCandidate[];
  viewer: CampusMintUser;
  profiles: ProfilesState;
  theme: UniversityTheme;
  tutoringOnly?: boolean;
  onOpenProfile: (userId: string) => void;
}) {
  const people = candidates
    .flatMap((candidate) => {
      if (!candidate.profileId) return [];
      const person = profiles.getUserById(candidate.profileId);
      if (!person) return [];
      const context = createProfileViewerContext(
        viewer,
        person,
        profiles.getFriendshipStatus(person.account.id),
      );
      const visibleMajor = canViewMajor(context)
        ? person.profile.academicArea ?? person.profile.major
        : null;
      const interests = canViewInterests(context)
        ? [...(person.profile.interests ?? []), ...(person.profile.hobbies ?? [])]
        : [];
      const clubs = canViewClubs(context)
        ? developmentOrganizations
            .filter((organization) =>
              person.profile.clubIds.includes(organization.id),
            )
            .map((organization) => organization.name)
        : [];
      const tutoringSubjects =
        canViewTutoring(context) && person.profile.offersTutoring
          ? person.profile.tutoringSubjects ?? []
          : [];

      return [{
        person,
        visibleMajor,
        interests,
        clubs,
        tutoringSubjects,
      }];
    });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {people.map(
        ({ person, visibleMajor, interests, clubs, tutoringSubjects }) => (
          <button
            key={person.account.id}
            type="button"
            onClick={() => onOpenProfile(person.account.id)}
            className="rounded-[1.55rem] border border-white/80 bg-white/95 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: theme.primary }}
          >
            <div className="flex items-center gap-4">
              <ProfileAvatar
                user={person}
                primaryColor={theme.primary}
                accentColor={theme.accent}
              />
              <div className="min-w-0">
                <h3 className="truncate font-black text-slate-950">
                  {person.profile.displayName}
                </h3>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  @{person.profile.username} ·{" "}
                  {getAccountUniversityShortName(person.account)}
                </p>
              </div>
            </div>
            {visibleMajor && (
              <p className="mt-4 text-sm font-bold text-slate-700">
                {visibleMajor}
              </p>
            )}
            {tutoringOnly && tutoringSubjects.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tutoringSubjects.slice(0, 4).map((subject) => (
                  <span
                    key={subject}
                    className="rounded-full px-2.5 py-1 text-[10px] font-black"
                    style={{ backgroundColor: theme.accent, color: theme.primary }}
                  >
                    {subject}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[...interests, ...clubs].slice(0, 3).map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </button>
        ),
      )}
    </div>
  );
}

function MarketplaceResults({
  candidates,
  marketplace,
  theme,
  onOpen,
}: {
  candidates: readonly UnifiedSearchCandidate[];
  marketplace: MarketplaceState;
  theme: UniversityTheme;
  onOpen: (detail: UnifiedSearchDetail) => void;
}) {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const listings = marketplace.listings
    .filter((listing) => candidateIds.has(listing.id));

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {listings.map((listing) => (
        <MarketplaceCard
          key={listing.id}
          listing={listing}
          saved={marketplace.savedListingIds.includes(listing.id)}
          theme={theme}
          onOpen={(listingId, panel) =>
            onOpen({ kind: "marketplace", id: listingId, panel })
          }
          onToggleSaved={marketplace.toggleSaved}
        />
      ))}
    </div>
  );
}

function EventResults({
  candidates,
  eventMoments,
  viewerId,
  theme,
  onOpen,
}: {
  candidates: readonly UnifiedSearchCandidate[];
  eventMoments: EventMomentsState;
  viewerId: string;
  theme: UniversityTheme;
  onOpen: (detail: UnifiedSearchDetail) => void;
}) {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const events = rankEventContent(sampleEvents)
    .filter((event) => candidateIds.has(event.id));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          campusName={getCampusName(event.campus)}
          isGoing={eventMoments.isAttending(event.id, viewerId)}
          theme={theme}
          onToggleRsvp={() => eventMoments.toggleRsvp(event, viewerId)}
          onOpenDetails={() => onOpen({ kind: "event", id: event.id })}
        />
      ))}
    </div>
  );
}

function FoodResults({
  candidates,
  theme,
  onOpen,
}: {
  candidates: readonly UnifiedSearchCandidate[];
  theme: UniversityTheme;
  onOpen: (detail: UnifiedSearchDetail) => void;
}) {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {diningLocations
        .filter((location) => candidateIds.has(location.id))
        .map((location) => (
          <DiningLocationCard
            key={location.id}
            location={location}
            theme={theme}
            onViewDetails={() => onOpen({ kind: "food", id: location.id })}
          />
        ))}
    </div>
  );
}

function ClubResults({
  candidates,
  user,
  theme,
  organizations,
  onOpen,
  onMembershipAction,
}: {
  candidates: readonly UnifiedSearchCandidate[];
  user: TemporaryUser;
  theme: UniversityTheme;
  organizations: OrganizationsState;
  onOpen: (detail: UnifiedSearchDetail) => void;
  onMembershipAction: (organization: Organization) => void;
}) {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const clubs = developmentOrganizations
    .filter((organization) => candidateIds.has(organization.id));

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {clubs.map((organization) => {
        const status = organizations.getMembershipStatus(organization.id);
        const joined = ["member", "officer", "leader"].includes(status);
        const membershipAllowed = canJoinOrganization(user, organization);
        const disabled =
          !membershipAllowed ||
          status === "requested" ||
          status === "blocked" ||
          status === "officer" ||
          status === "leader" ||
          (status === "none" &&
            ["invitation", "restricted"].includes(
              organization.membershipType,
            ));

        return (
          <article
            key={organization.id}
            className="flex h-full flex-col rounded-[1.55rem] border border-white/80 bg-white/95 p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black"
                style={{ backgroundColor: theme.accent, color: theme.primary }}
              >
                {organization.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word.at(0))
                  .join("")
                  .toUpperCase()}
              </span>
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-orange-800">
                {organization.category}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-black leading-6 text-slate-950">
              {organization.name}
            </h3>
            <p className="mt-1 text-xs font-bold" style={{ color: theme.primary }}>
              {universities[organization.universityId].shortName}
            </p>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
              {organization.shortDescription}
            </p>
            <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-slate-400">
              {joined
                ? "Member community available in Groups"
                : organization.membershipType === "application"
                  ? "Membership request required"
                  : "Open membership"}
            </p>
            <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
              <button
                type="button"
                onClick={() => onOpen({ kind: "club", id: organization.id })}
                className="rounded-xl border px-3 py-2.5 text-xs font-black"
                style={{ borderColor: theme.primary, color: theme.primary }}
              >
                View club
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onMembershipAction(organization)}
                className="rounded-xl px-3 py-2.5 text-xs font-black disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500"
                style={
                  !disabled
                    ? {
                        backgroundColor: joined ? theme.accent : theme.primary,
                        color: joined ? theme.primary : theme.secondary,
                      }
                    : undefined
                }
              >
                {joined
                  ? "Leave"
                  : status === "requested"
                    ? "Requested"
                    : organization.membershipType === "application"
                      ? "Request"
                      : "Join"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

type SearchDiscoveryResultsProps = {
  state: UnifiedSearchState;
  candidates: readonly UnifiedSearchCandidate[];
  viewer: CampusMintUser;
  user: TemporaryUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  eventMoments: EventMomentsState;
  marketplace: MarketplaceState;
  organizations: OrganizationsState;
  onOpen: (detail: UnifiedSearchDetail) => void;
  onSelectTutoringSubject: (subject: string | null) => void;
  onOrganizationMembershipAction: (organization: Organization) => void;
};

export function SearchDiscoveryResults({
  state,
  candidates,
  viewer,
  user,
  theme,
  profiles,
  eventMoments,
  marketplace,
  organizations,
  onOpen,
  onSelectTutoringSubject,
  onOrganizationMembershipAction,
}: SearchDiscoveryResultsProps) {
  const byCategory = (category: UnifiedSearchCategory) =>
    candidates.filter((candidate) =>
      category === "tutoring"
        ? candidate.category === "people" && candidate.tutoring
        : candidate.category === category,
    );

  const categoryCandidates = byCategory(state.category);
  const tutoringCandidates = byCategory("tutoring");
  const tutoringSubjects = Array.from(
    new Set(
      tutoringCandidates.flatMap((candidate) =>
        candidate.tutoringSubjects ? [...candidate.tutoringSubjects] : [],
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));

  if (categoryCandidates.length === 0) {
    return <EmptyResults query={state.query} />;
  }

  return (
    <section>
      <CategoryHeading
        title={
          state.category === "food"
            ? "Dining discovery"
            : state.category.at(0)?.toUpperCase() + state.category.slice(1)
        }
        count={categoryCandidates.length}
      />
      {state.category === "people" && (
        <PeopleResults candidates={categoryCandidates} viewer={viewer} profiles={profiles} theme={theme} onOpenProfile={(id) => onOpen({ kind: "profile", id })} />
      )}
      {state.category === "tutoring" && (
        <div className="space-y-4">
          {tutoringSubjects.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Tutoring subjects">
              {[null, ...tutoringSubjects].map((subject) => {
                const selected = state.categoryFilters.tutoringSubject === subject;
                return (
                  <button
                    key={subject ?? "all"}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectTutoringSubject(subject)}
                    className="shrink-0 rounded-full border px-3.5 py-2 text-xs font-black"
                    style={selected ? { borderColor: theme.primary, backgroundColor: theme.accent, color: theme.primary } : { borderColor: "#e2e8f0", backgroundColor: "white", color: "#64748b" }}
                  >
                    {subject ?? "All subjects"}
                  </button>
                );
              })}
            </div>
          )}
          <PeopleResults candidates={categoryCandidates} viewer={viewer} profiles={profiles} theme={theme} tutoringOnly onOpenProfile={(id) => onOpen({ kind: "profile", id })} />
        </div>
      )}
      {state.category === "marketplace" && <MarketplaceResults candidates={categoryCandidates} marketplace={marketplace} theme={theme} onOpen={onOpen} />}
      {state.category === "events" && <EventResults candidates={categoryCandidates} eventMoments={eventMoments} viewerId={viewer.account.id} theme={theme} onOpen={onOpen} />}
      {state.category === "food" && <FoodResults candidates={categoryCandidates} theme={theme} onOpen={onOpen} />}
      {state.category === "clubs" && <ClubResults candidates={categoryCandidates} user={user} theme={theme} organizations={organizations} onOpen={onOpen} onMembershipAction={onOrganizationMembershipAction} />}
    </section>
  );
}
