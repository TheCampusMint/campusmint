"use client";

import { useState } from "react";

import { MintCard } from "@/components/mintz/MintCard";
import type { UniversityTheme } from "@/data/universities";
import type { MintzState } from "@/hooks/useMintz";
import type { ProfilesState } from "@/hooks/useProfiles";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import { getOrganizationById } from "@/data/organizations";
import {
  createMintPermissionContext,
  getVisibleProfileMintz,
  getVisibleTaggedMintz,
} from "@/lib/social/mintFeeds";
import { canViewPrivateAccountContent } from "@/lib/social/mintPermissions";
import type { CampusMintUser } from "@/types/profile";

type ProfileMintzProps = {
  viewer: CampusMintUser;
  owner: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  mintz: MintzState;
  organizations: OrganizationsState;
  onOpenProfile: (userId: string) => void;
};

export function ProfileMintz({ viewer, owner, theme, profiles, mintz, organizations, onOpenProfile }: ProfileMintzProps) {
  const [tab, setTab] = useState<"mintz" | "tagged">("mintz");
  const users = profiles.users.map((user) => user.account.id === viewer.account.id ? viewer : user);
  const feedState = { viewer, users, friendships: profiles.friendships, follows: profiles.follows, blocks: profiles.blocks, currentTime: mintz.currentTime, organizationMemberships: organizations.memberships, followedOrganizationIds: organizations.followedOrganizationIds };
  const canViewAccountContent = canViewPrivateAccountContent({
    viewer,
    author: owner,
    friendshipStatus: profiles.getFriendshipStatus(owner.account.id),
    viewerFollowsAuthor: profiles.isFollowing(owner.account.id),
    authorFollowsViewer: profiles.isFollowedBy(owner.account.id),
    blocked: profiles.isBlocked(owner.account.id),
  });
  const visibleMintz = tab === "mintz"
    ? getVisibleProfileMintz(mintz.mintz, owner.account.id, feedState)
    : getVisibleTaggedMintz(mintz.mintz, owner.account.id, feedState);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 px-1"><button type="button" onClick={() => setTab("mintz")} className="rounded-2xl px-4 py-2 text-sm font-bold" style={tab === "mintz" ? { backgroundColor: theme.primary, color: theme.secondary } : { backgroundColor: "#f1f5f9", color: "#475569" }}>Mintz</button><button type="button" onClick={() => setTab("tagged")} className="rounded-2xl px-4 py-2 text-sm font-bold" style={tab === "tagged" ? { backgroundColor: theme.primary, color: theme.secondary } : { backgroundColor: "#f1f5f9", color: "#475569" }}>Tagged</button></div>
      {!canViewAccountContent ? <div className="py-8 text-center"><p className="font-black text-slate-900">This account is private.</p><p className="mt-2 text-sm text-slate-500">Follow this person or become friends to view eligible Mintz.</p></div> : visibleMintz.length > 0 ? <div className="space-y-5">{visibleMintz.map((item) => {
        const author = users.find((user) => user.account.id === item.authorId);
        if (!author) return null;
        const permissionContext = createMintPermissionContext(item, author, feedState);
        const organization = getOrganizationById(item.organizationId);
        return <MintCard key={item.id} mint={item} author={author} viewer={viewer} users={users} theme={theme} currentTime={mintz.currentTime} permissionContext={permissionContext} liked={mintz.likes.some((like) => like.mintId === item.id && like.userId === viewer.account.id)} saved={mintz.saves.some((save) => save.mintId === item.id && save.userId === viewer.account.id)} reposted={mintz.reposts.some((repost) => repost.mintId === item.id && repost.userId === viewer.account.id)} comments={mintz.comments.filter((comment) => comment.targetId === item.id)} organizationMembershipStatus={organization ? organizations.getMembershipStatus(organization.id) : undefined} onOpenProfile={onOpenProfile} onToggleLike={() => mintz.toggleLike(permissionContext)} onToggleSave={() => mintz.toggleSave(permissionContext)} onToggleRepost={() => mintz.toggleRepost(permissionContext)} onShare={(channel) => mintz.recordShare(permissionContext, channel)} onComment={(body) => mintz.addComment(permissionContext, body)} onDeleteComment={(commentId) => mintz.deleteOwnComment(commentId, viewer.account.id)} onReportComment={(commentId) => mintz.reportComment(permissionContext, commentId)} onUpdate={(patch) => mintz.updateOwnMint(item.id, viewer.account.id, patch)} onArchive={() => mintz.toggleArchive(item.id, viewer.account.id)} onDelete={() => mintz.deleteOwnMint(item.id, viewer.account.id)} onReport={(reason) => mintz.reportMint(permissionContext, reason, null)} />;
      })}</div> : <p className="py-8 text-center text-sm text-slate-500">No active {tab === "mintz" ? "Mintz" : "tagged Mintz"} are visible.</p>}
    </div>
  );
}
