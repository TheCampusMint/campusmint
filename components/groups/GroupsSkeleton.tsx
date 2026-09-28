"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useCampusPreview } from "@/components/developer/CampusPreviewContext";

import { MintLeafBackButton } from "@/components/ui/MintLeafBackButton";
import { SearchIcon } from "@/components/icons/CampusIcons";

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
import type { CampusGroup } from "@/types/group";
import type { Organization } from "@/types/organization";
import type { TemporaryUser } from "@/types/user";
import { areDevelopmentFixturesEnabled } from "@/lib/runtime/fixturePolicy";

const fixtureCampusGroups = areDevelopmentFixturesEnabled() ? developmentCampusGroups : [];
const fixtureOrganizations = areDevelopmentFixturesEnabled() ? developmentOrganizations : [];

type GroupView = "mine" | "discover";

function accessLabel(group: CampusGroup) {
  if (group.access === "open") return "Open";
  if (group.access === "request") return "Request access";
  return "Restricted";
}

function GroupCard({
  group,
  status,
  onAction,
  onOpen,
}: {
  group: CampusGroup;
  status: "none" | "member" | "requested";
  onAction: () => void;
  onOpen: () => void;
}) {
  const readOnly = useCampusPreview();
  const displayedMembers =
    group.memberCount === null
      ? null
      : group.memberCount + (status === "member" ? 1 : 0);

  return (
    <article className="cm-surface-card cm-interactive-card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center text-lg font-black"
          style={{ color: "var(--app-discovery)" }}
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
        <p className="cm-eyebrow mt-4" style={{ color: "var(--app-accent)" }}>
          {group.courseCode}
        </p>
      )}
      <button type="button" onClick={onOpen} className={`${group.courseCode ? "mt-1" : "mt-4"} text-left text-lg font-black leading-6 text-slate-950 hover:underline`}>{group.name}</button>
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
        <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={onOpen} className="rounded-full px-3 py-2 text-xs font-black text-slate-500">Open</button><button
          type="button"
          disabled={readOnly || status === "requested" || group.access === "restricted"}
          onClick={onAction}
          className="shrink-0 rounded-full px-3.5 py-2 text-xs font-black disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500"
          style={
            status !== "requested" && group.access !== "restricted"
              ? {
                  backgroundColor:
                    status === "member" ? "var(--app-accent-soft)" : "var(--app-accent)",
                  color:
                    status === "member" ? "var(--app-accent)" : "var(--app-accent-contrast)",
                }
              : undefined
          }
        >
          <span key={status} className="cm-state-pop">
            {status === "member"
              ? "Leave"
              : status === "requested"
                ? "Requested"
                : group.access === "open"
                  ? "Join"
                  : group.access === "request"
                    ? "Request"
                    : "Restricted"}
          </span>
        </button></div>
      </div>
    </article>
  );
}

