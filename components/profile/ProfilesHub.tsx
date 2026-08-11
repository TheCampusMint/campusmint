"use client";

import { useState } from "react";

import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { PeopleSearch } from "@/components/profile/PeopleSearch";
import { ProfilePrivacyModal } from "@/components/profile/ProfilePrivacyModal";
import { ProfileMintz } from "@/components/profile/ProfileMintz";
import { MintBackLeaf, ProfileView } from "@/components/profile/ProfileView";
import {
  developmentOrganizations,
  getOrganizationById,
} from "@/data/organizations";
import type { UniversityTheme } from "@/data/universities";
import type { ProfilesState } from "@/hooks/useProfiles";
import type { MintzState } from "@/hooks/useMintz";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import type { MarketplaceListing } from "@/types/marketplace";
import type { CampusMintUser } from "@/types/profile";
import { canJoinOrganization } from "@/lib/organizationPermissions";
import type { Story } from "@/types/story";

type ProfilesHubProps = {
  mode: "people" | "profile";
  selectedUserId: string;
  viewer: CampusMintUser;
  theme: UniversityTheme;
  visibleStories: Story[];
  marketplaceListings: MarketplaceListing[];
  profiles: ProfilesState;
  mintz: MintzState;
  organizations: OrganizationsState;
  onOpenProfile: (userId: string) => void;
  onBack: () => void;
};

export function ProfilesHub({ mode, selectedUserId, viewer, theme, visibleStories, marketplaceListings, profiles, mintz, organizations, onOpenProfile, onBack }: ProfilesHubProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const owner = selectedUserId === viewer.account.id ? viewer : profiles.getUserById(selectedUserId);

  if (mode === "people") {
    return <PeopleSearch viewer={viewer} users={profiles.users} theme={theme} getFriendshipStatus={profiles.getFriendshipStatus} isBlocked={profiles.isBlocked} onOpenProfile={onOpenProfile} />;
  }

  if (!owner || profiles.isBlocked(owner.account.id)) {
    return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-black text-slate-900">Profile unavailable</h2><p className="mt-2 text-sm text-slate-500">This development profile is missing or blocked.</p><button type="button" onClick={onBack} aria-label="Go back" className="interactive-pop mt-5 flex h-10 w-10 items-center justify-center border-0 bg-transparent p-0 text-slate-800 shadow-none"><MintBackLeaf /></button></div>;
  }

  const friendshipStatus = profiles.getFriendshipStatus(owner.account.id);

  const ledOrganizations =
    viewer.account.id === owner.account.id
      ? []
      : developmentOrganizations.filter((organization) => {
          if (organization.recordStatus !== "active") return false;

          const viewerMembership =
            organizations.getMembershipStatus(
              organization.id,
              viewer.account.id,
            );

          const viewerHasLeaderRole =
            organizations.roles.some(
              (assignment) =>
                assignment.organizationId === organization.id &&
                assignment.userId === viewer.account.id &&
                assignment.role === "leader",
            );

          return (
            viewerMembership === "leader" &&
            viewerHasLeaderRole &&
            canJoinOrganization(
              {
                role: owner.account.role,
                universityId: owner.account.universityId,
              },
              organization,
            )
          );
        });

  const clubInviteOptions =
    ledOrganizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      status: organizations.getMembershipStatus(
        organization.id,
        owner.account.id,
      ),
    }));

  const incomingClubInvitations =
    owner.account.id === viewer.account.id
      ? organizations.memberships.flatMap((membership) => {
          if (
            membership.userId !== viewer.account.id ||
            membership.status !== "invited"
          ) {
            return [];
          }

          const organization =
            getOrganizationById(membership.organizationId);

          return organization
            ? [{
                id: organization.id,
                name: organization.name,
              }]
            : [];
        })
      : [];

  return <>
    {notice && <div role="status" className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div>}
    <ProfileView
      viewer={viewer}
      owner={owner}
      theme={theme}
      friendshipStatus={friendshipStatus}
      following={profiles.isFollowing(owner.account.id)}
      recentStories={visibleStories.filter((story) => story.authorUserId === owner.account.id)}
      marketplaceListings={marketplaceListings}
      onBack={onBack}
      onEdit={() => setEditOpen(true)}
      onEditPrivacy={() => setPrivacyOpen(true)}
      onCycleFriendship={() => profiles.cycleFriendship(owner.account.id)}
      onToggleFollow={() => profiles.toggleFollow(owner.account.id)}
      onBlock={() => { profiles.blockUser(owner.account.id); onBack(); }}
      onReport={(reason, details) => { profiles.reportUser(owner.account.id, reason, details); setNotice("Report saved locally for development testing."); }}
      clubInviteOptions={clubInviteOptions}
      incomingClubInvitations={incomingClubInvitations}
      onInviteToClub={(organizationId) => {
        const organization = getOrganizationById(organizationId);
        if (!organization) return;

        organizations.inviteToOrganization(
          organization,
          owner.account.id,
        );

        setNotice(
          `Invitation sent to ${owner.profile.displayName} for ${organization.name}.`,
        );
      }}
      onAcceptClubInvitation={(organizationId) => {
        const organization = getOrganizationById(organizationId);
        if (!organization) return;

        organizations.acceptInvitation(organization);
        setNotice(`You joined ${organization.name}.`);
      }}
      onDeclineClubInvitation={(organizationId) => {
        const organization = getOrganizationById(organizationId);
        if (!organization) return;

        organizations.declineInvitation(organizationId);
        setNotice(`Invitation to ${organization.name} declined.`);
      }}
      socialContent={<ProfileMintz viewer={viewer} owner={owner} theme={theme} profiles={profiles} mintz={mintz} organizations={organizations} onOpenProfile={onOpenProfile} />}
    />
    {editOpen && <EditProfileModal user={viewer} primaryColor={theme.primary} onSave={profiles.updateCurrentProfile} onClose={() => setEditOpen(false)} />}
    {privacyOpen && <ProfilePrivacyModal settings={viewer.privacy} socialSettings={viewer.socialSettings} primaryColor={theme.primary} onSave={profiles.updateCurrentPrivacy} onSaveSocial={profiles.updateCurrentSocialSettings} onClose={() => setPrivacyOpen(false)} />}
  </>;
}
