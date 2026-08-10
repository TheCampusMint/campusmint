import { universities, type UniversityId } from "@/data/universities";
import type {
  AcademicCatalog,
  AliasRecord,
  Building,
  CommunitySubmission,
  DataSource,
} from "@/types/campus-data";

import { blinnAcademicCatalog } from "./blinnAcademics";
import { tamuAcademicCatalog } from "./tamuAcademics";

const emptyCatalog: AcademicCatalog = {
  programs: [], courses: [], programRelations: [], terms: [], instructors: [], sections: [],
};

export const developmentCatalogs: Record<UniversityId, AcademicCatalog> = {
  tamu: tamuAcademicCatalog,
  blinn: blinnAcademicCatalog,
  texas: emptyCatalog,
  lsu: emptyCatalog,
  alabama: emptyCatalog,
};

export function getAcademicCatalog(universityId: UniversityId) {
  return developmentCatalogs[universityId] ?? emptyCatalog;
}

export const campusDataSources: DataSource[] = [
  {
    id: "10000000-0000-4000-8000-000000000020", universityId: "tamu",
    name: "Texas A&M Organization Directory (registered source)", type: "organizations",
    url: null, syncMethod: "manual", refreshInterval: "manual", enabled: false,
    adapterKey: "tamu-official-organizations", lastSuccessfulSync: null,
    notes: "Official source slot only. Configure a reviewed university API or data feed before enabling; random scraping is prohibited.",
    isDevelopment: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000021", universityId: "tamu",
    name: "Texas A&M Organizations Development Dataset", type: "organizations",
    url: null, syncMethod: "manual", refreshInterval: "manual", enabled: true,
    adapterKey: "tamu-development-organizations", lastSuccessfulSync: null,
    notes: "Synthetic organization records only. Never present as an official university directory.",
    isDevelopment: true,
  },
  {
    id: "20000000-0000-4000-8000-000000000020", universityId: "blinn",
    name: "Blinn Organization Directory (registered source)", type: "organizations",
    url: null, syncMethod: "manual", refreshInterval: "manual", enabled: false,
    adapterKey: "blinn-official-organizations", lastSuccessfulSync: null,
    notes: "Official source slot only. Configure a reviewed college API or data feed before enabling; random scraping is prohibited.",
    isDevelopment: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000021", universityId: "blinn",
    name: "Blinn Organizations Development Dataset", type: "organizations",
    url: null, syncMethod: "manual", refreshInterval: "manual", enabled: true,
    adapterKey: "blinn-development-organizations", lastSuccessfulSync: null,
    notes: "Synthetic organization records only. Never present as an official college directory.",
    isDevelopment: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000010", universityId: "tamu",
    name: "Texas A&M Dining Services", type: "dining",
    url: "https://www.tamu.edu/campus-community/dining.html", syncMethod: "html",
    refreshInterval: "daily", enabled: false, adapterKey: "tamu-official-dining",
    lastSuccessfulSync: null,
    notes: "Official source registered; automatic import is disabled until its location/menu parser is reviewed.",
    isDevelopment: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000011", universityId: "tamu",
    name: "Texas A&M Residence Life", type: "housing",
    url: "https://reslife.tamu.edu/housing-options/", syncMethod: "html",
    refreshInterval: "weekly", enabled: false, adapterKey: "tamu-official-housing",
    lastSuccessfulSync: null,
    notes: "Official source registered; automatic import is disabled until its housing parser is reviewed.",
    isDevelopment: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000010", universityId: "blinn",
    name: "Blinn College Food Services", type: "dining",
    url: "https://www.blinn.edu/food-services/index.html", syncMethod: "html",
    refreshInterval: "daily", enabled: false, adapterKey: "blinn-official-dining",
    lastSuccessfulSync: null,
    notes: "Official source registered; automatic import is disabled until its location/menu parser is reviewed.",
    isDevelopment: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000011", universityId: "blinn",
    name: "Blinn Brenham Housing and Residence Life", type: "housing",
    url: "https://www2.blinn.edu/housing/index.html", syncMethod: "html",
    refreshInterval: "weekly", enabled: false, adapterKey: "blinn-official-housing",
    lastSuccessfulSync: null,
    notes: "Official source registered; automatic import is disabled until its housing parser is reviewed.",
    isDevelopment: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000012", universityId: "tamu",
    name: "Google Places API (New)", type: "dining",
    url: "https://developers.google.com/maps/documentation/places/web-service/overview", syncMethod: "api",
    refreshInterval: "manual", enabled: false, adapterKey: "google-places",
    lastSuccessfulSync: null,
    notes: "Dynamic server-side provider. Store place IDs only; do not cache restricted Places content.",
    isDevelopment: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000012", universityId: "blinn",
    name: "Google Places API (New)", type: "dining",
    url: "https://developers.google.com/maps/documentation/places/web-service/overview", syncMethod: "api",
    refreshInterval: "manual", enabled: false, adapterKey: "google-places",
    lastSuccessfulSync: null,
    notes: "Dynamic server-side provider. Store place IDs only; do not cache restricted Places content.",
    isDevelopment: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000001", universityId: "tamu",
    name: "Texas A&M Undergraduate Catalog", type: "course_catalog",
    url: "https://catalog.tamu.edu/undergraduate/course-descriptions/", syncMethod: "html",
    refreshInterval: "weekly", enabled: false, adapterKey: "tamu-official-catalog",
    lastSuccessfulSync: null,
    notes: "Registered official source. Automatic import is disabled until a reviewed parser and usage policy are approved.",
    isDevelopment: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000002", universityId: "tamu",
    name: "Texas A&M Academic Programs", type: "academic_catalog",
    url: "https://www.tamu.edu/academics/programs/index.html", syncMethod: "html",
    refreshInterval: "weekly", enabled: false, adapterKey: "tamu-official-programs",
    lastSuccessfulSync: null,
    notes: "Registered official source; disabled pending a safe program importer.", isDevelopment: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000003", universityId: "tamu",
    name: "Texas A&M Representative Development Dataset", type: "manual", url: null,
    syncMethod: "manual", refreshInterval: "manual", enabled: true,
    adapterKey: "tamu-development-academics", lastSuccessfulSync: null,
    notes: "Synthetic representative data only. Never present as official catalog data.", isDevelopment: true,
  },
  {
    id: "20000000-0000-4000-8000-000000000001", universityId: "blinn",
    name: "Blinn College Academic Affairs", type: "academic_catalog",
    url: "https://www.blinn.edu/academics/index.html", syncMethod: "html",
    refreshInterval: "weekly", enabled: false, adapterKey: "blinn-official-academics",
    lastSuccessfulSync: null,
    notes: "Registered official source; disabled pending a safe catalog importer.", isDevelopment: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000002", universityId: "blinn",
    name: "Blinn Representative Development Dataset", type: "manual", url: null,
    syncMethod: "manual", refreshInterval: "manual", enabled: true,
    adapterKey: "blinn-development-academics", lastSuccessfulSync: null,
    notes: "Synthetic representative data only. Never present as official catalog data.", isDevelopment: true,
  },
];

