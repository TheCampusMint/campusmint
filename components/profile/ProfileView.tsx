"use client";

import { useState } from "react";
import Link from "next/link";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { getAcademicCatalog } from "@/data/development/campusData";
import {
  getClubHref,
  getOrganizationById,
} from "@/data/organizations";
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
  followerCount: number;
  followingCount: number;
  mintCount: number;
  onOpenDirectMint: (userId: string) => void;
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
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-sm font-semibold text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950"
    >
      {label}
    </a>
  );
}

export function ProfileView({
  viewer,
  owner,
  theme,
  friendshipStatus,
  following,
  followerCount,
  followingCount,
  mintCount,
  onOpenDirectMint,
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
  void recentStories;
  void marketplaceListings;

  void onCycleFriendship;

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
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="shrink-0 rounded-full">
                <ProfileAvatar
                  user={owner}
                  size="lg"
                  primaryColor={theme.primary}
                  accentColor={theme.accent}
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                    {owner.profile.displayName}
                  </h2>

                  {(owner.account.verifiedStudent ||
                    owner.account.verifiedAlumni) && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-800">
                      Verified
                    </span>
                  )}
                </div>

                <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                  @{owner.profile.username}
                </p>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {canViewMajor(context) &&
                    owner.profile.major && (
                      <span>
                        {owner.profile.major}
                      </span>
                    )}

                  {canViewGraduationYear(context) &&
                    owner.profile.graduationYear && (
                      <span>
                        Class of{" "}
                        {
                          owner.profile
                            .graduationYear
                        }
                      </span>
                    )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center sm:min-w-[15rem]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Followers
                </p>
                <p className="mt-1 text-lg font-black text-slate-950">
                  {followerCount}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Following
                </p>
                <p className="mt-1 text-lg font-black text-slate-950">
                  {followingCount}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Mintz
                </p>
                <p className="mt-1 text-lg font-black text-slate-950">
                  {mintCount}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 pt-2">
            {isOwnProfile ? (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="rounded-full px-5 py-2.5 text-sm font-bold text-white"
                  style={{
                    backgroundColor:
                      theme.primary,
                  }}
                >
                  Edit profile
                </button>

                <button
                  type="button"
                  onClick={onEditPrivacy}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700"
                >
                  Privacy
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onToggleFollow}
                  className={`rounded-full px-5 py-2.5 text-sm font-bold ${
                    following
                      ? "bg-slate-200 text-slate-600"
                      : "text-white"
                  }`}
                  style={
                    following
                      ? undefined
                      : {
                          backgroundColor:
                            theme.primary,
                        }
                  }
                >
                  {following
                    ? "Following"
                    : "Follow"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onOpenDirectMint(
                      owner.account.id,
                    )
                  }
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700"
                >
                  Message
                </button>

                {clubInviteOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setClubInviteOpen(
                        (open) => !open,
                      )
                    }
                    aria-expanded={
                      clubInviteOpen
                    }
                    className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700"
                  >
                    Invite
                  </button>
                )}
              </>
            )}
          </div>

          {clubInviteOpen &&
            !isOwnProfile &&
            clubInviteOptions.length > 0 && (
              <div className="mx-auto mt-4 max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Invite to club
                </p>

                <div className="mt-2 space-y-2">
                  {clubInviteOptions.map(
                    (club) => {
                      const canInvite =
                        club.status ===
                          "none" ||
                        club.status ===
                          "rejected";

                      const statusLabel =
                        club.status ===
                        "invited"
                          ? "Invited"
                          : club.status ===
                              "requested"
                            ? "Requested"
                            : [
                                  "member",
                                  "officer",
                                  "leader",
                                ].includes(
                                  club.status,
                                )
                              ? "Joined"
                              : "Invite";

                      return (
                        <button
                          key={club.id}
                          type="button"
                          disabled={
                            !canInvite
                          }
                          onClick={() => {
                            onInviteToClub(
                              club.id,
                            );
                            setClubInviteOpen(
                              false,
                            );
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 text-left text-sm font-bold text-slate-800 shadow-sm disabled:opacity-50"
                        >
                          <span>
                            {club.name}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                            {statusLabel}
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            )}
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

      <div className="space-y-5">
        {(canViewBio(context) && owner.profile.bio) ||
        (canViewInterests(context) && owner.profile.interests.length > 0) ||
        socialLinks.length > 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            {canViewBio(context) && owner.profile.bio && (
              <p className="text-sm leading-7 text-slate-700">
                {owner.profile.bio}
              </p>
            )}

            {canViewInterests(context) &&
              owner.profile.interests.length > 0 && (
                <div
                  className={`flex flex-wrap gap-2 ${
                    canViewBio(context) && owner.profile.bio ? "mt-4" : ""
                  }`}
                  aria-label="Interests"
                >
                  {owner.profile.interests.map((interest) => (
                    <span
                      key={interest}
                      className="rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm"
                      style={{
                        backgroundColor: theme.accent,
                        color: theme.primary,
                      }}
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              )}

            {socialLinks.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {socialLinks.map((link) => (
                  <ExternalProfileLink
                    key={link.label}
                    {...link}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {classes.length > 0 && (
          <Section title="Academics">
            <ul className="space-y-2">
              {classes.map((course) => (
                <li key={course.id} className="text-sm text-slate-700">
                  <strong>
                    {course.subjectCode} {course.courseNumber}
                  </strong>
                  <br />
                  {course.title}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {clubs.length > 0 && (
          <Section title="Clubs">
            <div className="flex flex-wrap gap-2">
              {clubs.map((club) => (
                <Link
                  key={club.id}
                  href={getClubHref(club)}
                  className="inline-flex rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  style={{
                    color: theme.primary,
                  }}
                >
                  {club.name}
                </Link>
              ))}
            </div>
          </Section>
        )}

        {socialContent}

        {!isOwnProfile && (
          <div className="flex flex-col items-center pt-3">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setReportOpen((open) => !open)}
                className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm"
              >
                Report
              </button>

              <button
                type="button"
                onClick={onBlock}
                className="rounded-full border border-rose-200 bg-white px-5 py-2.5 text-sm font-bold text-rose-700 shadow-sm"
              >
                Block
              </button>
            </div>

            {reportOpen && (
              <div className="mt-4 w-full max-w-md space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <select
                  value={reportReason}
                  onChange={(event) =>
                    setReportReason(
                      event.target.value as UserReportReason,
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="spam">Spam</option>
                  <option value="harassment">Harassment</option>
                  <option value="impersonation">Impersonation</option>
                  <option value="inappropriate_content">
                    Inappropriate content
                  </option>
                  <option value="other">Other</option>
                </select>

                <textarea
                  value={reportDetails}
                  onChange={(event) =>
                    setReportDetails(event.target.value)
                  }
                  placeholder="Optional details"
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                />

                <button
                  type="button"
                  onClick={() => {
                    onReport(
                      reportReason,
                      reportDetails.trim() || null,
                    );
                    setReportOpen(false);
                    setReportDetails("");
                  }}
                  className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white"
                >
                  Submit report
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
