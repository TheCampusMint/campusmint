"use client";

import { useMemo, useState } from "react";

import { OrganizationCard } from "@/components/clubs/OrganizationCard";
import { OrganizationDetailModal } from "@/components/clubs/OrganizationDetailModal";
import { OrganizationSubmissionModal } from "@/components/clubs/OrganizationSubmissionModal";
import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import {
  developmentOrganizationAnnouncements,
  developmentOrganizationOfficers,
  developmentOrganizationRecruitment,
  getOrganizationById,
  getOrganizationsForUniversity,
} from "@/data/organizations";
import { getUserRoleLabel } from "@/data/userRoles";
import { universities, type UniversityTheme } from "@/data/universities";
import type { useOrganizations } from "@/hooks/useOrganizations";
import type { ProfilesState } from "@/hooks/useProfiles";
import { canAccessOrganizationChat, canJoinOrganization, canModerateOrganizationMemberships, canSubmitOrganization, canViewOrganization } from "@/lib/organizationPermissions";
import { organizationCategories, type Organization, type OrganizationCategory, type OrganizationMembershipStatus } from "@/types/organization";
import type { Event } from "@/types/event";
import type { Story } from "@/types/story";
import type { TemporaryUser } from "@/types/user";
import type { CampusMintUser } from "@/types/profile";

type ClubsHubProps = {
  user: TemporaryUser;
  theme: UniversityTheme;
  events: Event[];
  stories: Story[];
  organizations: ReturnType<typeof useOrganizations>;
  viewer: CampusMintUser;
  profiles: ProfilesState;
};

type ClubsView = "discover" | "my-clubs" | "events" | "recruitment";

const clubViews: Array<{ id: ClubsView; label: string }> = [
  { id: "discover", label: "Discover" },
  { id: "my-clubs", label: "My Clubs" },
  { id: "events", label: "Upcoming Events" },
  { id: "recruitment", label: "Recruitment" },
];

function membershipStatusLabel(status: OrganizationMembershipStatus) {
  if (status === "requested") return "Membership requested";
  if (status === "member") return "Member";
  if (status === "officer") return "Officer";
  if (status === "leader") return "Leader";
  if (status === "rejected") return "Request rejected";
  if (status === "blocked") return "Blocked";
  return "Not joined";
}

function membershipActionLabel(organization: Organization, status: OrganizationMembershipStatus) {
  if (status === "member") return "Leave Club";
  if (status === "officer") return "Officer";
  if (status === "leader") return "Leader";
  if (status === "requested") return "Request Pending";
  return organization.membershipType === "application" ? "Request to Join" : "Join Club";
}

