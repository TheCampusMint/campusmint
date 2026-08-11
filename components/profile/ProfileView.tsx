"use client";

import { useState } from "react";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { getAcademicCatalog } from "@/data/development/campusData";
import { getOrganizationById } from "@/data/organizations";
import { getUserRoleLabel } from "@/data/userRoles";
import type { UniversityTheme } from "@/data/universities";
import { universities } from "@/data/universities";
import {
  canViewBio,
  canViewClasses,
  canViewClubs,
  canViewGraduationYear,
  canViewHometown,
  canViewInstagram,
  canViewInterests,
  canViewLinkedIn,
  canViewMajor,
  canViewPersonalWebsite,
  canViewPortfolio,
  createProfileViewerContext,
} from "@/lib/social/permissions";
import type { MarketplaceListing } from "@/types/marketplace";
import type { CampusMintUser } from "@/types/profile";
import type { OrganizationMembershipStatus } from "@/types/organization";
import type { FriendshipStatus, UserReportReason } from "@/types/social";
import type { Story } from "@/types/story";

type ProfileViewProps = {
  viewer: CampusMintUser;
  owner: CampusMintUser;
  theme: UniversityTheme;
  friendshipStatus: FriendshipStatus;
  following: boolean;
  recentStories: Story[];
  marketplaceListings: MarketplaceListing[];
  onBack: () => void;
  onEdit: () => void;
  onEditPrivacy: () => void;
  onCycleFriendship: () => void;
  onToggleFollow: () => void;
  onBlock: () => void;
  onReport: (reason: UserReportReason, details: string | null) => void;
  clubInviteOptions: {
    id: string;
    name: string;
    status: OrganizationMembershipStatus;
  }[];
  incomingClubInvitations: {
    id: string;
    name: string;
  }[];
  onInviteToClub: (organizationId: string) => void;
  onAcceptClubInvitation: (organizationId: string) => void;
  onDeclineClubInvitation: (organizationId: string) => void;
  socialContent: React.ReactNode;
};

export function MintBackLeaf() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-6 w-6 overflow-visible"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transform: "rotate(-135deg)",
        transformOrigin: "center",
      }}
    >
      <path
        d="M25.8 5.5C17 5.8 8.6 9.9 7 18.1c-.8 4.3 2.6 7.7 6.8 6.4 7.8-2.4 10.7-10.6 12-19Z"
        strokeWidth="2.4"
      />
      <path
        d="M8.6 24.8c2.8-6.2 7.2-10.1 13.8-13.2"
        strokeWidth="2"
      />
      <path
        d="M13.4 18.7c1.9.1 3.7.5 5.2 1.2M16.7 14.5c.1-1.5-.1-2.8-.5-4"
        strokeWidth="1.45"
        opacity=".82"
      />
    </svg>
  );
}


const friendLabels: Record<FriendshipStatus, string> = {
  none: "Add Friend",
  requested: "Requested",
  friends: "Friends",
  blocked: "Blocked",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h3 className="text-lg font-black text-slate-950">{title}</h3><div className="mt-4">{children}</div></section>;
}

