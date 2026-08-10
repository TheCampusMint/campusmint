import type { SourceAdapter } from "@/lib/sync/types";

export function createRegisteredOfficialAdapter(key: string, universityName: string): SourceAdapter {
  return {
    key,
    async load(source) {
      throw new Error(
        `${universityName}: ${source.name} is registered but intentionally disabled. Review source policy and implement the source-specific parser before importing.`,
      );
    },
  };
}
