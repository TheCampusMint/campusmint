"use client";

import { useState } from "react";
import Link from "next/link";

import { ClubChatPlaceholder } from "@/components/clubs/ClubChatPlaceholder";
import { OrganizationMembershipPanel } from "@/components/clubs/OrganizationMembershipPanel";
import { MintLeafBackButton } from "@/components/ui/MintLeafBackButton";
import { getCampusNetwork } from "@/data/campusNetworks";
import { universities, type UniversityTheme } from "@/data/universities";
import { getClubHref } from "@/data/organizations";
import type { Event } from "@/types/event";
import type {
  Organization,
  OrganizationAnnouncement,
  OrganizationMembershipStatus,
  OrganizationMembership,
  OrganizationOfficer,
} from "@/types/organization";
import type { CampusMintUser } from "@/types/profile";
import type { ProfilesState } from "@/hooks/useProfiles";
import type { Story } from "@/types/story";

type OrganizationDetailModalProps = {
  organization: Organization;
  events: Event[];
  stories: Story[];
  announcements: OrganizationAnnouncement[];
  officers: OrganizationOfficer[];
  membershipStatus: OrganizationMembershipStatus;
  membershipAllowed: boolean;
  theme: UniversityTheme;
  onClose: () => void;
  closeLabel?: string;
  onMembershipAction: (organization: Organization) => void;
  onViewEvents: () => void;
  viewer: CampusMintUser;
  profiles: ProfilesState;
  pendingRequests: OrganizationMembership[];
  canModerateRequests: boolean;
  canAccessChat: boolean;
  isChatParticipant: boolean;
  memberCount: number;
  isFollowing: boolean;
  onToggleFollow: () => void;
  onAcceptRequest: (userId: string) => void;
  onRejectRequest: (userId: string) => void;
  onMessageOrganization: () => boolean;
  onOpenProfile?: (userId: string) => void;
};

function membershipLabel(organization: Organization, status: OrganizationMembershipStatus, allowed: boolean) {
  if (!allowed) return "View only";
  if (status === "member") return "Leave Club";
  if (status === "officer") return "Officer";
  if (status === "leader") return "Leader";
  if (status === "requested") return "Cancel Request";
  if (status === "blocked") return "Membership unavailable";
  if (organization.membershipType === "open") return "Join Club";
  if (organization.membershipType === "application") return "Request to Join";
  if (organization.membershipType === "invitation") return "Invitation only";
  return "Restricted";
}

