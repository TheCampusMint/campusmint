import {
  migrateStoredPrimarySection,
  type SwipeSection,
} from "../../components/shell/navigation.ts";
import {
  initialUnifiedSearchState,
  migrateUnifiedSearchCategory,
  type UnifiedSearchDetail,
  type UnifiedSearchState,
} from "../search/unifiedSearch.ts";

export type CampusAppLocation =
  | { kind: "section"; section: SwipeSection }
  | {
      kind: "profile";
      profileUserId: string;
      returnSection: SwipeSection;
    }
  | {
      kind: "search";
      returnSection: SwipeSection;
      searchState: UnifiedSearchState;
    };

type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function valuesFor(input: SearchParamsInput, key: string) {
  if (input instanceof URLSearchParams) return input.getAll(key);
  const value = input[key];
  return Array.isArray(value) ? value : value ? [value] : [];
}

function firstValue(input: SearchParamsInput, key: string) {
  return valuesFor(input, key)[0] ?? null;
}

function safeText(value: unknown, maxLength = 160) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
    ? value
    : null;
}

function parseSearchDetail(value: string): UnifiedSearchDetail | null {
  try {
    const candidate = JSON.parse(value) as Record<string, unknown>;
    const kind = candidate.kind;
    const id = safeText(candidate.id);
    if (!id) return null;

    if (kind === "food" || kind === "event" || kind === "profile") {
      return { kind, id };
    }

    if (kind === "event_moment") {
      const eventId = safeText(candidate.eventId);
      return eventId ? { kind, id, eventId } : null;
    }

    if (kind === "marketplace") {
      const panel = candidate.panel;
      return panel === undefined || panel === "none" || panel === "offer" || panel === "message" || panel === "report"
        ? { kind, id, ...(panel ? { panel } : {}) }
        : null;
    }
  } catch {
    return null;
  }

  return null;
}

export function parseCampusAppLocation(
  input: SearchParamsInput,
): CampusAppLocation {
  const fallbackSection = migrateStoredPrimarySection(
    firstValue(input, "section"),
  );
  const view = firstValue(input, "view");

  if (view === "profile") {
    const profileUserId = safeText(firstValue(input, "profile"));
    if (profileUserId) {
      return {
        kind: "profile",
        profileUserId,
        returnSection: migrateStoredPrimarySection(
          firstValue(input, "from"),
          fallbackSection,
        ),
      };
    }
  }

  if (view === "search") {
    const query = firstValue(input, "q")?.slice(0, 200) ?? "";
    const history = valuesFor(input, "detail")
      .slice(0, 8)
      .flatMap((value) => {
        const detail = parseSearchDetail(value);
        return detail ? [detail] : [];
      });

    return {
      kind: "search",
      returnSection: migrateStoredPrimarySection(
        firstValue(input, "from"),
        fallbackSection,
      ),
      searchState: {
        ...initialUnifiedSearchState,
        category: migrateUnifiedSearchCategory(firstValue(input, "category")),
        query,
        history,
      },
    };
  }

  return { kind: "section", section: fallbackSection };
}

export function mainSectionUrl(section: SwipeSection) {
  return section === "mint" ? "/" : `/?section=${encodeURIComponent(section)}`;
}

export function profileUrl(
  profileUserId: string,
  returnSection: SwipeSection,
) {
  const params = new URLSearchParams({
    view: "profile",
    profile: profileUserId,
    from: returnSection,
  });
  return `/?${params.toString()}`;
}

export function searchUrl(
  searchState: UnifiedSearchState,
  returnSection: SwipeSection,
) {
  const params = new URLSearchParams({
    view: "search",
    from: returnSection,
    category: searchState.category,
  });
  if (searchState.query) params.set("q", searchState.query);
  searchState.history.slice(0, 8).forEach((detail) => {
    params.append("detail", JSON.stringify(detail));
  });
  return `/?${params.toString()}`;
}
