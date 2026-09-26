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
import {
  getCreatorAppreciationMetrics,
  getPublicEndorsementContext,
} from "@/lib/social/mintInteractions";
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
  const usersById = new Map([...profiles.users, ...mintz.persistedAuthors].map((user) => [user.account.id, user]));
  usersById.set(viewer.account.id, viewer);
  const users = [...usersById.values()];
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
      <div className="flex gap-2 px-1"><button type="button" onClick={() => setTab("mintz")} className="rounded-2xl px-4 py-2 text-sm font-bold" style={tab === "mintz" ? { backgroundColor: theme.primary, color: theme.secondary } : { backgroundColor: "var(--app-surface-elevated)", color: "var(--app-text-secondary)" }}>Mintz</button><button type="button" onClick={() => setTab("tagged")} className="rounded-2xl px-4 py-2 text-sm font-bold" style={tab === "tagged" ? { backgroundColor: theme.primary, color: theme.secondary } : { backgroundColor: "var(--app-surface-elevated)", color: "var(--app-text-secondary)" }}>Tagged</button></div>
      {!canViewAccountContent ? <div className="py-8 text-center"><p className="font-black text-slate-900">This account is private.</p><p className="mt-2 text-sm text-slate-500">Follow this person or become friends to view eligible Mintz.</p></div> : visibleMintz.length > 0 ? <div className="space-y-5">{visibleMintz.map((item) => {
        const author = users.find((user) => user.account.id === item.authorId);
        if (!author) return null;
        const permissionContext = createMintPermissionContext(item, author, feedState);
        const organization = getOrganizationById(item.organizationId);
        const endorsementContext = getPublicEndorsementContext({
          mintId: item.id,
          viewerId: viewer.account.id,
          endorsements: mintz.publicEndorsements,
          friendships: profiles.friendships,
          follows: profiles.follows,
          blocks: profiles.blocks,
          eligibleUserIds: users.map((user) => user.account.id),
        });
        const creatorMetrics = getCreatorAppreciationMetrics({
          mintId: item.id,
          authorId: item.authorId,
          viewerId: viewer.account.id,
          privateAppreciations: mintz.privateAppreciations,
          publicEndorsements: mintz.publicEndorsements,
          legacyAggregate: item.likeCount,
          viewCount: item.viewCount,
          commentCount: item.commentCount,
        });
        return <MintCard key={item.id} mint={item} author={author} viewer={viewer} users={users} theme={theme} currentTime={mintz.currentTime} permissionContext={permissionContext} privateAppreciated={mintz.privateAppreciations.some((appreciation) => appreciation.mintId === item.id && appreciation.userId === viewer.account.id)} publiclyEndorsed={mintz.publicEndorsements.some((endorsement) => endorsement.mintId === item.id && endorsement.userId === viewer.account.id)} friendEndorsementUsers={endorsementContext.userIds.flatMap((userId) => { const user = users.find((candidate) => candidate.account.id === userId); return user ? [user] : []; })} additionalFriendEndorsementCount={endorsementContext.additionalCount} creatorAppreciationCount={creatorMetrics?.appreciationCount ?? null} pinned={mintz.pins.some((pin) => pin.mintId === item.id && pin.userId === viewer.account.id)} comments={mintz.comments.filter((comment) => comment.targetId === item.id)} blockedCommentAuthorIds={profiles.blocks.flatMap((block) => block.blockerId === viewer.account.id ? [block.blockedId] : block.blockedId === viewer.account.id ? [block.blockerId] : [])} organizationMembershipStatus={organization ? organizations.getMembershipStatus(organization.id) : undefined} onOpenProfile={onOpenProfile} onPrivateAppreciation={() => mintz.registerPrivateAppreciation(permissionContext)} onTogglePublicEndorsement={() => mintz.togglePublicEndorsement(permissionContext)} onTogglePin={() => mintz.togglePin(permissionContext)} onShare={(channel) => mintz.recordShare(permissionContext, channel)} onComment={(body) => mintz.addComment(permissionContext, body)} onDeleteComment={(commentId) => mintz.deleteOwnComment(commentId, viewer.account.id)} onReportComment={(commentId) => mintz.reportComment(permissionContext, commentId)} onUpdate={(patch) => mintz.updateOwnMint(item.id, viewer.account.id, patch)} onArchive={() => mintz.toggleArchive(item.id, viewer.account.id)} onDelete={() => mintz.deleteOwnMint(item.id, viewer.account.id)} onReport={(reason) => mintz.reportMint(permissionContext, reason, null)} />;
      })}</div> : <p className="py-8 text-center text-sm text-slate-500">No active {tab === "mintz" ? "Mintz" : "tagged Mintz"} are visible.</p>}
    </div>
  );
}
