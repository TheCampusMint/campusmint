import { MintCard } from "@/components/mintz/MintCard";
import { getOrganizationById } from "@/data/organizations";
import type { UniversityTheme } from "@/data/universities";
import type { MintzState } from "@/hooks/useMintz";
import type { ProfilesState } from "@/hooks/useProfiles";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import { createMintPermissionContext, type MintFeedState } from "@/lib/social/mintFeeds";
import type { Mint } from "@/types/mint";
import type { CampusMintUser } from "@/types/profile";
import { canJoinOrganization } from "@/lib/organizationPermissions";

type MintFeedListProps = {
  mints: Mint[];
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  mintz: MintzState;
  organizations: OrganizationsState;
  feedState: MintFeedState;
  onOpenProfile: (userId: string) => void;
  onRequestOrganization: (organizationId: string) => void;
  onNotice: (message: string) => void;
};

export function MintFeedList({ mints, viewer, theme, profiles, mintz, organizations, feedState, onOpenProfile, onRequestOrganization, onNotice }: MintFeedListProps) {
  return <div className="space-y-5">{mints.length > 0 ? mints.map((item) => {
    const author = feedState.users.find((user) => user.account.id === item.authorId);
    if (!author) return null;
    const permissionContext = createMintPermissionContext(item, author, feedState);
    const organization = getOrganizationById(item.organizationId);
    const organizationStatus = organization ? organizations.getMembershipStatus(organization.id) : undefined;
    const organizationAction = organization
      && canJoinOrganization({ role: viewer.account.role, universityId: viewer.account.universityId }, organization)
      && (organizationStatus === "none" || organizationStatus === "rejected")
      ? () => onRequestOrganization(organization.id)
      : undefined;
    return <MintCard
      key={item.id}
      mint={item}
      author={author}
      viewer={viewer}
      users={profiles.users.map((user) => user.account.id === viewer.account.id ? viewer : user)}
      theme={theme}
      currentTime={mintz.currentTime}
      permissionContext={permissionContext}
      liked={mintz.likes.some((like) => like.mintId === item.id && like.userId === viewer.account.id)}
      saved={mintz.saves.some((save) => save.mintId === item.id && save.userId === viewer.account.id)}
      comments={mintz.comments.filter((comment) => comment.targetId === item.id)}
      organizationMembershipStatus={organizationStatus}
      onOrganizationMembershipAction={organizationAction}
      onOpenProfile={onOpenProfile}
      onToggleLike={() => mintz.toggleLike(permissionContext)}
      onToggleSave={() => mintz.toggleSave(permissionContext)}
      onShare={(channel) => { mintz.recordShare(permissionContext, channel); onNotice("Share action recorded locally. No external message was sent."); }}
      onComment={(body) => mintz.addComment(permissionContext, body)}
      onDeleteComment={(commentId) => mintz.deleteOwnComment(commentId, viewer.account.id)}
      onReportComment={(commentId) => { mintz.reportComment(permissionContext, commentId); onNotice("Comment report saved locally for development testing."); }}
      onUpdate={(patch) => mintz.updateOwnMint(item.id, viewer.account.id, patch)}
      onArchive={() => mintz.toggleArchive(item.id, viewer.account.id)}
      onDelete={() => mintz.deleteOwnMint(item.id, viewer.account.id)}
      onReport={(reason) => { mintz.reportMint(permissionContext, reason, null); onNotice("Report saved locally for development testing."); }}
    />;
  }) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h3 className="font-bold text-slate-900">No visible Mintz</h3><p className="mt-2 text-sm text-slate-500">This feed has no active content you are permitted to view.</p></div>}</div>;
}
