"use client";

import { useState } from "react";

import { CreateContentFlow } from "@/components/content/CreateContentFlow";
import { EventCard } from "@/components/events/EventCard";
import { OrganizationCard } from "@/components/clubs/OrganizationCard";
import { MintFeedList } from "@/components/mintz/MintFeedList";
import { StoryCard } from "@/components/stories/StoryCard";
import { sampleEvents } from "@/data/events";
import { developmentOrganizations, getOrganizationById } from "@/data/organizations";
import { getCampusName, type UniversityTheme } from "@/data/universities";
import type { MintzState } from "@/hooks/useMintz";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import type { ProfilesState } from "@/hooks/useProfiles";
import { getMintFeed, type MintFeed } from "@/lib/social/mintFeeds";
import { getVisibleStories } from "@/lib/storyPermissions";
import type { Organization } from "@/types/organization";
import type { CampusMintUser } from "@/types/profile";
import type { Story, StoryComment } from "@/types/story";
import type { TemporaryUser } from "@/types/user";
import { canJoinOrganization } from "@/lib/organizationPermissions";

type CampusSocialHubProps = {
  viewer: CampusMintUser;
  user: TemporaryUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  mintz: MintzState;
  organizations: OrganizationsState;
  stories: Story[];
  currentTime: number;
  onToggleStoryLike: (storyId: string) => void;
  onAddStoryComment: (storyId: string, comment: StoryComment) => void;
  onCreateStory: (story: Story) => void;
  onOpenProfile: (userId: string) => void;
  onMembershipAction: (organization: Organization) => void;
  onOpenClubs: () => void;
};

const feedLabels: Record<MintFeed, string> = {
  following: "Following",
  campus: "Campus",
  discover: "Discover",
};

