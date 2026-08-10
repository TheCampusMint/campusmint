import { universities, type UniversityTheme } from "@/data/universities";
import type { Event } from "@/types/event";
import type { Organization, OrganizationMembershipStatus } from "@/types/organization";

type OrganizationCardProps = {
  organization: Organization;
  nextEvent?: Event;
  membershipStatus: OrganizationMembershipStatus;
  membershipAllowed: boolean;
  theme: UniversityTheme;
  onView: (organizationId: string) => void;
  onMembershipAction: (organization: Organization) => void;
};

function officialStatusLabel(organization: Organization) {
  if (organization.officialStatus === "university_verified") return "University verified";
  if (organization.officialStatus === "community_verified") return "Community verified";
  return "Pending review";
}

function membershipButtonLabel(organization: Organization, status: OrganizationMembershipStatus, allowed: boolean) {
  if (!allowed) return "View only";
  if (status === "member" || status === "officer") return "Leave Club";
  if (status === "requested") return "Cancel Request";
  if (organization.membershipType === "open") return "Join Club";
  if (organization.membershipType === "application") return "Request to Join";
  if (organization.membershipType === "invitation") return "Invitation only";
  return "Restricted";
}

export function OrganizationCard({
  organization,
  nextEvent,
  membershipStatus,
  membershipAllowed,
  theme,
  onView,
  onMembershipAction,
}: OrganizationCardProps) {
  const membershipDisabled = !membershipAllowed || (membershipStatus === "none"
    && (organization.membershipType === "invitation" || organization.membershipType === "restricted"));
  const initials = organization.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="h-2" style={{ backgroundColor: theme.primary }} />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-base font-extrabold" style={{ backgroundColor: theme.accent, color: theme.primary }}>{initials}</div>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">{organization.category}</span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">{officialStatusLabel(organization)} · dev</span>
            </div>
            <h3 className="mt-3 text-lg font-extrabold leading-6 text-slate-950">{organization.name}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">{universities[organization.universityId].name}</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">{organization.shortDescription}</p>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Next meeting or event</p>
          {nextEvent ? <><p className="mt-2 font-bold text-slate-900">{nextEvent.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{nextEvent.date} · {nextEvent.time}</p></> : <p className="mt-2 text-slate-500">No dated event is available yet.</p>}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
          <button type="button" onClick={() => onView(organization.id)} className="rounded-xl border px-3 py-2.5 text-sm font-bold" style={{ borderColor: theme.primary, color: theme.primary }}>View Club</button>
          <button type="button" disabled={membershipDisabled} onClick={() => onMembershipAction(organization)} className="rounded-xl px-3 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500" style={!membershipDisabled ? { backgroundColor: theme.primary, color: theme.secondary } : undefined}>{membershipButtonLabel(organization, membershipStatus, membershipAllowed)}</button>
        </div>
      </div>
    </article>
  );
}
