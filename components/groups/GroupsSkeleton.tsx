"use client";

import { useMemo, useState } from "react";

import { developmentCampusGroups } from "@/data/development/groups";
import { developmentOrganizations } from "@/data/organizations";
import {
  universities,
  type UniversityId,
  type UniversityTheme,
} from "@/data/universities";
import { useCampusGroups } from "@/hooks/useCampusGroups";
import type { OrganizationsState } from "@/hooks/useOrganizations";
import {
  canDiscoverOrganizationCommunity,
  canShowOrganizationCommunityInMyGroups,
  filterCampusGroupDiscovery,
  getMyCampusGroups,
} from "@/lib/groups/campusGroups";
import {
  canAccessOrganizationChat,
  canJoinOrganization,
  canViewOrganization,
} from "@/lib/organizationPermissions";
import {
  campusGroupCategories,
  type CampusGroup,
  type CampusGroupCategory,
} from "@/types/group";
import type { Organization } from "@/types/organization";
import type { TemporaryUser } from "@/types/user";

type GroupView = "mine" | "discover";
type GroupFilter = "All" | CampusGroupCategory;

function accessLabel(group: CampusGroup) {
  if (group.access === "open") return "Open";
  if (group.access === "request") return "Request access";
  return "Restricted";
}

function GroupCard({
  group,
  theme,
  status,
  onAction,
}: {
  group: CampusGroup;
  theme: UniversityTheme;
  status: "none" | "member" | "requested";
  onAction: () => void;
}) {
  const displayedMembers =
    group.memberCount === null
      ? null
      : group.memberCount + (status === "member" ? 1 : 0);

  return (
    <article className="cm-surface-card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black"
          style={{ backgroundColor: theme.accent, color: theme.primary }}
          aria-hidden="true"
        >
          ◎
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-600">
            {group.category}
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-amber-800">
            Dev
          </span>
        </div>
      </div>
      {group.courseCode && (
        <p className="cm-eyebrow mt-4" style={{ color: theme.primary }}>
          {group.courseCode}
        </p>
      )}
      <h3 className={`${group.courseCode ? "mt-1" : "mt-4"} text-lg font-black leading-6 text-slate-950`}>
        {group.name}
      </h3>
      <p className="mt-1 text-xs font-bold text-slate-500">
        {universities[group.universityId].shortName} · {accessLabel(group)}
      </p>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {group.description}
      </p>
      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <p className="text-xs font-semibold text-slate-400">
          {displayedMembers === null
            ? "Member count unavailable"
            : `${displayedMembers.toLocaleString("en-US")} seeded members`}
        </p>
        <button
          type="button"
          disabled={status === "requested" || group.access === "restricted"}
          onClick={onAction}
          className="shrink-0 rounded-full px-3.5 py-2 text-xs font-black disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500"
          style={
            status !== "requested" && group.access !== "restricted"
              ? {
                  backgroundColor:
                    status === "member" ? theme.accent : theme.primary,
                  color:
                    status === "member" ? theme.primary : theme.secondary,
                }
              : undefined
          }
        >
          {status === "member"
            ? "Leave"
            : status === "requested"
              ? "Requested"
              : group.access === "open"
                ? "Join"
                : group.access === "request"
                  ? "Request"
                  : "Restricted"}
        </button>
      </div>
    </article>
  );
}

