import type { UniversityTheme } from "@/data/universities";
import {
  storyFilterOptions,
  type StoryFilter,
} from "@/types/story";

type StoryFiltersProps = {
  activeFilter: StoryFilter;
  theme: UniversityTheme;
  onFilterChange: (filter: StoryFilter) => void;
};

export function StoryFilters({
  activeFilter,
  theme,
  onFilterChange,
}: StoryFiltersProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      role="group"
      aria-label="Filter campus stories"
    >
      {storyFilterOptions.map((filter) => {
        const isActive = activeFilter === filter;

        return (
          <button
            key={filter}
            type="button"
            aria-pressed={isActive}
            onClick={() => onFilterChange(filter)}
            className="shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: isActive ? theme.primary : "#ffffff",
              borderColor: isActive ? theme.primary : "#cbd5e1",
              color: isActive ? theme.secondary : "#475569",
              outlineColor: theme.primary,
            }}
          >
            {filter}
          </button>
        );
      })}
    </div>
  );
}
