import { getOrganizationById } from "@/data/organizations";
import type { UniversityTheme } from "@/data/universities";
import type { OrganizationsState } from "@/hooks/useOrganizations";

export function GroupsSkeleton({ currentUserId, theme, organizations }: { currentUserId: string; theme: UniversityTheme; organizations: OrganizationsState }) {
  const accessibleGroups = organizations.conversations.filter((conversation) => conversation.kind === "organization_group" && organizations.isConversationParticipant(conversation.id, currentUserId));
  return (
    <div className="space-y-5"><div className="px-1"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Approved spaces</p><h1 className="mt-1 text-3xl font-black text-slate-950">Groups</h1><p className="mt-2 text-sm text-slate-600">Club, class, project, residence, and friend groups will live here. Access comes from invitations, approval, or permitted codes.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">{accessibleGroups.map((conversation) => { const organization = getOrganizationById(conversation.organizationId); return <article key={conversation.id} className="rounded-[1.5rem] border border-white/80 bg-white/90 p-5 shadow-sm"><span className="flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-black" style={{ backgroundColor: theme.accent, color: theme.primary }}>◎</span><p className="mt-4 text-[10px] font-black uppercase tracking-wider text-orange-700">Official club group</p><h2 className="mt-1 font-black text-slate-950">{organization?.name ?? "Organization group"}</h2><p className="mt-2 text-sm text-slate-500">Access is active because the current membership record is accepted.</p></article>; })}</div>
      {accessibleGroups.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center"><h2 className="font-black text-slate-900">No groups yet</h2><p className="mt-2 text-sm text-slate-500">Approved group conversations will appear here automatically.</p></div>}
      <section className="rounded-3xl bg-slate-950 p-6 text-white"><h2 className="font-black">Private by design</h2><p className="mt-2 text-sm leading-6 text-slate-400">Pending club applicants cannot read the official club chat. They can only contact the approved leader or membership contact through the existing contact flow.</p></section>
    </div>
  );
}

