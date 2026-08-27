export const unifiedSearchCategories = [
  "people",
  "food",
  "tutoring",
  "clubs",
  "events",
  "marketplace",
] as const;

export type UnifiedSearchCategory =
  (typeof unifiedSearchCategories)[number];

export type UnifiedSearchResultCategory = Exclude<
  UnifiedSearchCategory,
  "tutoring"
>;

export type UnifiedSearchDetail =
  | { kind: "food"; id: string }
  | { kind: "club"; id: string }
  | { kind: "event"; id: string }
  | { kind: "event_moment"; id: string; eventId: string }
  | {
      kind: "marketplace";
      id: string;
      panel?: "none" | "offer" | "message" | "report";
    }
  | { kind: "profile"; id: string };

export type UnifiedSearchCategoryFilters = {
  tutoringSubject: string | null;
};

export type UnifiedSearchState = {
  category: UnifiedSearchCategory;
  query: string;
  categoryFilters: UnifiedSearchCategoryFilters;
  history: UnifiedSearchDetail[];
};

export const initialUnifiedSearchState: UnifiedSearchState = {
  category: "people",
  query: "",
  categoryFilters: { tutoringSubject: null },
  history: [],
};

export function migrateUnifiedSearchCategory(
  value: unknown,
): UnifiedSearchCategory {
  if (value === "all" || value === "housing") return "people";

  return unifiedSearchCategories.find((category) => category === value) ??
    "people";
}

export type UnifiedSearchScope =
  | { kind: "global_person"; userId: string }
  | { kind: "campus"; campusId: string }
  | { kind: "universities"; universityIds: readonly string[] }
  | { kind: "campus_network"; campusNetworkId: string };

export type UnifiedSearchCandidate = {
  id: string;
  title: string;
  subtitle: string;
  category: UnifiedSearchResultCategory;
  typeLabel: string;
  searchText: string;
  scope: UnifiedSearchScope;
  profileId?: string;
  detail?: UnifiedSearchDetail;
  tutoring?: boolean;
  tutoringSubjects?: readonly string[];
};

export type UnifiedSearchAccess = {
  configuredUniversityId: string | null;
  accessibleCampusIds: readonly string[];
  campusNetworkId: string | null;
  blockedUserIds: readonly string[];
  marketplaceAllowed: boolean;
};

function normalizedSearch(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function isUnifiedSearchCandidateVisible(
  candidate: UnifiedSearchCandidate,
  access: UnifiedSearchAccess,
) {
  if (candidate.scope.kind === "global_person") {
    return !access.blockedUserIds.includes(candidate.scope.userId);
  }

  if (!access.configuredUniversityId) return false;

  if (candidate.scope.kind === "campus") {
    return access.accessibleCampusIds.includes(candidate.scope.campusId);
  }

  if (candidate.scope.kind === "universities") {
    return candidate.scope.universityIds.includes(
      access.configuredUniversityId,
    );
  }

  return (
    access.marketplaceAllowed &&
    access.campusNetworkId !== null &&
    candidate.scope.campusNetworkId === access.campusNetworkId
  );
}

export function filterUnifiedSearchCandidates(
  candidates: readonly UnifiedSearchCandidate[],
  state: Pick<UnifiedSearchState, "category" | "query"> &
    Partial<Pick<UnifiedSearchState, "categoryFilters">>,
  access: UnifiedSearchAccess,
) {
  const normalizedQuery = normalizedSearch(state.query);
  const normalizedTutoringSubject = normalizedSearch(
    state.categoryFilters?.tutoringSubject ?? "",
  );

  return candidates.filter((candidate) => {
    if (!isUnifiedSearchCandidateVisible(candidate, access)) return false;

    const inCategory =
      state.category === "tutoring"
        ? candidate.category === "people" && candidate.tutoring === true
        : candidate.category === state.category;

    const inTutoringSubject =
      state.category !== "tutoring" ||
      !normalizedTutoringSubject ||
      candidate.tutoringSubjects?.some(
        (subject) =>
          normalizedSearch(subject) === normalizedTutoringSubject,
      );

    return (
      inCategory &&
      inTutoringSubject &&
      (!normalizedQuery || candidate.searchText.includes(normalizedQuery))
    );
  });
}

export function getUnifiedSearchCategoryCount(
  candidates: readonly UnifiedSearchCandidate[],
  category: UnifiedSearchCategory,
  access: UnifiedSearchAccess,
) {
  return filterUnifiedSearchCandidates(
    candidates,
    { category, query: "" },
    access,
  ).length;
}

export function openUnifiedSearchDetail(
  state: UnifiedSearchState,
  detail: UnifiedSearchDetail,
): UnifiedSearchState {
  return { ...state, history: [...state.history, detail] };
}

export function closeUnifiedSearchDetail(
  state: UnifiedSearchState,
): UnifiedSearchState {
  return { ...state, history: state.history.slice(0, -1) };
}

export function requestUnifiedSearchDismiss(
  state: UnifiedSearchState,
): { state: UnifiedSearchState; closeOverlay: boolean } {
  if (state.history.length === 0) {
    return { state, closeOverlay: true };
  }

  return {
    state: closeUnifiedSearchDetail(state),
    closeOverlay: false,
  };
}

export function currentUnifiedSearchDetail(
  state: UnifiedSearchState,
) {
  return state.history.at(-1) ?? null;
}

export function setUnifiedSearchCategory(
  state: UnifiedSearchState,
  category: UnifiedSearchCategory,
): UnifiedSearchState {
  return {
    ...state,
    category,
    history: [],
  };
}

export function getAnchoredSearchScrollY({
  currentScrollY,
  previousAnchorY,
  nextAnchorY,
}: {
  currentScrollY: number;
  previousAnchorY: number;
  nextAnchorY: number;
}) {
  const values = [currentScrollY, previousAnchorY, nextAnchorY];
  if (!values.every(Number.isFinite)) return Math.max(0, currentScrollY || 0);

  return Math.max(0, currentScrollY + nextAnchorY - previousAnchorY);
}
