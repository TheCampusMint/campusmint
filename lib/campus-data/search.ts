import { developmentAliases } from "@/data/development/campusData";
import { normalizeSearchText, searchScore } from "@/lib/campus-data/normalization";
import type { AcademicCatalog, AcademicProgram, Course, Instructor } from "@/types/campus-data";

function aliasValues(universityId: string, entityId: string) {
  return developmentAliases
    .filter((alias) => alias.universityId === universityId && alias.canonicalEntityId === entityId)
    .map((alias) => alias.aliasText);
}

export function formatCourseLabel(course: Course) {
  return `${course.subjectCode} ${course.courseNumber} — ${course.title}`;
}

export function searchPrograms(catalog: AcademicCatalog, universityId: string, query: string, limit = 20) {
  return catalog.programs
    .map((program) => ({
      item: program,
      score: searchScore(query, [program.name, program.degreeType, program.department, ...aliasValues(universityId, program.id)]),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map(({ item }) => item);
}

export function searchCourses(catalog: AcademicCatalog, universityId: string, query: string, limit = 20) {
  return catalog.courses
    .map((course) => ({
      item: course,
      score: searchScore(query, [formatCourseLabel(course), course.title, course.department, ...aliasValues(universityId, course.id)]),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || formatCourseLabel(a.item).localeCompare(formatCourseLabel(b.item)))
    .slice(0, limit)
    .map(({ item }) => item);
}

export function searchInstructors(instructors: Instructor[], query: string, limit = 20) {
  return instructors
    .map((instructor) => ({ item: instructor, score: searchScore(query, [instructor.displayName, instructor.department]) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.displayName.localeCompare(b.item.displayName))
    .slice(0, limit)
    .map(({ item }) => item);
}

export function getRecommendedCourses(catalog: AcademicCatalog, programId: string | null) {
  if (!programId) return [];
  const ranked = new Map(catalog.programRelations
    .filter((relation) => relation.programId === programId)
    .map((relation) => [relation.courseId, relation.recommendedTerm ?? 99]));
  return catalog.courses
    .filter((course) => ranked.has(course.id))
    .sort((a, b) => (ranked.get(a.id) ?? 99) - (ranked.get(b.id) ?? 99));
}

export function findProgramDuplicate(programs: AcademicProgram[], value: string) {
  const normalized = normalizeSearchText(value);
  return programs.find((program) => normalizeSearchText(program.name) === normalized) ?? null;
}
