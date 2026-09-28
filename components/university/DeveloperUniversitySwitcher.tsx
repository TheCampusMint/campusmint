"use client";

import {
  configuredUniversityIds,
  universities,
  type UniversityId,
} from "@/data/universities";

type DeveloperUniversitySwitcherProps = {
  selectedUniversityId: UniversityId | null;
  onUniversityChange: (universityId: UniversityId | null) => void;
  label?: string;
};

export function DeveloperUniversitySwitcher({
  selectedUniversityId,
  onUniversityChange,
  label = "Preview campus",
}: DeveloperUniversitySwitcherProps) {
  return (
    <label
      className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-[var(--app-text-secondary)]"
    >
      <span className="opacity-85">{label}</span>
      <select
        value={selectedUniversityId ?? ""}
        onChange={(event) =>
          onUniversityChange(event.target.value ? event.target.value as UniversityId : null)
        }
        className="w-72 max-w-full rounded-2xl border-0 bg-[var(--app-surface-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--app-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
      >
        <option value="">Use my campus</option>
        {configuredUniversityIds.map((universityId) => (
          <option key={universityId} value={universityId}>
            {universities[universityId].name}
          </option>
        ))}
      </select>
    </label>
  );
}
