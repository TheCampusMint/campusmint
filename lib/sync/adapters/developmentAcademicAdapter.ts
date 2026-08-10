import { getAcademicCatalog } from "@/data/development/campusData";
import type { UniversityId } from "@/data/universities";
import { normalizeIncomingRecord } from "@/lib/sync/normalize";
import type { SourceAdapter, SyncEntityType } from "@/lib/sync/types";

const collections: Array<[SyncEntityType, "programs" | "courses" | "terms" | "instructors" | "sections"]> = [
  ["academic_program", "programs"], ["course", "courses"], ["academic_term", "terms"],
  ["instructor", "instructors"], ["course_section", "sections"],
];

export const developmentAcademicAdapter: SourceAdapter = {
  key: "development-academics",
  async load(source) {
    const catalog = getAcademicCatalog(source.universityId as UniversityId);
    return collections.flatMap(([entityType, key]) =>
      catalog[key].map((item) => normalizeIncomingRecord(entityType, source.universityId, item.externalId, item)),
    );
  },
};
