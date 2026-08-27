"use client";

import { createPortal } from "react-dom";

import { OrganizationDetailModal } from "@/components/clubs/OrganizationDetailModal";
import { MintLeafBackButton } from "@/components/ui/MintLeafBackButton";
import { DiningLocationDetail } from "@/components/dining/DiningLocationDetail";
import { EventMomentEventDetail } from "@/components/events/EventMomentEventDetail";
import { MarketplaceDetailModal } from "@/components/marketplace/MarketplaceDetailModal";
import { ProfilesHub } from "@/components/profile/ProfilesHub";
import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import { diningLocations } from "@/data/discovery/dining";
import { sampleEvents } from "@/data/events";
import {
  developmentOrganizationAnnouncements,
  developmentOrganizationOfficers,
  getOrganizationById,
} from "@/data/organizations";
import type { UniversityId, UniversityTheme } from "@/data/universities";
import type { EventMomentsState } from "@/hooks/useEventMoments";
import type { useMarketplace } from "@/hooks/useMarketplace";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import type { ProfilesState } from "@/hooks/useProfiles";
import type { MintzState } from "@/hooks/useMintz";
import type { MarketplacePermissionMode } from "@/lib/marketplacePermissions";
import { canViewMarketplace } from "@/lib/marketplacePermissions";
import {
  canAccessOrganizationChat,
  canJoinOrganization,
  canModerateOrganizationMemberships,
  canViewOrganization,
} from "@/lib/organizationPermissions";
import { rankEventContent } from "@/lib/content/eventRanking";
import {
  closeUnifiedSearchDetail,
  currentUnifiedSearchDetail,
  openUnifiedSearchDetail,
  type UnifiedSearchDetail,
  type UnifiedSearchState,
} from "@/lib/search/unifiedSearch";
import {
  getEventMomentExpirationLabel,
  getVisibleEventMoments,
} from "@/lib/events/eventMoments";
import type { CampusMintUser } from "@/types/profile";
import type { Story } from "@/types/story";
import type { TemporaryUser } from "@/types/user";

type MarketplaceState = ReturnType<typeof useMarketplace>;

type SearchResultDetailsProps = {
  state: UnifiedSearchState;
  onStateChange: (state: UnifiedSearchState) => void;
  viewer: CampusMintUser;
  user: TemporaryUser;
  configuredUniversityId: UniversityId | null;
  theme: UniversityTheme;
  profiles: ProfilesState;
  mintz: MintzState;
  eventMoments: EventMomentsState;
  marketplace: MarketplaceState;
  marketplacePermissionMode: MarketplacePermissionMode;
  organizations: OrganizationsState;
  stories: Story[];
  onOpenDirectMint: (userId: string) => void;
  onLogout: () => void;
  onOrganizationMembershipAction: (
    organization: NonNullable<ReturnType<typeof getOrganizationById>>,
  ) => void;
};