export function OrganizationDetailModal({
  organization,
  events,
  stories,
  announcements,
  officers,
  membershipStatus,
  membershipAllowed,
  theme,
  onClose,
  closeLabel = "Close",
  onMembershipAction,
  onViewEvents,
  viewer,
  profiles,
  pendingRequests,
  canModerateRequests,
  canAccessChat,
  isChatParticipant,
  memberCount,
  isFollowing,
  onToggleFollow,
  onAcceptRequest,
  onRejectRequest,
  onMessageOrganization,
  onOpenProfile,
}: OrganizationDetailModalProps) {
  const [messageFeedback, setMessageFeedback] = useState<string | null>(null);
  const campusNetwork = organization.campusNetworkId ? getCampusNetwork(organization.campusNetworkId) : null;
  const membershipDisabled = !membershipAllowed || (membershipStatus === "none"
    && (organization.membershipType === "invitation" || organization.membershipType === "restricted"));
  const initials = organization.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="organization-detail-title" className="mx-auto my-2 max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="relative overflow-hidden p-6 sm:p-8" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary}dd)`, color: theme.secondary }}>
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[32px] opacity-10" style={{ borderColor: theme.secondary }} />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-xl font-extrabold shadow-lg sm:h-20 sm:w-20" style={{ color: theme.primary }}>{initials}</div>
              <div>
                <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide"><span className="rounded-full bg-white/15 px-3 py-1">{organization.category}</span><span className="rounded-full bg-white/15 px-3 py-1">Development record</span></div>
                <h2 id="organization-detail-title" className="mt-3 max-w-3xl text-2xl font-extrabold leading-tight sm:text-4xl">{organization.name}</h2>
                <p className="mt-2 text-sm opacity-85">{universities[organization.universityId].name}</p>
                <Link href={getClubHref(organization)} className="mt-2 inline-flex text-xs font-bold underline decoration-white/40 underline-offset-4">/clubs/{organization.handle}</Link>
              </div>
            </div>
            {closeLabel === "Close" ? (
              <button type="button" onClick={onClose} aria-label="Close" title="Close" className="cm-icon-control relative flex items-center justify-center border border-white/30 bg-white/10 text-xl text-white">×</button>
            ) : (
              <MintLeafBackButton onClick={onClose} label={closeLabel} tone="inverse" className="relative" />
            )}
          </div>
        </header>

        <div className="grid lg:grid-cols-[1fr_340px]">
          <div className="space-y-7 border-b border-slate-200 p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <section>
              <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: theme.primary }}>About</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{organization.fullDescription}</p>
              <dl className="mt-5 grid gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2">
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Meeting location</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{organization.meetingLocation}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Meeting schedule</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{organization.meetingSchedule}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Membership</dt><dd className="mt-1 text-sm font-semibold capitalize text-slate-800">{organization.membershipType}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Campus Network</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{campusNetwork?.name ?? "Not assigned"}{organization.crossCampus ? " · Cross-campus invitation enabled" : ""}</dd></div>
              </dl>
            </section>

            <section>
              <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: theme.primary }}>Upcoming events</p><h3 className="mt-1 text-xl font-bold text-slate-950">Organization calendar</h3></div><button type="button" onClick={onViewEvents} className="text-sm font-bold" style={{ color: theme.primary }}>View Events</button></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">{events.length ? events.map((event) => <article key={event.id} className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{event.date}</p><h4 className="mt-2 font-bold text-slate-900">{event.title}</h4><p className="mt-1 text-xs leading-5 text-slate-500">{event.time} · {event.location}</p></article>) : <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 sm:col-span-2">No associated Event records are available yet.</p>}</div>
            </section>

            <section>
              <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: theme.primary }}>Announcements</p>
              <div className="mt-4 space-y-3">{announcements.length ? announcements.map((announcement) => <article key={announcement.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-slate-900">{announcement.title}</h3><span className="text-xs text-slate-400">{announcement.authorRole} · dev</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{announcement.body}</p></article>) : <p className="text-sm text-slate-500">No announcements are available.</p>}</div>
            </section>

            <section>
              <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: theme.primary }}>Officers</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">{officers.length ? officers.map((officer) => <button key={officer.id} type="button" disabled={!officer.userId || !onOpenProfile} onClick={() => officer.userId && onOpenProfile?.(officer.userId)} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-left disabled:cursor-default"><div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: theme.accent, color: theme.primary }}>DO</div><div><p className="font-bold text-slate-900">{officer.displayName}</p><p className="text-xs text-slate-500">{officer.role === "Other" ? officer.customRole ?? "Other" : officer.role} · development placeholder</p></div></button>) : <p className="text-sm text-slate-500 sm:col-span-2">No officer records are available.</p>}</div>
            </section>

            <section>
              <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: theme.primary }}>Photos</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-semibold text-slate-500">Club photo placeholder</div><div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-semibold text-slate-500">Event photo placeholder</div><div className="hidden aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-semibold text-slate-500 sm:flex">Member activity placeholder</div></div>
            </section>

            <section>
              <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: theme.primary }}>Club Stories</p>
              <div className="mt-4 space-y-3">{stories.length ? stories.map((story) => <article key={story.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>{story.authorName} · {story.category}</span><time dateTime={story.createdAt}>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(story.createdAt))}</time></div><p className="mt-2 text-sm leading-6 text-slate-600">{story.text}</p></article>) : <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">No Stories reference this organization yet.</p>}</div>
            </section>
          </div>

          <aside className="space-y-5 p-5 sm:p-7">
            <div className="grid gap-3">
              <button type="button" disabled={membershipDisabled || membershipStatus === "officer" || membershipStatus === "leader" || membershipStatus === "blocked"} onClick={() => onMembershipAction(organization)} className="rounded-xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500" style={!membershipDisabled && membershipStatus !== "officer" && membershipStatus !== "leader" && membershipStatus !== "blocked" ? { backgroundColor: theme.primary, color: theme.secondary } : undefined}>{membershipLabel(organization, membershipStatus, membershipAllowed)}</button>
              <button type="button" onClick={onToggleFollow} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">{isFollowing ? "Following Club" : "Follow Club"}</button>
              <button type="button" onClick={() => setMessageFeedback(onMessageOrganization() ? "A limited direct conversation with the club's membership contact is ready locally. It is separate from the member group chat." : "No separate membership contact is available for this local record.")} className="rounded-xl border px-4 py-3 text-sm font-bold" style={{ borderColor: theme.primary, color: theme.primary }}>Message Club</button>
              <button type="button" onClick={onViewEvents} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">View Events</button>
            </div>
            {messageFeedback && <p aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{messageFeedback}</p>}

            <section className="rounded-2xl border border-slate-200 p-5"><h3 className="font-bold text-slate-900">Membership</h3><p className="mt-2 text-sm leading-6 text-slate-600">Current status: <span className="font-bold capitalize text-slate-900">{membershipStatus}</span></p><p className="mt-2 text-xs leading-5 text-slate-500">{memberCount > 0 ? `${memberCount} members in local state` : "No accepted members in local state."}</p></section>

            <ClubChatPlaceholder theme={theme} canAccess={canAccessChat} participantAdded={isChatParticipant} />

            {canModerateRequests && <OrganizationMembershipPanel requests={pendingRequests} viewer={viewer} users={profiles.users.map((user) => user.account.id === viewer.account.id ? viewer : user)} theme={theme} getFriendshipStatus={profiles.getFriendshipStatus} onAccept={onAcceptRequest} onReject={onRejectRequest} />}

            <section className="rounded-2xl border border-slate-200 p-5"><h3 className="font-bold text-slate-900">Contact information</h3><dl className="mt-3 space-y-3 text-sm"><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Email</dt><dd className="mt-1 break-all font-semibold text-slate-700">{organization.contactEmail}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Website</dt><dd className="mt-1 text-slate-600">{organization.website ?? "Not configured"}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Instagram</dt><dd className="mt-1 text-slate-600">{organization.instagram ?? "Not configured"}</dd></div></dl><p className="mt-3 text-xs leading-5 text-amber-700">Development contact information only.</p></section>
          </aside>
        </div>
      </div>
    </div>
  );
}
