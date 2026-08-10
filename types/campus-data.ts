export type DataConfidenceLevel =
  | "official"
  | "community_verified"
  | "pending";

export type RecordSourceType =
  | "official_source"
  | "community_submission"
  | "development_seed"
  | "manual";

export type SyncMethod = "api" | "rss" | "json" | "csv" | "html" | "manual";
export type RefreshInterval = "hourly" | "daily" | "weekly" | "manual";
export type DataSourceKind =
  | "academic_catalog"
  | "course_catalog"
  | "faculty_directory"
  | "campus_facilities"
  | "dining"
  | "events"
  | "transportation"
  | "housing"
  | "organizations"
  | "manual";

export type ProgramStatus = "active" | "upcoming" | "discontinued" | "archived";
export type CourseStatus = "active" | "upcoming" | "discontinued" | "archived";
export type SectionStatus = "scheduled" | "cancelled" | "completed" | "archived";
export type BuildingStatus =
  | "planned"
  | "under_construction"
  | "open"
  | "temporarily_closed"
  | "closed"
  | "demolished";
export type CourseProgramRelationType =
  | "required"
  | "core"
  | "recommended"
  | "elective"
  | "prerequisite_related"
  | "commonly_taken";
export type CommunitySubmissionStatus =
  | "pending"
  | "community_verified"
  | "rejected"
  | "accepted_as_official";

export type CampusEntityType =
  | "academic_program"
  | "course"
  | "instructor"
  | "section"
  | "building"
  | "dorm"
  | "dining_location"
  | "club"
  | "apartment"
  | "campus_entity";

export type ProvenanceMetadata = {
  sourceId: string | null;
  sourceUrl: string | null;
  sourceType: RecordSourceType;
  confidenceLevel: DataConfidenceLevel;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  lastVerifiedAt: string | null;
  isDevelopment: boolean;
};

export type AcademicProgram = ProvenanceMetadata & {
  id: string;
  universityId: string;
  externalId: string;
  name: string;
  degreeType: string;
  department: string;
  description: string;
  status: ProgramStatus;
};

export type Course = ProvenanceMetadata & {
  id: string;
  universityId: string;
  externalId: string;
  subjectCode: string;
  courseNumber: string;
  title: string;
  description: string;
  creditHours: number;
  department: string;
  status: CourseStatus;
};

export type CourseProgramRelation = ProvenanceMetadata & {
  id: string;
  universityId: string;
  programId: string;
  courseId: string;
  relationType: CourseProgramRelationType;
  recommendedTerm: number | null;
  notes: string | null;
};

export type AcademicTerm = ProvenanceMetadata & {
  id: string;
  universityId: string;
  externalId: string;
  code: string;
  name: string;
  startsOn: string;
  endsOn: string;
  registrationStatus: "upcoming" | "open" | "closed" | "completed";
};

export type Instructor = ProvenanceMetadata & {
  id: string;
  universityId: string;
  externalId: string;
  displayName: string;
  department: string;
  title: string;
  status: "active" | "inactive" | "archived";
};

export type CourseSection = ProvenanceMetadata & {
  id: string;
  universityId: string;
  externalId: string;
  courseId: string;
  termId: string;
  sectionNumber: string;
  instructorIds: string[];
  days: string[];
  startTime: string | null;
  endTime: string | null;
  location: string;
  modality: "in_person" | "online" | "hybrid";
  status: SectionStatus;
};

export type CampusEntity = ProvenanceMetadata & {
  id: string;
  universityId: string;
  externalId: string;
  entityType: string;
  name: string;
  description: string;
  status: BuildingStatus;
  address: string | null;
};

export type Building = CampusEntity & {
  buildingCode: string | null;
  expectedOpening: string | null;
  openedOn: string | null;
  closedOn: string | null;
};

export type DataSource = {
  id: string;
  universityId: string;
  name: string;
  type: DataSourceKind;
  url: string | null;
  syncMethod: SyncMethod;
  refreshInterval: RefreshInterval;
  enabled: boolean;
  adapterKey: string;
  lastSuccessfulSync: string | null;
  notes: string;
  isDevelopment: boolean;
};

export type AliasRecord = {
  id: string;
  universityId: string;
  entityType: CampusEntityType;
  aliasText: string;
  normalizedAlias: string;
  canonicalEntityId: string;
  canonicalLabel: string;
  confidenceLevel: DataConfidenceLevel;
};

export type CommunitySubmission = {
  id: string;
  universityId: string;
  entityType: CampusEntityType;
  submittedValue: string;
  normalizedValue: string;
  confirmationCount: number;
  status: CommunitySubmissionStatus;
  confidenceLevel: DataConfidenceLevel;
  createdAt: string;
};

export type DataChangeEvent = {
  id: string;
  universityId: string;
  sourceId: string | null;
  syncRunId: string | null;
  entityType: string;
  entityId: string;
  changeType: "created" | "updated" | "archived" | "status_changed";
  previousValue: Record<string, unknown> | null;
  nextValue: Record<string, unknown> | null;
  meaningful: boolean;
  occurredAt: string;
};

export type AcademicCatalog = {
  programs: AcademicProgram[];
  courses: Course[];
  programRelations: CourseProgramRelation[];
  terms: AcademicTerm[];
  instructors: Instructor[];
  sections: CourseSection[];
};

export type AcademicEnrollment = {
  id: string;
  universityId: string;
  courseId: string;
  termId: string;
  sectionId: string | null;
  instructorId: string | null;
  customInstructor: string | null;
  createdAt: string;
};

export type AcademicProfile = {
  universityId: string;
  programId: string | null;
  customProgram: string | null;
  currentTermId: string | null;
  enrollments: AcademicEnrollment[];
};

export type CampusDataCounts = {
  programs: number;
  courses: number;
  instructors: number;
  sections: number;
  buildings: number;
  pendingSubmissions: number;
};
