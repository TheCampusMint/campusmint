"use client";

import { useState } from "react";

import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { PeopleSearch } from "@/components/profile/PeopleSearch";
import { ProfilePrivacyModal } from "@/components/profile/ProfilePrivacyModal";
import { ProfileView } from "@/components/profile/ProfileView";
import type { UniversityTheme } from "@/data/universities";
import type { ProfilesState } from "@/hooks/useProfiles";
import type { MarketplaceListing } from "@/types/marketplace";
import type { CampusMintUser } from "@/types/profile";
import type { Story } from "@/types/story";

type ProfilesHubProps = {
  mode: "people" | "profile";
  selectedUserId: string;
  viewer: CampusMintUser;
  theme: UniversityTheme;
  visibleStories: Story[];
  marketplaceListings: MarketplaceListing[];
  profiles: ProfilesState;
  onOpenProfile: (userId: string) => void;
  onBackToPeople: () => void;
};

export function ProfilesHub({ mode, selectedUserId, viewer, theme, visibleStories, marketplaceListings, profiles, onOpenProfile, onBackToPeople }: ProfilesHubProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const owner = selectedUserId === viewer.account.id ? viewer : profiles.getUserById(selectedUserId);

  if (mode === "people") {
    return <PeopleSearch viewer={viewer} users={profiles.users} theme={theme} getFriendshipStatus={profiles.getFriendshipStatus} isBlocked={profiles.isBlocked} onOpenProfile={onOpenProfile} />;
  }

  if (!owner || profiles.isBlocked(owner.account.id)) {
    return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-black text-slate-900">Profile unavailable</h2><p className="mt-2 text-sm text-slate-500">This development profile is missing or blocked.</p><button type="button" onClick={onBackToPeople} className="mt-5 rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: theme.primary }}>Back to People</button></div>;
  }

  const friendshipStatus = profiles.getFriendshipStatus(owner.account.id);

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
      onBack={onBackToPeople}
      onEdit={() => setEditOpen(true)}
      onEditPrivacy={() => setPrivacyOpen(true)}
      onCycleFriendship={() => profiles.cycleFriendship(owner.account.id)}
      onToggleFollow={() => profiles.toggleFollow(owner.account.id)}
      onBlock={() => { profiles.blockUser(owner.account.id); onBackToPeople(); }}
      onReport={(reason, details) => { profiles.reportUser(owner.account.id, reason, details); setNotice("Report saved locally for development testing."); }}
    />
    {editOpen && <EditProfileModal user={viewer} primaryColor={theme.primary} onSave={profiles.updateCurrentProfile} onClose={() => setEditOpen(false)} />}
    {privacyOpen && <ProfilePrivacyModal settings={viewer.privacy} primaryColor={theme.primary} onSave={profiles.updateCurrentPrivacy} onClose={() => setPrivacyOpen(false)} />}
  </>;
}
