"use client";

import {
  configuredUniversityIds,
  universities,
  type UniversityId,
} from "@/data/universities";

type DeveloperUniversitySwitcherProps = {
  selectedUniversityId: UniversityId;
  onUniversityChange: (universityId: UniversityId) => void;
};

export function DeveloperUniversitySwitcher({
  selectedUniversityId,
  onUniversityChange,
}: DeveloperUniversitySwitcherProps) {
  const selectedTheme = universities[selectedUniversityId];

  return (
    <label
      className="flex min-w-0 flex-col gap-1 text-xs font-semibold"
      style={{ color: selectedTheme.secondary }}
    >
      <span className="opacity-85">Dev: Switch campus</span>
      <select
        value={selectedUniversityId}
        onChange={(event) =>
          onUniversityChange(event.target.value as UniversityId)
        }
        className="w-64 max-w-full rounded-xl border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          backgroundColor: selectedTheme.secondary,
          borderColor: selectedTheme.secondary,
          color: selectedTheme.primary,
          outlineColor: selectedTheme.secondary,
        }}
      >
        {configuredUniversityIds.map((universityId) => (
          <option key={universityId} value={universityId}>
            {universities[universityId].name}
          </option>
        ))}
      </select>
    </label>
  );
}