const aliases: Array<[string, string, AliasRecord["entityType"], string, string, string]> = [
  ["a1000000-0000-4000-8000-000000000001", "tamu", "academic_program", "CS", "Computer Science", tamuAcademicCatalog.programs[0].id],
  ["a1000000-0000-4000-8000-000000000002", "tamu", "academic_program", "Comp Sci", "Computer Science", tamuAcademicCatalog.programs[0].id],
  ["a1000000-0000-4000-8000-000000000003", "tamu", "course", "Intro Programming", "CSCE 120 — Program Design and Concepts", tamuAcademicCatalog.courses[0].id],
  ["a2000000-0000-4000-8000-000000000001", "blinn", "academic_program", "CS", "Computer Science", blinnAcademicCatalog.programs[0].id],
  ["a2000000-0000-4000-8000-000000000002", "blinn", "course", "Intro Programming", "COSC 1436 — Programming Fundamentals I", blinnAcademicCatalog.courses[0].id],
];

export const developmentAliases: AliasRecord[] = aliases.map(
  ([id, universityId, entityType, aliasText, canonicalLabel, canonicalEntityId]) => ({
    id, universityId, entityType, aliasText,
    normalizedAlias: aliasText.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    canonicalEntityId, canonicalLabel, confidenceLevel: "pending",
  }),
);

export const developmentBuildings: Building[] = [
  {
    id: "b1000000-0000-4000-8000-000000000001", universityId: "tamu",
    externalId: "dev-tamu-future-study-center", entityType: "building",
    name: "Future Study Center (Development Example)",
    description: "A planned-building example used to test lifecycle status handling.",
    status: "planned", address: null, buildingCode: null, expectedOpening: "2028-08-01",
    openedOn: null, closedOn: null, sourceId: "10000000-0000-4000-8000-000000000003",
    sourceUrl: null, sourceType: "development_seed", confidenceLevel: "pending",
    effectiveFrom: "2026-08-01", effectiveUntil: null, lastVerifiedAt: null, isDevelopment: true,
  },
];

export const initialCommunitySubmissions: CommunitySubmission[] = [];

export function getCampusDataSources(universityId: UniversityId) {
  return campusDataSources.filter((source) => source.universityId === universityId);
}

export function getCampusDataCounts(universityId: UniversityId, pendingCount = 0) {
  const catalog = getAcademicCatalog(universityId);
  return {
    programs: catalog.programs.length, courses: catalog.courses.length,
    instructors: catalog.instructors.length, sections: catalog.sections.length,
    buildings: developmentBuildings.filter((item) => item.universityId === universityId).length,
    pendingSubmissions: initialCommunitySubmissions.filter((item) => item.universityId === universityId).length + pendingCount,
  };
}

export const registeredUniversityNames = Object.fromEntries(
  Object.entries(universities).map(([id, university]) => [id, university.name]),
);
