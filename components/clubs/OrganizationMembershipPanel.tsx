import { universities, type UniversityTheme, getAccountUniversityName } from "@/data/universities";
import { canViewGraduationYear, canViewMajor, createProfileViewerContext } from "@/lib/social/permissions";
import type { OrganizationMembership } from "@/types/organization";
import type { CampusMintUser } from "@/types/profile";
import type { FriendshipStatus } from "@/types/social";

type OrganizationMembershipPanelProps = {
  requests: OrganizationMembership[];
  viewer: CampusMintUser;
  users: CampusMintUser[];
  theme: UniversityTheme;
  getFriendshipStatus: (userId: string) => FriendshipStatus;
  onAccept: (userId: string) => void;
  onReject: (userId: string) => void;
};

export function OrganizationMembershipPanel({ requests, viewer, users, theme, getFriendshipStatus, onAccept, onReject }: OrganizationMembershipPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 p-5">
      <h3 className="font-black text-slate-900">Pending Requests</h3>
      {requests.length === 0 ? <p className="mt-2 text-sm text-slate-500">No pending membership requests.</p> : <div className="mt-4 space-y-3">{requests.map((request) => {
        const applicant = users.find((user) => user.account.id === request.userId);
        if (!applicant) return null;
        const context = createProfileViewerContext(viewer, applicant, getFriendshipStatus(applicant.account.id));
        return <article key={request.id} className="rounded-xl bg-slate-50 p-4"><p className="font-bold text-slate-900">{applicant.profile.displayName}</p><p className="mt-1 text-xs text-slate-500">{getAccountUniversityName(applicant.account)}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">{canViewMajor(context) && applicant.profile.major && <span>{applicant.profile.major}</span>}{canViewGraduationYear(context) && applicant.profile.graduationYear && <span>Class of {applicant.profile.graduationYear}</span>}</div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => onAccept(applicant.account.id)} className="rounded-lg px-3 py-2 text-xs font-bold" style={{ backgroundColor: theme.primary, color: theme.secondary }}>Accept</button><button type="button" onClick={() => onReject(applicant.account.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Reject</button></div></article>;
      })}</div>}
    </section>
  );
}