function DiscoveryDetailOverlay({
  label,
  onClose,
  backLabel = "Back to Search",
  children,
}: {
  label: string;
  onClose: () => void;
  backLabel?: string;
  children: React.ReactNode;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
      data-horizontal-gesture-ignore
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-auto my-2 max-w-6xl">
        <MintLeafBackButton
          onClick={onClose}
          label={backLabel}
          tone="inverse"
          className="mb-3 focus-visible:outline-white"
        />
        <div aria-label={label}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function SearchResultDetails({
  state,
  onStateChange,
  viewer,
  user,
  configuredUniversityId,
  theme,
  profiles,
  mintz,
  eventMoments,
  marketplace,
  marketplacePermissionMode,
  organizations,
  stories,
  onOpenDirectMint,
  onLogout,
  onOrganizationMembershipAction,
}: SearchResultDetailsProps) {
  const detail = currentUnifiedSearchDetail(state);
  if (!detail) return null;

  const close = () => onStateChange(closeUnifiedSearchDetail(state));
  const push = (next: UnifiedSearchDetail) =>
    onStateChange(openUnifiedSearchDetail(state, next));
  const closeLabel =
    state.history.length > 1 ? "Back" : `Back to ${state.category}`;

  if (detail.kind === "profile") {
    if (profiles.isBlocked(detail.id)) return null;

    return (
      <DiscoveryDetailOverlay label="Profile Search detail" onClose={close} backLabel={closeLabel}>
        <div className="rounded-[2rem] bg-slate-50 p-3 sm:p-5">
          <ProfilesHub
            mode="profile"
            selectedUserId={detail.id}
            viewer={viewer}
            theme={theme}
            visibleStories={stories}
            marketplaceListings={marketplace.listings}
            profiles={profiles}
            mintz={mintz}
            organizations={organizations}
            onOpenDirectMint={onOpenDirectMint}
            onOpenProfile={(userId) => push({ kind: "profile", id: userId })}
            onBack={close}
            showBackControl={false}
            onLogout={onLogout}
          />
        </div>
      </DiscoveryDetailOverlay>
    );
  }

  if (detail.kind === "event") {
    const event = sampleEvents.find(
      (candidate) => candidate.id === detail.id,
    );

    if (
      !event ||
      !configuredUniversityId ||
      !theme.accessibleCampuses.includes(event.campus)
    ) {
      return null;
    }

    return (
      <EventMomentEventDetail
        event={event}
        viewer={viewer}
        theme={theme}
        profiles={profiles}
        eventMoments={eventMoments}
        onClose={close}
        closeLabel={closeLabel}
        onOpenMoment={(momentId) =>
          push({ kind: "event_moment", id: momentId, eventId: event.id })
        }
      />
    );
  }

  if (detail.kind === "event_moment") {
    const event = sampleEvents.find(
      (candidate) => candidate.id === detail.eventId,
    );
    const visibleMoment = getVisibleEventMoments(
      eventMoments.moments.filter((moment) => moment.id === detail.id),
      {
        viewerUserId: viewer.account.id,
        follows: profiles.follows,
        blocks: profiles.blocks,
        currentTime: eventMoments.currentTime,
      },
    )[0];
    if (!event || !visibleMoment) return null;
    const author = profiles.getUserById(visibleMoment.authorUserId);

    return (
      <DiscoveryDetailOverlay label="Event Moment Search detail" onClose={close} backLabel={closeLabel}>
        <article className="mx-auto max-w-xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
          <div
            className="flex aspect-[4/3] items-center justify-center text-white"
            style={{ background: `linear-gradient(145deg, ${theme.primary}, ${theme.accent})` }}
          >
            <div className="text-center drop-shadow-md">
              <span className="text-5xl" aria-hidden="true">
                {visibleMoment.media.type === "image" ? "▣" : "▶"}
              </span>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em]">
                Local {visibleMoment.media.type} placeholder
              </p>
            </div>
          </div>
          <div className="p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: theme.primary }}>
              Event Moment
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">{event.title}</h2>
            <button
              type="button"
              onClick={() => push({ kind: "profile", id: visibleMoment.authorUserId })}
              className="mt-3 text-sm font-bold text-slate-600 underline decoration-slate-300 underline-offset-4"
            >
              {author?.profile.displayName ?? "Campus Mint user"}
            </button>
            {visibleMoment.caption && (
              <p className="mt-4 text-sm leading-6 text-slate-600">{visibleMoment.caption}</p>
            )}
            <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <span className="text-xs font-bold text-slate-500">
                {getEventMomentExpirationLabel(visibleMoment, eventMoments.currentTime)}
              </span>
              {visibleMoment.authorUserId === viewer.account.id && !visibleMoment.kept && (
                <button
                  type="button"
                  onClick={() => eventMoments.keepMoment(visibleMoment.id, viewer.account.id)}
                  className="rounded-xl px-3 py-2 text-xs font-black"
                  style={{ backgroundColor: theme.accent, color: theme.primary }}
                >
                  Keep
                </button>
              )}
            </div>
          </div>
        </article>
      </DiscoveryDetailOverlay>
    );
  }

  if (detail.kind === "food") {
    const location = diningLocations.find(
      (candidate) => candidate.id === detail.id,
    );

    if (
      !location ||
      !configuredUniversityId ||
      !location.accessibleUniversityIds.includes(configuredUniversityId)
    ) {
      return null;
    }

    return (
      <DiscoveryDetailOverlay label={`${location.name} Search detail`} onClose={close} backLabel={closeLabel}>
        <DiningLocationDetail location={location} onClose={close} />
      </DiscoveryDetailOverlay>
    );
  }

  if (detail.kind === "marketplace") {
    const listing = marketplace.listings.find(
      (candidate) => candidate.id === detail.id,
    );
    const marketplaceAllowed = canViewMarketplace(
      user,
      marketplacePermissionMode,
    );
    const campusNetworkId = configuredUniversityId
      ? getCampusNetworkForUniversity(configuredUniversityId)?.id ?? null
      : null;

    if (
      !listing ||
      !marketplaceAllowed ||
      listing.campusNetworkId !== campusNetworkId ||
      marketplace.blockedSellerIds.includes(listing.sellerId)
    ) {
      return null;
    }

    const activeOffer = marketplace.offers.find(
      (offer) =>
        offer.listingId === listing.id &&
        offer.buyerId === marketplace.currentUserId &&
        offer.status === "offer_sent",
    );

    if (typeof document === "undefined") return null;

    return createPortal(
      <MarketplaceDetailModal
        listing={listing}
        theme={theme}
        currentUserId={marketplace.currentUserId}
        saved={marketplace.savedListingIds.includes(listing.id)}
        activeOffer={activeOffer}
        messages={marketplace.messages.filter(
          (message) => message.listingId === listing.id,
        )}
        alreadyReported={marketplace.reports.some(
          (report) => report.listingId === listing.id,
        )}
        onClose={close}
        closeLabel={closeLabel}
        initialPanel={detail.panel ?? "none"}
        onToggleSaved={() => marketplace.toggleSaved(listing.id)}
        onSendOffer={(amount, note) =>
          marketplace.sendOffer(listing.id, amount, note)
        }
        onWithdrawOffer={marketplace.withdrawOffer}
        onSendMessage={(body) => marketplace.sendMessage(listing.id, body)}
        onReport={(reason, details) =>
          marketplace.reportListing(listing.id, reason, details)
        }
        onBlockSeller={() => {
          marketplace.blockSeller(listing.sellerId);
          close();
        }}
        onUpdateStatus={(status) =>
          marketplace.updateListingStatus(listing.id, status)
        }
        onOpenSellerProfile={(userId) => {
          push({ kind: "profile", id: userId });
        }}
      />,
      document.body,
    );
  }

  const organization = getOrganizationById(detail.id);
  if (
    !organization ||
    !configuredUniversityId ||
    !theme.accessibleCampuses.includes(organization.universityId) ||
    !canViewOrganization(user, organization)
  ) {
    return null;
  }

  const configuredUser = { ...user, universityId: configuredUniversityId };
  const actor = {
    id: viewer.account.id,
    universityId: configuredUniversityId,
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <OrganizationDetailModal
      organization={organization}
      events={rankEventContent(sampleEvents).filter(
        (event) => event.organizationId === organization.id,
      )}
      stories={stories.filter(
        (story) => story.organizationId === organization.id,
      )}
      announcements={developmentOrganizationAnnouncements.filter(
        (announcement) => announcement.organizationId === organization.id,
      )}
      officers={developmentOrganizationOfficers.filter(
        (officer) => officer.organizationId === organization.id,
      )}
      membershipStatus={organizations.getMembershipStatus(organization.id)}
      membershipAllowed={canJoinOrganization(configuredUser, organization)}
      theme={theme}
      onClose={close}
      closeLabel={closeLabel}
      onMembershipAction={onOrganizationMembershipAction}
      onViewEvents={() =>
        onStateChange({ ...state, category: "events", query: "", history: [] })
      }
      viewer={viewer}
      profiles={profiles}
      pendingRequests={organizations.getPendingRequests(organization.id)}
      canModerateRequests={canModerateOrganizationMemberships(
        actor,
        organization,
        organizations.memberships,
        organizations.roles,
      )}
      canAccessChat={canAccessOrganizationChat(
        actor,
        organization,
        organizations.memberships,
      )}
      isChatParticipant={Boolean(
        organization.organizationConversationId &&
          organizations.isConversationParticipant(
            organization.organizationConversationId,
          ),
      )}
      memberCount={organizations.getMemberCount(organization.id)}
      isFollowing={organizations.followedOrganizationIds.includes(
        organization.id,
      )}
      onToggleFollow={() => organizations.toggleFollowOrganization(organization.id)}
      onAcceptRequest={(userId) =>
        organizations.acceptMembership(organization, userId)
      }
      onRejectRequest={(userId) =>
        organizations.rejectMembership(organization.id, userId)
      }
      onMessageOrganization={() =>
        Boolean(organizations.messageOrganization(organization).conversation)
      }
      onOpenProfile={(userId) => push({ kind: "profile", id: userId })}
    />,
    document.body,
  );
}