function OrganizationGroupCard({
  organization,
  theme,
  status,
  memberCount,
  onAction,
}: {
  organization: Organization;
  theme: UniversityTheme;
  status: ReturnType<OrganizationsState["getMembershipStatus"]>;
  memberCount: number;
  onAction: () => void;
}) {
  const joined = ["member", "officer", "leader"].includes(status);
  const disabled =
    status === "requested" ||
    status === "blocked" ||
    organization.membershipType === "invitation" ||
    organization.membershipType === "restricted";

  return (
    <article className="cm-surface-card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black"
          style={{ backgroundColor: theme.accent, color: theme.primary }}
        >
          {organization.name
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word.at(0))
            .join("")
            .toUpperCase()}
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-orange-800">
            Club chat
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-amber-800">
            Dev
          </span>
        </div>
      </div>
      <h3 className="mt-4 text-lg font-black leading-6 text-slate-950">
        {organization.name}
      </h3>
      <p className="mt-1 text-xs font-bold text-slate-500">
        {universities[organization.universityId].shortName} · {organization.membershipType === "open" ? "Open membership" : "Membership approval"}
      </p>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {organization.shortDescription}
      </p>
      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <p className="text-xs font-semibold text-slate-400">
          {memberCount > 0
            ? `${memberCount.toLocaleString("en-US")} local members`
            : "No local member count yet"}
        </p>
        <button
          type="button"
          disabled={disabled && !joined}
          onClick={onAction}
          className="shrink-0 rounded-full px-3.5 py-2 text-xs font-black disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500"
          style={
            !disabled || joined
              ? {
                  backgroundColor: joined ? theme.accent : theme.primary,
                  color: joined ? theme.primary : theme.secondary,
                }
              : undefined
          }
        >
          {joined
            ? "Leave club"
            : status === "requested"
              ? "Requested"
              : organization.membershipType === "open"
                ? "Join club"
                : organization.membershipType === "application"
                  ? "Request"
                  : "Restricted"}
        </button>
      </div>
    </article>
  );
}

