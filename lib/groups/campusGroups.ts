import type {
  CampusGroup,
  CampusGroupCategory,
  CampusGroupMembership,
} from "../../types/group.ts";

export type CampusGroupAccessContext = {
  configuredUniversityId: CampusGroup["universityId"] | null;
  userId: string;
};

export function isCampusGroupVisible(
  group: CampusGroup,
  access: CampusGroupAccessContext,
) {
  return Boolean(
    access.configuredUniversityId &&
      group.accessibleUniversityIds.includes(
        access.configuredUniversityId,
      ),
  );
}

export function filterCampusGroupDiscovery(
  groups: readonly CampusGroup[],
  access: CampusGroupAccessContext,
  options: {
    query?: string;
    category?: "All" | CampusGroupCategory;
  } = {},
) {
  const query = (options.query ?? "").trim().toLocaleLowerCase();
  const category = options.category ?? "All";

  return groups.filter((group) => {
    if (!isCampusGroupVisible(group, access)) return false;
    if (category !== "All" && group.category !== category) return false;
    if (!query) return true;

    return [
      group.name,
      group.courseCode,
      group.description,
      group.category,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(query);
  });
}

export function getMyCampusGroups(
  groups: readonly CampusGroup[],
  memberships: readonly CampusGroupMembership[],
  access: CampusGroupAccessContext,
) {
  const joinedIds = new Set(
    memberships
      .filter(
        (membership) =>
          membership.userId === access.userId &&
          membership.status === "member",
      )
      .map((membership) => membership.groupId),
  );

  return groups.filter(
    (group) =>
      joinedIds.has(group.id) && isCampusGroupVisible(group, access),
  );
}

export function updateCampusGroupMembership(
  memberships: readonly CampusGroupMembership[],
  group: CampusGroup,
  userId: string,
  action: "join" | "leave",
  now: string,
) {
  const withoutExisting = memberships.filter(
    (membership) =>
      !(membership.groupId === group.id && membership.userId === userId),
  );

  if (action === "leave" || group.access === "restricted") {
    return [...withoutExisting];
  }

  return [
    ...withoutExisting,
    {
      groupId: group.id,
      userId,
      status: group.access === "open" ? "member" : "requested",
      updatedAt: now,
    } satisfies CampusGroupMembership,
  ];
}

export function canDiscoverOrganizationCommunity(input: {
  membershipType: "open" | "application" | "invitation" | "restricted";
  membershipStatus:
    | "none"
    | "requested"
    | "invited"
    | "member"
    | "officer"
    | "leader"
    | "rejected"
    | "blocked";
  membershipAllowed: boolean;
}) {
  if (!input.membershipAllowed) return false;
  if (["member", "officer", "leader", "blocked"].includes(input.membershipStatus)) {
    return false;
  }

  return input.membershipType === "open" || input.membershipType === "application";
}

export function canShowOrganizationCommunityInMyGroups(input: {
  hasChatAccess: boolean;
  isConversationParticipant: boolean;
}) {
  return input.hasChatAccess && input.isConversationParticipant;
}
