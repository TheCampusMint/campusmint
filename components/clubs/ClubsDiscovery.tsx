import { developmentOrganizations } from "@/data/organizations";
import type {
  UniversityId,
  UniversityTheme,
} from "@/data/universities";
import { universities } from "@/data/universities";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import { canJoinOrganization } from "@/lib/organizationPermissions";
import type { Organization } from "@/types/organization";
import type { TemporaryUser } from "@/types/user";

type ClubsDiscoveryProps = {
  user: TemporaryUser;
  configuredUniversityId: UniversityId | null;
  theme: UniversityTheme;
  organizations: OrganizationsState;
  onMembershipAction: (organization: Organization) => void;
};

function membershipLabel(status: ReturnType<OrganizationsState["getMembershipStatus"]>) {
  if (status === "member" || status === "officer" || status === "leader") return "Your Club";
  if (status === "requested") return "Request Pending";
  return "Join Club";
}

export function ClubsDiscovery({
  user,
  configuredUniversityId,
  theme,
  organizations,
  onMembershipAction,
}: ClubsDiscoveryProps) {
  const visible = configuredUniversityId
    ? developmentOrganizations.filter(
        (organization) =>
          theme.accessibleCampuses.includes(
            organization.universityId,
          ),
      )
    : [];

  const configuredUser =
    configuredUniversityId
      ? {
          ...user,
          universityId: configuredUniversityId,
        }
      : null;
  return (
    <div className="space-y-5">
      <div className="px-1"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Find your people</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Clubs</h1><p className="mt-2 text-sm text-slate-600">Organization identity, membership requests, and official group access still use the existing club system.</p></div>
      {!configuredUniversityId && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center">
          <h2 className="font-black text-slate-900">
            Clubs are not configured yet
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Campus-specific clubs for {theme.shortName} will
            appear once university metadata is configured.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map((organization) => {
        const status = organizations.getMembershipStatus(organization.id);
        const actionable =
          Boolean(configuredUser) &&
          canJoinOrganization(
            configuredUser!,
            organization,
          ) &&
          ![
            "member",
            "officer",
            "leader",
            "requested",
            "blocked",
          ].includes(status);
        return <article key={organization.id} className="flex min-h-64 flex-col rounded-[1.5rem] border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black" style={{ backgroundColor: theme.accent, color: theme.primary }}>{organization.logo?.alt.slice(0, 2).toUpperCase() ?? organization.name.slice(0, 2).toUpperCase()}</span><span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-orange-800">{organization.category}</span></div>
          <h2 className="mt-4 text-lg font-black leading-tight text-slate-950">{organization.name}</h2>
          <p className="mt-1 text-xs font-bold" style={{ color: theme.primary }}>{universities[organization.universityId].shortName}</p>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{organization.shortDescription}</p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-5"><a href={`/clubs/${organization.handle}`} className="text-xs font-black text-slate-500 hover:underline">View club</a><button type="button" disabled={!actionable} onClick={() => onMembershipAction(organization)} className="rounded-full px-3 py-2 text-xs font-black disabled:cursor-default" style={status === "member" || status === "officer" || status === "leader" ? { backgroundColor: "#ffedd5", color: "#9a3412" } : { backgroundColor: theme.primary, color: theme.secondary, opacity: status === "requested" ? 0.72 : 1 }}>{membershipLabel(status)}</button></div>
        </article>;
      })}</div>
    </div>
  );
}