function OrganizationGroupCard({
  organization,
  status,
  memberCount,
  onAction,
  onOpen,
}: {
  organization: Organization;
  status: ReturnType<OrganizationsState["getMembershipStatus"]>;
  memberCount: number;
  onAction: () => void;
  onOpen: () => void;
}) {
  const readOnly = useCampusPreview();
  const joined = ["member", "officer", "leader"].includes(status);
  const disabled =
    status === "requested" ||
    status === "blocked" ||
    organization.membershipType === "invitation" ||
    organization.membershipType === "restricted";

  return (
    <article className="cm-surface-card cm-interactive-card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black"
          style={{ backgroundColor: "var(--app-accent-soft)", color: "var(--app-accent)" }}
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
      <button type="button" onClick={onOpen} className="mt-4 text-left text-lg font-black leading-6 text-slate-950 hover:underline">{organization.name}</button>
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
        <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={onOpen} className="rounded-full px-3 py-2 text-xs font-black text-slate-500">Open</button><button
          type="button"
          disabled={readOnly || (disabled && !joined)}
          onClick={onAction}
          className="shrink-0 rounded-full px-3.5 py-2 text-xs font-black disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500"
          style={
            !disabled || joined
              ? {
                  backgroundColor: joined ? "var(--app-accent-soft)" : "var(--app-accent)",
                  color: joined ? "var(--app-accent)" : "var(--app-accent-contrast)",
                }
              : undefined
          }
        >
          <span key={status} className="cm-state-pop">
            {joined
              ? "Leave club"
              : status === "requested"
                ? "Requested"
                : organization.membershipType === "open"
                  ? "Join club"
                  : organization.membershipType === "application"
                    ? "Request"
                    : "Restricted"}
          </span>
        </button></div>
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
  requestedOrganizationId = null,
  onRequestedOrganizationHandled,
  onBackToNotifications,
}: {
  currentUserId: string;
  user: TemporaryUser;
  configuredUniversityId: UniversityId | null;
  theme: UniversityTheme;
  organizations: OrganizationsState;
  onOrganizationMembershipAction: (organization: Organization) => void;
  requestedOrganizationId?: string | null;
  onRequestedOrganizationHandled?: () => void;
  onBackToNotifications?: () => void;
}) {
  const readOnly = useCampusPreview();
  const [view, setView] = useState<GroupView>("mine");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<
    { kind: "campus" | "organization"; id: string } | null
  >(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const handledOrganizationRequestRef = useRef<string | null>(null);
  const campusGroups = useCampusGroups(currentUserId);
  const access = useMemo(
    () => ({ configuredUniversityId, userId: currentUserId }),
    [configuredUniversityId, currentUserId],
  );
  const configuredUser = configuredUniversityId
    ? { ...user, universityId: configuredUniversityId }
    : null;

  const discoverableDevelopmentGroups = useMemo(
    () =>
      filterCampusGroupDiscovery(fixtureCampusGroups, access, {
        query,
      }),
    [access, query],
  );

  const myDevelopmentGroups = useMemo(() => {
    const joined = getMyCampusGroups(
      fixtureCampusGroups,
      campusGroups.memberships,
      access,
    );
    return joined;
  }, [
    campusGroups.memberships,
    access,
  ]);

  const visibleOrganizationGroups = fixtureOrganizations.filter(
    (organization) => {
      if (!configuredUser || !organization.organizationConversationId) {
        return false;
      }
      if (!theme.accessibleCampuses.includes(organization.universityId)) {
        return false;
      }
      if (!canViewOrganization(configuredUser, organization)) return false;
      return true;
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
      const discoverable = canDiscoverOrganizationCommunity({
        membershipType: organization.membershipType,
        membershipStatus: organizations.getMembershipStatus(organization.id),
        membershipAllowed: canJoinOrganization(configuredUser, organization),
      });
      const normalizedQuery = query.trim().toLocaleLowerCase();
      return (
        discoverable &&
        (!normalizedQuery ||
          [
            organization.name,
            organization.shortDescription,
            organization.category,
            ...organization.keywords,
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedQuery))
      );
    },
  );

  const discoverDevelopmentGroups = discoverableDevelopmentGroups.filter(
    (group) => campusGroups.getStatus(group.id) !== "member",
  );
  const hasMyGroups =
    myDevelopmentGroups.length + myOrganizationGroups.length > 0;
  const hasDiscoverGroups =
    discoverDevelopmentGroups.length + discoverOrganizationGroups.length > 0;

  useEffect(() => {
    if (!requestedOrganizationId || handledOrganizationRequestRef.current === requestedOrganizationId) return;
    handledOrganizationRequestRef.current = requestedOrganizationId;
    const organization = fixtureOrganizations.find(
      (candidate) => candidate.id === requestedOrganizationId,
    );
    if (!organization || !theme.accessibleCampuses.includes(organization.universityId)) {
      onRequestedOrganizationHandled?.();
      return;
    }
    // Notification navigation selects a nested detail without mutating membership.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected({ kind: "organization", id: requestedOrganizationId });
  }, [onRequestedOrganizationHandled, requestedOrganizationId, theme.accessibleCampuses]);

  const selectedCampusGroup = selected?.kind === "campus"
    ? fixtureCampusGroups.find((group) => group.id === selected.id) ?? null
    : null;
  const selectedOrganization = selected?.kind === "organization"
    ? fixtureOrganizations.find((organization) => organization.id === selected.id) ?? null
    : null;

  function closeDetail() {
    setChatOpen(false);
    setSelected(null);
    onRequestedOrganizationHandled?.();
    if (onBackToNotifications) onBackToNotifications();
  }

  function submitChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    const body = chatDraft.trim();
    if (!body) return;
    setChatMessages((current) => [...current, body]);
    setChatDraft("");
  }

  if (selectedCampusGroup || selectedOrganization) {
    const organizationStatus = selectedOrganization
      ? organizations.getMembershipStatus(selectedOrganization.id)
      : "none";
    const joinedOrganization = ["member", "officer", "leader"].includes(organizationStatus);
    const organizationActor = configuredUniversityId
      ? { id: currentUserId, universityId: configuredUniversityId }
      : null;
    const canChat = !readOnly && (selectedCampusGroup
      ? campusGroups.getStatus(selectedCampusGroup.id) === "member"
      : Boolean(
          selectedOrganization &&
          organizationActor &&
          selectedOrganization.organizationConversationId &&
          canAccessOrganizationChat(
            organizationActor,
            selectedOrganization,
            organizations.memberships,
          ) &&
          organizations.isConversationParticipant(
            selectedOrganization.organizationConversationId,
          ),
        ));
    const title = selectedCampusGroup?.name ?? selectedOrganization?.name ?? "Group";
    const description = selectedCampusGroup?.description ?? selectedOrganization?.fullDescription ?? "";
    const memberCount = selectedCampusGroup?.memberCount ?? selectedOrganization?.memberCount ?? null;

    return (
      <section className="cm-content-swap space-y-4" data-group-detail>
        <header className="flex items-center gap-3">
          <MintLeafBackButton onClick={closeDetail} label="Back" aria-label="Back" tone="minimal" className="text-slate-800" />
          <div className="min-w-0"><p className="cm-eyebrow" style={{ color: "var(--app-accent)" }}>Group</p><h1 className="truncate text-xl font-black text-slate-950">{title}</h1></div>
        </header>
        <div className="cm-surface-card p-5 sm:p-6">
          <p className="text-sm leading-6 text-slate-600">{description}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500">{typeof memberCount === "number" ? `${memberCount.toLocaleString("en-US")} members` : "Member count unavailable"}</p>
            {!readOnly && selectedOrganization && !joinedOrganization && (
              <button type="button" onClick={() => onOrganizationMembershipAction(selectedOrganization)} className="rounded-full px-4 py-2 text-xs font-black" style={{ backgroundColor: "var(--app-accent)", color: "var(--app-accent-contrast)" }}>{organizationStatus === "requested" ? "Requested" : "Join / Request"}</button>
            )}
          </div>
        </div>

        <div className="cm-surface-card p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-black text-slate-900">Group chat</h2><p className="mt-1 text-xs text-slate-500">Local prototype conversation</p></div><button type="button" disabled={!canChat} onClick={() => setChatOpen((current) => !current)} className="rounded-full px-3 py-2 text-xs font-black disabled:bg-slate-100 disabled:text-slate-400" style={canChat ? { backgroundColor: "var(--app-accent)", color: "var(--app-accent-contrast)" } : undefined}>{canChat ? (chatOpen ? "Close chat" : "Open chat") : "Members only"}</button></div>
          {!canChat && <p className="mt-3 text-xs leading-5 text-slate-500">Join and become an official conversation participant to access this group chat.</p>}
          {chatOpen && canChat && (
            <div className="cm-content-swap mt-4">
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">{chatMessages.length ? chatMessages.map((message, index) => <p key={`${index}:${message}`} className="ml-auto w-fit max-w-[82%] rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--app-accent)", color: "var(--app-accent-contrast)" }}>{message}</p>) : <p className="py-6 text-center text-sm text-slate-400">No local messages yet</p>}</div>
              <form onSubmit={submitChat} className="mt-2 flex gap-2"><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Message group" className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm" /><button type="submit" disabled={!chatDraft.trim()} className="rounded-full px-4 py-2 text-xs font-black disabled:opacity-40" style={{ backgroundColor: "var(--app-accent)", color: "var(--app-accent-contrast)" }}>Send</button></form>
              <p className="mt-2 text-[10px] text-slate-400">Saved only for this browser session. Real-time group delivery is not connected.</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
      <div className="inline-flex rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm" role="tablist" aria-label="Group views">
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
              className="rounded-full px-4 py-2 text-xs font-black transition"
              style={
                selected
                  ? { backgroundColor: option.id === "discover" ? "var(--app-discovery-soft)" : "var(--app-personal-soft)", color: option.id === "discover" ? "var(--app-discovery)" : "var(--app-personal)" }
                  : { color: "var(--app-text-secondary)" }
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
      </div>

      {view === "discover" && (
        <label className="relative block">
          <span className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true"><SearchIcon /></span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search groups"
            className="w-full rounded-full border border-white/80 bg-white/95 py-3 pl-12 pr-4 text-sm shadow-sm outline-none focus:ring-2"
            style={{ caretColor: "var(--app-accent)" }}
          />
        </label>
      )}

      <div key={view} className="cm-content-swap">
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
                status="member"
                onAction={() => campusGroups.leave(group)}
                onOpen={() => setSelected({ kind: "campus", id: group.id })}
              />
            ))}
            {myOrganizationGroups.map((organization) => (
              <OrganizationGroupCard
                key={organization.id}
                organization={organization}
                status={organizations.getMembershipStatus(organization.id)}
                memberCount={organizations.getMemberCount(organization.id)}
                onAction={() => onOrganizationMembershipAction(organization)}
                onOpen={() => setSelected({ kind: "organization", id: organization.id })}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-9 text-center">
            <h2 className="font-black text-slate-900">No groups yet</h2>
            <button
              type="button"
              onClick={() => setView("discover")}
              className="mt-5 rounded-full px-4 py-2.5 text-sm font-black"
              style={{ backgroundColor: "var(--app-accent)", color: "var(--app-accent-contrast)" }}
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
              status={campusGroups.getStatus(group.id)}
              onAction={() => campusGroups.joinOrRequest(group)}
              onOpen={() => setSelected({ kind: "campus", id: group.id })}
            />
          ))}
          {discoverOrganizationGroups.map((organization) => (
            <OrganizationGroupCard
              key={organization.id}
              organization={organization}
              status={organizations.getMembershipStatus(organization.id)}
              memberCount={organizations.getMemberCount(organization.id)}
              onAction={() => onOrganizationMembershipAction(organization)}
              onOpen={() => setSelected({ kind: "organization", id: organization.id })}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-9 text-center">
          <h2 className="font-black text-slate-900">No groups match this view</h2>
          <p className="mt-2 text-sm text-slate-500">
            Clear the search to see available groups.
          </p>
        </div>
      )}
      </div>

    </div>
  );
}