function ExternalProfileLink({ href, label }: { href: string; label: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">{label}</a>;
}

export function ProfileView({
  viewer,
  owner,
  theme,
  friendshipStatus,
  following,
  recentStories,
  marketplaceListings,
  onBack,
  onEdit,
  onEditPrivacy,
  onCycleFriendship,
  onToggleFollow,
  onBlock,
  onReport,
  clubInviteOptions,
  incomingClubInvitations,
  onInviteToClub,
  onAcceptClubInvitation,
  onDeclineClubInvitation,
  socialContent,
}: ProfileViewProps) {
  const [messageNotice, setMessageNotice] = useState(false);
  const [clubInviteOpen, setClubInviteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<UserReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const isOwnProfile = viewer.account.id === owner.account.id;
  const context = createProfileViewerContext(viewer, owner, friendshipStatus);
  const ownerUniversity = universities[owner.account.universityId];
  const catalog = getAcademicCatalog(owner.account.universityId);
  const classes = canViewClasses(context) ? owner.profile.classIds.map((id) => catalog.courses.find((course) => course.id === id)).filter((course) => course !== undefined) : [];
  const clubs = canViewClubs(context) ? owner.profile.clubIds.map((id) => getOrganizationById(id)).filter((club) => club !== null) : [];
  const sellerListing = marketplaceListings.find((listing) => listing.sellerId === owner.account.id);
  const socialLinks = [
    canViewInstagram(context) && owner.profile.instagram ? { label: "Instagram", href: owner.profile.instagram } : null,
    canViewLinkedIn(context) && owner.profile.linkedin ? { label: "LinkedIn", href: owner.profile.linkedin } : null,
    canViewPortfolio(context) && owner.profile.portfolioUrl ? { label: "Portfolio", href: owner.profile.portfolioUrl } : null,
    canViewPersonalWebsite(context) && owner.profile.personalWebsite ? { label: "Website", href: owner.profile.personalWebsite } : null,
  ].filter((link): link is { label: string; href: string } => link !== null);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        title="Back"
        className="interactive-pop flex h-10 w-10 items-center justify-center border-0 bg-transparent p-0 text-[24px] font-semibold leading-none text-slate-800 shadow-none"
      >
        <MintBackLeaf />
      </button>
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="h-28 sm:h-36" style={{ background: `linear-gradient(120deg, ${theme.primary}, ${theme.accent})` }} />
        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <ProfileAvatar user={owner} size="lg" primaryColor={theme.primary} accentColor={theme.accent} />
              <div className="pb-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-black text-slate-950 sm:text-3xl">{owner.profile.displayName}</h2>{owner.account.isDevelopment && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Demo</span>}{(owner.account.verifiedStudent || owner.account.verifiedAlumni) && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Verified</span>}<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{owner.socialSettings.accountType}</span></div><p className="mt-1 text-sm font-semibold text-slate-600">@{owner.profile.username} · {ownerUniversity.name} · {getUserRoleLabel(owner.account.role)}</p></div>
            </div>
            <div className="flex flex-wrap gap-2 pb-1">
              {isOwnProfile ? <><button type="button" onClick={onEdit} className="rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ backgroundColor: theme.primary }}>Edit profile</button><button type="button" onClick={onEditPrivacy} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Privacy</button></> : <><button type="button" disabled={friendshipStatus === "blocked"} onClick={onCycleFriendship} className="rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: theme.primary }}>{friendLabels[friendshipStatus]}</button><button type="button" onClick={onToggleFollow} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">{following ? "Following" : "Follow"}</button><button type="button" onClick={() => setMessageNotice(true)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Message</button>{clubInviteOptions.length > 0 && <button type="button" onClick={() => setClubInviteOpen((open) => !open)} aria-expanded={clubInviteOpen} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Invite to Club</button>}</>}
            </div>
          </div>
          {clubInviteOpen && !isOwnProfile && clubInviteOptions.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Invite to one of your clubs
              </p>
              <div className="mt-2 space-y-2">
                {clubInviteOptions.map((club) => {
                  const canInvite =
                    club.status === "none" ||
                    club.status === "rejected";

                  const statusLabel =
                    club.status === "invited"
                      ? "Invited"
                      : club.status === "requested"
                        ? "Requested"
                        : ["member", "officer", "leader"].includes(club.status)
                          ? "Already joined"
                          : "Invite";

                  return (
                    <button
                      key={club.id}
                      type="button"
                      disabled={!canInvite}
                      onClick={() => {
                        onInviteToClub(club.id);
                        setClubInviteOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 text-left text-sm font-bold text-slate-800 shadow-sm disabled:opacity-50"
                    >
                      <span>{club.name}</span>
                      <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                        {statusLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {messageNotice && <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">Messaging is a placeholder for now. Relationship and block state are ready for future permission checks.</p>}
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">{canViewMajor(context) && owner.profile.major && <span>{owner.profile.major}</span>}{canViewGraduationYear(context) && owner.profile.graduationYear && <span>Class of {owner.profile.graduationYear}</span>}{canViewHometown(context) && owner.profile.hometown && <span>From {owner.profile.hometown}</span>}</div>
        </div>
      </section>

      {isOwnProfile && incomingClubInvitations.length > 0 && (
        <Section title="Club Invitations">
          <div className="space-y-3">
            {incomingClubInvitations.map((club) => (
              <div
                key={club.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"
              >
                <div>
                  <p className="font-black text-slate-900">{club.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    You were invited to join this club.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onAcceptClubInvitation(club.id)}
                    className="rounded-xl px-3 py-2 text-xs font-bold text-white"
                    style={{ backgroundColor: theme.primary }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeclineClubInvitation(club.id)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <div className="space-y-5">
          {canViewBio(context) && owner.profile.bio && <Section title="About"><p className="text-sm leading-7 text-slate-700">{owner.profile.bio}</p></Section>}
          {canViewInterests(context) && owner.profile.interests.length > 0 && <Section title="Interests"><div className="flex flex-wrap gap-2">{owner.profile.interests.map((interest) => <span key={interest} className="rounded-full px-3 py-1.5 text-sm font-semibold" style={{ backgroundColor: theme.accent, color: theme.primary }}>{interest}</span>)}</div></Section>}
          {classes.length > 0 && <Section title="Academics"><ul className="space-y-2">{classes.map((course) => <li key={course.id} className="text-sm text-slate-700"><strong>{course.subjectCode} {course.courseNumber}</strong><br />{course.title}</li>)}</ul></Section>}
          {clubs.length > 0 && <Section title="Clubs"><ul className="space-y-2">{clubs.map((club) => <li key={club.id} className="text-sm font-semibold text-slate-700">{club.name}</li>)}</ul></Section>}
          {socialLinks.length > 0 && <Section title="Social Links"><div className="flex flex-wrap gap-2">{socialLinks.map((link) => <ExternalProfileLink key={link.label} {...link} />)}</div></Section>}
          {socialContent}
          <Section title="Recent Stories">{recentStories.length > 0 ? <div className="space-y-3">{recentStories.map((story) => <article key={story.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><span>{story.category}</span><span>·</span><span>{universities[story.authorUniversity as keyof typeof universities]?.shortName ?? story.authorUniversity}</span></div><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">{story.text}</p></article>)}</div> : <p className="text-sm text-slate-500">No active Stories are visible to you right now.</p>}</Section>
        </div>
        <aside className="space-y-5">
          {sellerListing && <Section title="Marketplace seller"><p className="text-sm text-slate-600">Completed sales</p><p className="mt-1 text-2xl font-black text-slate-950">{sellerListing.seller.completedSales}</p><p className="mt-3 text-xs leading-5 text-slate-500">Ratings are not available. Seller identity uses this same profile ID.</p></Section>}
          <Section title="Campus Mint Reputation"><p className="font-bold text-slate-900">Not available yet</p><p className="mt-2 text-sm leading-6 text-slate-500">The model is ready for future Marketplace, tutoring, mentoring, review, and community sources. No score is invented for this version.</p></Section>
          {!isOwnProfile && <Section title="Safety"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setReportOpen((open) => !open)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">Report</button><button type="button" onClick={onBlock} className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700">Block</button></div>{reportOpen && <div className="mt-4 space-y-3"><select value={reportReason} onChange={(event) => setReportReason(event.target.value as UserReportReason)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="impersonation">Impersonation</option><option value="inappropriate_content">Inappropriate content</option><option value="other">Other</option></select><textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="Optional details" rows={3} className="w-full rounded-xl border border-slate-200 p-3 text-sm" /><button type="button" onClick={() => { onReport(reportReason, reportDetails.trim() || null); setReportOpen(false); setReportDetails(""); }} className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white">Submit local report</button></div>}</Section>}
        </aside>
      </div>
    </div>
  );
}