export function CampusSocialHub({ viewer, user, theme, profiles, mintz, organizations, stories, currentTime, onToggleStoryLike, onAddStoryComment, onCreateStory, onOpenProfile, onMembershipAction, onOpenClubs }: CampusSocialHubProps) {
  const [feed, setFeed] = useState<MintFeed>("campus");
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [rsvpedEventIds, setRsvpedEventIds] = useState<Set<string>>(() => new Set());
  const users = profiles.users.map((user) => user.account.id === viewer.account.id ? viewer : user);
  const actor = { id: viewer.account.id, universityId: viewer.account.universityId };
  const feedState = {
    viewer,
    users,
    friendships: profiles.friendships,
    follows: profiles.follows,
    blocks: profiles.blocks,
    currentTime: mintz.currentTime,
    organizationMemberships: organizations.memberships,
    followedOrganizationIds: organizations.followedOrganizationIds,
  };
  const visibleMintz = getMintFeed(mintz.mintz, feed, feedState);
  const eligibleStories = getVisibleStories(stories, theme.accessibleCampuses, viewer.account.role, currentTime, actor, organizations.memberships);
  const visibleStories = eligibleStories.filter((story) => {
    if (feed !== "following") return true;
    return story.authorUserId === viewer.account.id
      || Boolean(story.authorUserId && profiles.follows.some((follow) => follow.followerId === viewer.account.id && follow.followingId === story.authorUserId))
      || Boolean(story.organizationId && organizations.followedOrganizationIds.includes(story.organizationId));
  }).slice(0, 2);
  const visibleEvents = sampleEvents.filter((event) => {
    if (!theme.accessibleCampuses.includes(event.campus)) return false;
    if (new Date(event.eventEndAt ?? event.eventStartAt).getTime() <= currentTime) return false;
    return feed !== "following" || Boolean(event.organizationId && organizations.followedOrganizationIds.includes(event.organizationId));
  }).sort((first, second) => new Date(first.eventStartAt).getTime() - new Date(second.eventStartAt).getTime()).slice(0, 2);
  const visibleOrganizations = developmentOrganizations.filter((organization) => {
    const accessible = theme.accessibleCampuses.includes(organization.universityId);
    if (!accessible) return false;
    if (feed === "following") return organizations.followedOrganizationIds.includes(organization.id);
    if (feed === "campus") return organization.universityId === viewer.account.universityId;
    return true;
  }).slice(0, 3);

  function addStoryComment(storyId: string, body: string) {
    onAddStoryComment(storyId, {
      id: `local-comment-${crypto.randomUUID()}`,
      authorId: viewer.account.id,
      authorName: viewer.profile.displayName,
      body,
      mentions: [],
      parentCommentId: null,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  function toggleRsvp(eventId: string) {
    setRsvpedEventIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) next.delete(eventId); else next.add(eventId);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-wider" style={{ color: theme.primary }}>One campus social experience</p><h2 className="mt-1 text-3xl font-black text-slate-950">Campus</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Stories, Mintz, official Events, and Clubs share one discovery page while keeping their own records and permissions.</p></div><button type="button" onClick={() => setCreateOpen(true)} className="rounded-xl px-5 py-3 text-sm font-bold" style={{ backgroundColor: theme.primary, color: theme.secondary }}>Create</button></div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">{(Object.keys(feedLabels) as MintFeed[]).map((option) => <button key={option} type="button" onClick={() => setFeed(option)} aria-pressed={feed === option} className="rounded-xl px-4 py-2 text-sm font-bold" style={feed === option ? { backgroundColor: theme.primary, color: theme.secondary } : { backgroundColor: "#f1f5f9", color: "#475569" }}>{feedLabels[option]}</button>)}</div>
      </section>

      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}

      <section className="space-y-4"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wide" style={{ color: theme.primary }}>Stories</p><h3 className="mt-1 text-xl font-black text-slate-950">Happening now</h3></div><p className="text-xs text-slate-500">Active Stories only</p></div>{visibleStories.length ? <div className="mx-auto max-w-2xl space-y-5">{visibleStories.map((story) => { const organization = getOrganizationById(story.organizationId); const status = organization ? organizations.getMembershipStatus(organization.id) : undefined; return <StoryCard key={story.id} story={story} currentTime={currentTime} theme={theme} onToggleLike={onToggleStoryLike} onAddComment={addStoryComment} onOpenProfile={onOpenProfile} organizationMembershipStatus={status} onOrganizationMembershipAction={organization && canJoinOrganization(user, organization) && (status === "none" || status === "rejected") ? () => onMembershipAction(organization) : undefined} />; })}</div> : <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No Stories are available in this view.</p>}</section>

      <section className="space-y-4"><div><p className="text-xs font-black uppercase tracking-wide" style={{ color: theme.primary }}>Mintz</p><h3 className="mt-1 text-xl font-black text-slate-950">Latest posts</h3><p className="mt-1 text-sm text-slate-500">Chronological within the selected feed.</p></div><div className="mx-auto max-w-2xl"><MintFeedList mints={visibleMintz} viewer={viewer} theme={theme} profiles={profiles} mintz={mintz} organizations={organizations} feedState={feedState} onOpenProfile={onOpenProfile} onRequestOrganization={(organizationId) => { const organization = getOrganizationById(organizationId); if (organization) onMembershipAction(organization); }} onNotice={setNotice} /></div></section>

      <section className="space-y-4"><div><p className="text-xs font-black uppercase tracking-wide" style={{ color: theme.primary }}>Events</p><h3 className="mt-1 text-xl font-black text-slate-950">Upcoming and relevant</h3><p className="mt-1 text-sm text-slate-500">These are Event entities, not generated social posts.</p></div>{visibleEvents.length ? <div className="grid gap-5 xl:grid-cols-2">{visibleEvents.map((event) => <EventCard key={event.id} event={event} campusName={getCampusName(event.campus)} isGoing={rsvpedEventIds.has(event.id)} theme={theme} onToggleRsvp={toggleRsvp} />)}</div> : <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No upcoming Events are available in this view.</p>}</section>

      <section className="space-y-4"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wide" style={{ color: theme.primary }}>Clubs</p><h3 className="mt-1 text-xl font-black text-slate-950">Organizations to follow or join</h3><p className="mt-1 text-sm text-slate-500">Following controls public discovery; membership controls private access.</p></div><button type="button" onClick={onOpenClubs} className="text-sm font-bold" style={{ color: theme.primary }}>Open Clubs</button></div>{visibleOrganizations.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleOrganizations.map((organization) => <OrganizationCard key={organization.id} organization={organization} nextEvent={sampleEvents.find((event) => event.organizationId === organization.id)} membershipStatus={organizations.getMembershipStatus(organization.id)} membershipAllowed={canJoinOrganization(user, organization)} theme={theme} onView={onOpenClubs} onMembershipAction={onMembershipAction} />)}</div> : <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No Clubs are available in this view.</p>}</section>

      {createOpen && <CreateContentFlow viewer={viewer} users={users} theme={theme} onCreateMint={mintz.createMint} onCreateStory={onCreateStory} onClose={() => setCreateOpen(false)} organizationMemberships={organizations.memberships} organizationRoles={organizations.roles} />}
    </div>
  );
}