export function GroupsSkeleton({
  currentUserId,
  user,
  configuredUniversityId,
  theme,
  organizations,
  onOrganizationMembershipAction,
}: {
  currentUserId: string;
  user: TemporaryUser;
  configuredUniversityId: UniversityId | null;
  theme: UniversityTheme;
  organizations: OrganizationsState;
  onOrganizationMembershipAction: (organization: Organization) => void;
}) {
  const [view, setView] = useState<GroupView>("mine");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GroupFilter>("All");
  const campusGroups = useCampusGroups(currentUserId);
  const access = useMemo(
    () => ({ configuredUniversityId, userId: currentUserId }),
    [configuredUniversityId, currentUserId],
  );
  const configuredUser = configuredUniversityId
    ? { ...user, universityId: configuredUniversityId }
    : null;

  const visibleDevelopmentGroups = useMemo(
    () =>
      filterCampusGroupDiscovery(developmentCampusGroups, access, {
        query,
        category,
      }),
    [access, category, query],
  );

  const myDevelopmentGroups = useMemo(() => {
    const joined = getMyCampusGroups(
      developmentCampusGroups,
      campusGroups.memberships,
      access,
    );
    const visibleIds = new Set(visibleDevelopmentGroups.map((group) => group.id));
    return joined.filter((group) => visibleIds.has(group.id));
  }, [
    campusGroups.memberships,
    access,
    visibleDevelopmentGroups,
  ]);

  const visibleOrganizationGroups = developmentOrganizations.filter(
    (organization) => {
      if (!configuredUser || !organization.organizationConversationId) {
        return false;
      }
      if (!theme.accessibleCampuses.includes(organization.universityId)) {
        return false;
      }
      if (!canViewOrganization(configuredUser, organization)) return false;
      if (category !== "All" && category !== "Clubs") return false;

      const normalizedQuery = query.trim().toLocaleLowerCase();
      return (
        !normalizedQuery ||
        [
          organization.name,
          organization.shortDescription,
          organization.category,
          ...organization.keywords,
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      );
    },
  );

  const myOrganizationGroups = visibleOrganizationGroups.filter(
    (organization) => {
      if (!configuredUniversityId) return false;
      const actor = { id: currentUserId, universityId: configuredUniversityId };
      return Boolean(
        organization.organizationConversationId &&
          canShowOrganizationCommunityInMyGroups({
            hasChatAccess: canAccessOrganizationChat(
            actor,
            organization,
            organizations.memberships,
            ),
            isConversationParticipant: organizations.isConversationParticipant(
              organization.organizationConversationId,
            ),
          }),
      );
    },
  );

  const discoverOrganizationGroups = visibleOrganizationGroups.filter(
    (organization) => {
      if (!configuredUser || myOrganizationGroups.includes(organization)) {
        return false;
      }
      return canDiscoverOrganizationCommunity({
        membershipType: organization.membershipType,
        membershipStatus: organizations.getMembershipStatus(organization.id),
        membershipAllowed: canJoinOrganization(configuredUser, organization),
      });
    },
  );

  const availableCategories: GroupFilter[] = [
    "All",
    ...campusGroupCategories.filter((candidate) => {
      if (candidate === "Clubs") return visibleOrganizationGroups.length > 0;
      return filterCampusGroupDiscovery(developmentCampusGroups, access, {
        category: candidate,
      }).length > 0;
    }),
  ];

  const discoverDevelopmentGroups = visibleDevelopmentGroups.filter(
    (group) => campusGroups.getStatus(group.id) !== "member",
  );
  const hasMyGroups =
    myDevelopmentGroups.length + myOrganizationGroups.length > 0;
  const hasDiscoverGroups =
    discoverDevelopmentGroups.length + discoverOrganizationGroups.length > 0;

  return (
    <div className="space-y-5">
      <label className="relative block">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-400" aria-hidden="true">
          ⌕
        </span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search group name, course, subject, or club…"
          className="w-full rounded-3xl border border-white/80 bg-white/95 py-4 pl-12 pr-4 text-sm shadow-sm outline-none focus:ring-2"
          style={{ caretColor: theme.primary }}
        />
      </label>

      <div className="flex rounded-2xl border border-white/80 bg-white/90 p-1 shadow-sm" role="tablist" aria-label="Group views">
        {([
          { id: "mine", label: "My Groups" },
          { id: "discover", label: "Discover" },
        ] as const).map((option) => {
          const selected = view === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setView(option.id)}
              className="flex-1 rounded-xl px-4 py-3 text-sm font-black transition"
              style={
                selected
                  ? { backgroundColor: theme.primary, color: theme.secondary }
                  : { color: "#64748b" }
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {availableCategories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Group category filters">
          {availableCategories.map((option) => {
            const selected = category === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategory(option)}
                className="shrink-0 rounded-full border px-3.5 py-2 text-xs font-black"
                style={
                  selected
                    ? {
                        borderColor: theme.primary,
                        backgroundColor: theme.accent,
                        color: theme.primary,
                      }
                    : {
                        borderColor: "#e2e8f0",
                        backgroundColor: "white",
                        color: "#64748b",
                      }
                }
              >
                {option}
              </button>
            );
          })}
        </div>
      )}

      {!configuredUniversityId ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-9 text-center">
          <h2 className="font-black text-slate-900">Groups are not configured yet</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            A provisional university identity never inherits another campus&apos;s
            development groups.
          </p>
        </div>
      ) : view === "mine" ? (
        hasMyGroups ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myDevelopmentGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                theme={theme}
                status="member"
                onAction={() => campusGroups.leave(group)}
              />
            ))}
            {myOrganizationGroups.map((organization) => (
              <OrganizationGroupCard
                key={organization.id}
                organization={organization}
                theme={theme}
                status={organizations.getMembershipStatus(organization.id)}
                memberCount={organizations.getMemberCount(organization.id)}
                onAction={() => onOrganizationMembershipAction(organization)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-9 text-center">
            <h2 className="font-black text-slate-900">No matching groups yet</h2>
            <p className="mt-2 text-sm text-slate-500">
              Join an open development group or an eligible club community from
              Discover.
            </p>
            <button
              type="button"
              onClick={() => setView("discover")}
              className="mt-5 rounded-full px-4 py-2.5 text-sm font-black"
              style={{ backgroundColor: theme.primary, color: theme.secondary }}
            >
              Discover groups
            </button>
          </div>
        )
      ) : hasDiscoverGroups ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {discoverDevelopmentGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              theme={theme}
              status={campusGroups.getStatus(group.id)}
              onAction={() => campusGroups.joinOrRequest(group)}
            />
          ))}
          {discoverOrganizationGroups.map((organization) => (
            <OrganizationGroupCard
              key={organization.id}
              organization={organization}
              theme={theme}
              status={organizations.getMembershipStatus(organization.id)}
              memberCount={organizations.getMemberCount(organization.id)}
              onAction={() => onOrganizationMembershipAction(organization)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-9 text-center">
          <h2 className="font-black text-slate-900">No groups match this view</h2>
          <p className="mt-2 text-sm text-slate-500">
            Clear the search or choose another available category.
          </p>
        </div>
      )}

      <section className="rounded-3xl bg-slate-950 p-5 text-white">
        <p className="cm-eyebrow text-amber-300">
          Local development only
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          These sample communities and join states live on this device. No shared
          backend chat or live university membership is implied.
        </p>
      </section>
    </div>
  );
}
