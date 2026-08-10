import type {
  AcademicCatalog,
  AcademicProgram,
  AcademicTerm,
  Course,
  CourseProgramRelation,
  CourseSection,
  Instructor,
  ProvenanceMetadata,
} from "@/types/campus-data";

const sourceId = "20000000-0000-4000-8000-000000000002";
const provenance: ProvenanceMetadata = {
  sourceId,
  sourceUrl: null,
  sourceType: "development_seed",
  confidenceLevel: "pending",
  effectiveFrom: "2026-08-01",
  effectiveUntil: null,
  lastVerifiedAt: null,
  isDevelopment: true,
};

export const blinnPrograms: AcademicProgram[] = [
  ["31000000-0000-4000-8000-000000000001", "Computer Science", "AS", "Engineering, Computer Technology, and Innovation"],
  ["31000000-0000-4000-8000-000000000002", "Biology", "AS", "Natural and Physical Sciences"],
  ["31000000-0000-4000-8000-000000000003", "Business", "AA", "Business and Mathematics"],
  ["31000000-0000-4000-8000-000000000004", "Liberal Arts", "AA", "Humanities"],
].map(([id, name, degreeType, department], index) => ({
  ...provenance,
  id,
  universityId: "blinn",
  externalId: `dev-blinn-program-${index + 1}`,
  name,
  degreeType,
  department,
  description: "Representative development program for Academic Hub testing.",
  status: "active",
}));

export const blinnCourses: Course[] = [
  ["41000000-0000-4000-8000-000000000001", "COSC", "1436", "Programming Fundamentals I", 4, "Computer Science"],
  ["41000000-0000-4000-8000-000000000002", "COSC", "1437", "Programming Fundamentals II", 4, "Computer Science"],
  ["41000000-0000-4000-8000-000000000003", "MATH", "2413", "Calculus I", 4, "Mathematics"],
  ["41000000-0000-4000-8000-000000000004", "BIOL", "1406", "Biology for Science Majors I", 4, "Biology"],
  ["41000000-0000-4000-8000-000000000005", "ENGL", "1301", "Composition I", 3, "English"],
].map(([id, subjectCode, courseNumber, title, creditHours, department], index) => ({
  ...provenance,
  id: id as string,
  universityId: "blinn",
  externalId: `dev-blinn-course-${index + 1}`,
  subjectCode: subjectCode as string,
  courseNumber: courseNumber as string,
  title: title as string,
  description: "Representative development course for Academic Hub testing.",
  creditHours: creditHours as number,
  department: department as string,
  status: "active" as const,
}));

export const blinnProgramRelations: CourseProgramRelation[] = [
  ["91000000-0000-4000-8000-000000000001", 0, 0, "required", 1],
  ["91000000-0000-4000-8000-000000000002", 0, 1, "required", 2],
  ["91000000-0000-4000-8000-000000000003", 0, 2, "core", 1],
  ["91000000-0000-4000-8000-000000000004", 1, 3, "required", 1],
  ["91000000-0000-4000-8000-000000000005", 3, 4, "core", 1],
].map(([id, programIndex, courseIndex, relationType, recommendedTerm]) => ({
  ...provenance,
  id: id as string,
  universityId: "blinn",
  programId: blinnPrograms[programIndex as number].id,
  courseId: blinnCourses[courseIndex as number].id,
  relationType: relationType as CourseProgramRelation["relationType"],
  recommendedTerm: recommendedTerm as number,
  notes: "Development-only recommendation relationship.",
}));

export const blinnTerms: AcademicTerm[] = [
  {
    ...provenance,
    id: "51000000-0000-4000-8000-000000000001",
    universityId: "blinn",
    externalId: "dev-blinn-2026-fall",
    code: "2026-FALL",
    name: "Fall 2026",
    startsOn: "2026-08-24",
    endsOn: "2026-12-16",
    registrationStatus: "open",
  },
  {
    ...provenance,
    id: "51000000-0000-4000-8000-000000000002",
    universityId: "blinn",
    externalId: "dev-blinn-2027-spring",
    code: "2027-SPRING",
    name: "Spring 2027",
    startsOn: "2027-01-19",
    endsOn: "2027-05-11",
    registrationStatus: "upcoming",
  },
];

export const blinnInstructors: Instructor[] = [
  ["61000000-0000-4000-8000-000000000001", "Prof. Avery Brooks", "Computer Science"],
  ["61000000-0000-4000-8000-000000000002", "Dr. Jordan Lee", "Biology"],
].map(([id, displayName, department], index) => ({
  ...provenance,
  id,
  universityId: "blinn",
  externalId: `dev-blinn-instructor-${index + 1}`,
  displayName,
  department,
  title: "Development Instructor",
  status: "active",
}));

export const blinnSections: CourseSection[] = [
  {
    ...provenance,
    id: "71000000-0000-4000-8000-000000000001",
    universityId: "blinn",
    externalId: "dev-blinn-cosc1436-001",
    courseId: blinnCourses[0].id,
    termId: blinnTerms[0].id,
    sectionNumber: "001",
    instructorIds: [blinnInstructors[0].id],
    days: ["Mon", "Wed"],
    startTime: "10:35",
    endTime: "11:50",
    location: "Development classroom B-214",
    modality: "in_person",
    status: "scheduled",
  },
  {
    ...provenance,
    id: "71000000-0000-4000-8000-000000000002",
    universityId: "blinn",
    externalId: "dev-blinn-biol1406-002",
    courseId: blinnCourses[3].id,
    termId: blinnTerms[0].id,
    sectionNumber: "002",
    instructorIds: [blinnInstructors[1].id],
    days: ["Tue", "Thu"],
    startTime: "09:10",
    endTime: "10:25",
    location: "Development classroom S-108",
    modality: "in_person",
    status: "scheduled",
  },
];

export const blinnAcademicCatalog: AcademicCatalog = {
  programs: blinnPrograms,
  courses: blinnCourses,
  programRelations: blinnProgramRelations,
  terms: blinnTerms,
  instructors: blinnInstructors,
  sections: blinnSections,
};