export function ClubsHub({ user, viewer, profiles, theme, events, stories, organizations }: ClubsHubProps) {
  const [view, setView] = useState<ClubsView>("discover");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<OrganizationCategory | "All">("All");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const campusNetwork = getCampusNetworkForUniversity(user.universityId);
  const directory = getOrganizationsForUniversity(user.universityId).filter((organization) => canViewOrganization(user, organization));
  const directoryIds = new Set(directory.map((organization) => organization.id));

  const filteredDirectory = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return directory.filter((organization) => {
      const searchable = `${organization.name} ${organization.category} ${organization.shortDescription} ${organization.fullDescription} ${organization.keywords.join(" ")}`.toLowerCase();
      return (category === "All" || organization.category === category) && (!normalized || searchable.includes(normalized));
    });
  }, [category, directory, query]);

  const clubEvents = events.filter((event) => event.organizationId && directoryIds.has(event.organizationId));
  const joinedOrganizations = user.role === "student" ? directory.filter((organization) => {
    const status = organizations.getMembershipStatus(organization.id);
    return status === "member" || status === "officer" || status === "leader" || status === "requested";
  }) : [];
  const joinedCount = joinedOrganizations.filter((organization) => {
    const status = organizations.getMembershipStatus(organization.id);
    return status === "member" || status === "officer" || status === "leader";
  }).length;
  const requestedCount = joinedOrganizations.filter((organization) => organizations.getMembershipStatus(organization.id) === "requested").length;
  const recruitment = developmentOrganizationRecruitment.flatMap((item) => {
    const organization = getOrganizationById(item.organizationId);
    if (!organization || !canViewOrganization(user, organization)) return [];
    const belongsToUniversity = organization.universityId === user.universityId;
    const intentionalNearbyInvitation = organization.crossCampus && organization.campusNetworkId === campusNetwork?.id;
    return belongsToUniversity || intentionalNearbyInvitation ? [{ item, organization }] : [];
  });
  const selectedOrganization = getOrganizationById(selectedOrganizationId);

  function nextEventFor(organizationId: string) {
    return events.find((event) => event.organizationId === organizationId);
  }

  function handleMembership(organization: Organization) {
    if (!canJoinOrganization(user, organization)) {
      setFeedback("Only students can join, leave, or request membership right now.");
      return;
    }
    const status = organizations.getMembershipStatus(organization.id);
    if (status !== "none") {
      if (status === "officer" || status === "leader" || status === "blocked") {
        setFeedback("Organization-managed roles cannot be changed from this local member control.");
        return;
      }
      organizations.leaveOrganization(organization);
      setFeedback(status === "requested" ? "Membership request cancelled." : "You left the club for this local session.");
      return;
    }
    const membership = organizations.joinOrRequest(organization);
    if (!membership) {
      setFeedback("This organization does not accept direct membership requests.");
      return;
    }
    setFeedback("Membership request saved locally. Club chat remains locked until an officer or leader accepts it.");
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl p-6 shadow-sm sm:p-8" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary}e5)`, color: theme.secondary }}>
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border-[38px] opacity-10" style={{ borderColor: theme.secondary }} />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] opacity-75">{universities[user.universityId].name}</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Clubs &amp; Organizations</h2><p className="mt-3 max-w-2xl text-sm leading-6 opacity-85">Discover organizations tied to your actual university, participate locally, and follow the same club across Events and Stories.</p></div>
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm"><p className="text-xs font-bold uppercase tracking-wide opacity-70">Your role</p><p className="mt-1 font-bold">{getUserRoleLabel(user.role)}</p><p className="mt-1 text-xs opacity-75">{user.role === "student" ? "Discovery and local membership enabled" : "Public organization viewing only"}</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Clubs views">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist">{clubViews.map((item) => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => setView(item.id)} className="rounded-xl px-3 py-3 text-sm font-bold" style={view === item.id ? { backgroundColor: theme.primary, color: theme.secondary } : { color: "#475569" }}>{item.label}</button>)}</div>
      </section>

      {feedback && <p aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{feedback}</p>}

      {view === "discover" && <>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-bold" style={{ color: theme.primary }}>University directory</p><h3 className="mt-1 text-2xl font-extrabold text-slate-950">Discover your campus community</h3><p className="mt-2 text-sm text-slate-500">All records shown in v1 are clearly marked development examples.</p></div><p className="text-sm font-semibold text-slate-500">{directory.length} development {directory.length === 1 ? "record" : "records"}</p></div>
          <label htmlFor="club-search" className="sr-only">Search clubs by name, category, or keyword</label>
          <input id="club-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search club name, category, or keyword…" className="mt-5 block w-full rounded-2xl border border-slate-200 px-5 py-4 text-sm outline-none focus:border-current" style={{ color: theme.primary }} />
          <div className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Categories</p><div className="mt-3 flex gap-2 overflow-x-auto pb-2" aria-label="Filter clubs by category"><button type="button" aria-pressed={category === "All"} onClick={() => setCategory("All")} className="shrink-0 rounded-full border px-4 py-2 text-sm font-bold" style={category === "All" ? { backgroundColor: theme.primary, borderColor: theme.primary, color: theme.secondary } : { borderColor: "#cbd5e1", color: "#475569" }}>All</button>{organizationCategories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className="shrink-0 rounded-full border px-4 py-2 text-sm font-bold" style={category === item ? { backgroundColor: theme.primary, borderColor: theme.primary, color: theme.secondary } : { borderColor: "#cbd5e1", color: "#475569" }}>{item}</button>)}</div></div>
        </section>

        {filteredDirectory.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filteredDirectory.map((organization) => <OrganizationCard key={organization.id} organization={organization} nextEvent={nextEventFor(organization.id)} membershipStatus={organizations.getMembershipStatus(organization.id)} membershipAllowed={canJoinOrganization(user, organization)} theme={theme} onView={setSelectedOrganizationId} onMembershipAction={handleMembership} />)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><h3 className="text-lg font-bold text-slate-900">No organizations match</h3><p className="mt-2 text-sm text-slate-500">Try another category or search term.</p></div>}
      </>}

      {view === "my-clubs" && <section className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold" style={{ color: theme.primary }}>My Clubs</p><h3 className="mt-1 text-2xl font-extrabold text-slate-950">{joinedCount} joined{requestedCount ? ` · ${requestedCount} requested` : ""}</h3></div><button type="button" onClick={() => setView("discover")} className="rounded-xl px-4 py-2.5 text-sm font-bold" style={{ backgroundColor: theme.primary, color: theme.secondary }}>Discover Clubs</button></div>{joinedOrganizations.length ? <div className="grid gap-4 lg:grid-cols-2">{joinedOrganizations.map((organization) => { const event = nextEventFor(organization.id); const announcement = developmentOrganizationAnnouncements.find((item) => item.organizationId === organization.id); const status = organizations.getMembershipStatus(organization.id); return <article key={organization.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-lg font-extrabold text-slate-950">{organization.name}</h4><p className="mt-1 text-xs font-bold uppercase tracking-wide" style={{ color: theme.primary }}>{membershipStatusLabel(status)}</p></div><button type="button" onClick={() => setSelectedOrganizationId(organization.id)} className="rounded-xl border px-3 py-2 text-sm font-bold" style={{ borderColor: theme.primary, color: theme.primary }}>Open</button></div><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Next event</dt><dd className="mt-1 text-sm font-semibold text-slate-700">{event?.title ?? "No dated event available"}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Newest announcement</dt><dd className="mt-1 text-sm font-semibold text-slate-700">{announcement?.title ?? "No announcement available"}</dd></div></dl></article>; })}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><h3 className="text-xl font-bold text-slate-900">No clubs joined yet</h3><p className="mt-2 text-sm text-slate-500">Open organizations can be joined immediately; application clubs create a local request.</p></div>}</section>}

      {view === "events" && <section className="space-y-5"><div><p className="text-sm font-bold" style={{ color: theme.primary }}>Upcoming Club Events</p><h3 className="mt-1 text-2xl font-extrabold text-slate-950">Events hosted by your university&apos;s organizations</h3><p className="mt-2 text-sm text-slate-500">These are the same Event records used by the Campus Mint Events page.</p></div>{clubEvents.length ? <div className="grid gap-4 lg:grid-cols-2">{clubEvents.map((event) => { const organization = getOrganizationById(event.organizationId); if (!organization) return null; return <article key={event.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{event.category}</span>{event.crossCampus && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Cross-campus invitation</span>}</div><h4 className="mt-4 text-xl font-extrabold text-slate-950">{event.title}</h4><p className="mt-2 text-sm font-semibold" style={{ color: theme.primary }}>Hosted by {organization.name}</p><p className="mt-3 text-sm text-slate-600">{event.date} · {event.time}</p><p className="mt-1 text-sm text-slate-500">{event.location}</p><button type="button" onClick={() => setSelectedOrganizationId(organization.id)} className="mt-4 rounded-xl border px-4 py-2.5 text-sm font-bold" style={{ borderColor: theme.primary, color: theme.primary }}>View Club</button></article>; })}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No organization-linked Event records are available for this university.</div>}</section>}

      {view === "recruitment" && <section className="space-y-5"><div><p className="text-sm font-bold" style={{ color: theme.primary }}>Recruitment</p><h3 className="mt-1 text-2xl font-extrabold text-slate-950">Ways to get involved</h3><p className="mt-2 text-sm text-slate-500">Development examples only. Nearby records appear only when an organization explicitly enables a cross-campus invitation.</p></div>{recruitment.length ? <div className="grid gap-4 lg:grid-cols-2">{recruitment.map(({ item, organization }) => { const status = organizations.getMembershipStatus(organization.id); const actionAllowed = canJoinOrganization(user, organization) && organization.membershipType !== "invitation" && organization.membershipType !== "restricted"; return <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: theme.accent, color: theme.primary }}>{item.type}</span><span className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Development example</span></div><h4 className="mt-4 text-xl font-extrabold text-slate-950">{item.title}</h4><p className="mt-1 text-sm font-semibold text-slate-700">{organization.name}</p><p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p><p className="mt-3 text-xs text-slate-500">{universities[organization.universityId].name}{organization.universityId !== user.universityId ? " · Intentional nearby invitation" : ""}</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setSelectedOrganizationId(organization.id)} className="rounded-xl border px-3 py-2.5 text-sm font-bold" style={{ borderColor: theme.primary, color: theme.primary }}>View Club</button><button type="button" onClick={() => handleMembership(organization)} disabled={!actionAllowed} className="rounded-xl px-3 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500" style={actionAllowed ? { backgroundColor: theme.primary, color: theme.secondary } : undefined}>{actionAllowed ? membershipActionLabel(organization, status) : "View only"}</button></div></article>; })}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No recruitment examples are available for this university.</div>}</section>}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6"><div><p className="text-sm font-bold" style={{ color: theme.primary }}>Can&apos;t find your organization?</p><h3 className="mt-1 text-xl font-extrabold text-slate-950">Submit it for review</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">A suggestion becomes a pending community submission, not an official organization.</p>{organizations.submissions.filter((submission) => submission.universityId === user.universityId).length > 0 && <p className="mt-2 text-xs font-bold text-amber-700">{organizations.submissions.filter((submission) => submission.universityId === user.universityId).length} pending local submission</p>}</div><button type="button" disabled={!canSubmitOrganization(user)} onClick={() => setSubmissionOpen(true)} className="mt-4 rounded-xl px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 sm:mt-0" style={canSubmitOrganization(user) ? { backgroundColor: theme.primary, color: theme.secondary } : undefined}>{canSubmitOrganization(user) ? "Suggest Organization" : "Student submissions only"}</button></section>

      {selectedOrganization && <OrganizationDetailModal organization={selectedOrganization} events={events.filter((event) => event.organizationId === selectedOrganization.id)} stories={stories.filter((story) => story.organizationId === selectedOrganization.id)} announcements={developmentOrganizationAnnouncements.filter((announcement) => announcement.organizationId === selectedOrganization.id)} officers={developmentOrganizationOfficers.filter((officer) => officer.organizationId === selectedOrganization.id)} membershipStatus={organizations.getMembershipStatus(selectedOrganization.id)} membershipAllowed={canJoinOrganization(user, selectedOrganization)} theme={theme} onClose={() => setSelectedOrganizationId(null)} onMembershipAction={handleMembership} onViewEvents={() => { setSelectedOrganizationId(null); setView("events"); }} viewer={viewer} profiles={profiles} pendingRequests={organizations.getPendingRequests(selectedOrganization.id)} canModerateRequests={canModerateOrganizationMemberships({ id: viewer.account.id, universityId: viewer.account.universityId }, selectedOrganization, organizations.memberships, organizations.roles)} canAccessChat={canAccessOrganizationChat({ id: viewer.account.id, universityId: viewer.account.universityId }, selectedOrganization, organizations.memberships)} isChatParticipant={Boolean(selectedOrganization.organizationConversationId && organizations.isConversationParticipant(selectedOrganization.organizationConversationId))} memberCount={organizations.getMemberCount(selectedOrganization.id)} isFollowing={organizations.followedOrganizationIds.includes(selectedOrganization.id)} onToggleFollow={() => organizations.toggleFollowOrganization(selectedOrganization.id)} onAcceptRequest={(userId) => organizations.acceptMembership(selectedOrganization, userId)} onRejectRequest={(userId) => organizations.rejectMembership(selectedOrganization.id, userId)} onMessageOrganization={() => Boolean(organizations.messageOrganization(selectedOrganization).conversation)} />}
      {submissionOpen && <OrganizationSubmissionModal universityId={user.universityId} theme={theme} onClose={() => setSubmissionOpen(false)} onSubmit={(submission) => { const result = organizations.submitOrganization(submission); if (result.ok) { setSubmissionOpen(false); setFeedback("Organization suggestion saved locally as pending review."); } return result; }} />}
    </div>
  );
}
