"use client";

import { useState } from "react";

import { CampusDataDebugPanel } from "@/components/campus-data/CampusDataDebugPanel";
import { SourceBadge } from "@/components/campus-data/SourceBadge";
import { SearchableAutocomplete, type AutocompleteOption } from "@/components/search/SearchableAutocomplete";
import { developmentAliases, getAcademicCatalog } from "@/data/development/campusData";
import type { UniversityId, UniversityTheme } from "@/data/universities";
import { findProgramDuplicate, formatCourseLabel, getRecommendedCourses } from "@/lib/campus-data/search";
import { normalizeSearchText } from "@/lib/campus-data/normalization";
import type { AcademicEnrollment, AcademicProfile, CampusEntityType, CommunitySubmission } from "@/types/campus-data";

type Props = {
  universityId: UniversityId;
  theme: UniversityTheme;
  profile: AcademicProfile;
  submissions: CommunitySubmission[];
  onSetProgram: (programId: string | null, customProgram?: string | null) => void;
  onAddEnrollment: (enrollment: Omit<AcademicEnrollment, "id" | "createdAt" | "universityId">) => void;
  onRemoveEnrollment: (enrollmentId: string) => void;
  onSubmitMissing: (entityType: CampusEntityType, value: string) => CommunitySubmission | null;
};

const futureSections = [
  ["Study Groups", "Create and discover course-linked study sessions."],
  ["Classmates", "Classmate discovery will use verified enrollment later."],
  ["Professors", "Instructor profiles and reviews are ready for a future release."],
] as const;

export function AcademicHub({
  universityId, theme, profile, submissions, onSetProgram, onAddEnrollment, onRemoveEnrollment, onSubmitMissing,
}: Props) {
  const catalog = getAcademicCatalog(universityId);
  const [courseId, setCourseId] = useState("");
  const [termId, setTermId] = useState(catalog.terms[0]?.id ?? "");
  const [sectionId, setSectionId] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [customInstructor, setCustomInstructor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedProgram = catalog.programs.find((program) => program.id === profile.programId);
  const recommendedCourses = getRecommendedCourses(catalog, profile.programId);
  const recommendedIds = new Set(recommendedCourses.map((course) => course.id));
  const selectedCourse = catalog.courses.find((course) => course.id === courseId);
  const selectedTerm = catalog.terms.find((term) => term.id === termId);
  const currentTerm = catalog.terms.find((term) => term.id === profile.currentTermId);
  const sectionOptions = catalog.sections.filter((section) => section.courseId === courseId && section.termId === termId);
  const selectedSection = sectionOptions.find((section) => section.id === sectionId);
  const availableInstructors = selectedSection
    ? catalog.instructors.filter((instructor) => selectedSection.instructorIds.includes(instructor.id))
    : [];

  const programOptions: AutocompleteOption[] = catalog.programs.map((program) => ({
    id: program.id, label: `${program.name} (${program.degreeType})`, description: program.department,
    keywords: [program.name, program.degreeType, program.department, ...developmentAliases
      .filter((alias) => alias.universityId === universityId && alias.canonicalEntityId === program.id)
      .map((alias) => alias.aliasText)],
  }));
  const courseOptions: AutocompleteOption[] = [
    ...recommendedCourses,
    ...catalog.courses.filter((course) => !recommendedIds.has(course.id)),
  ].map((course) => ({
    id: course.id, label: formatCourseLabel(course),
    description: recommendedIds.has(course.id) ? "Recommended for your program" : course.department,
    rank: recommendedIds.has(course.id) ? 0 : 1,
    keywords: [course.subjectCode, course.courseNumber, course.title, course.department, ...developmentAliases
      .filter((alias) => alias.universityId === universityId && alias.canonicalEntityId === course.id)
      .map((alias) => alias.aliasText)],
  }));

  function submitMissing(entityType: CampusEntityType, value: string) {
    const submission = onSubmitMissing(entityType, value);
    if (submission) setNotice(`“${submission.submittedValue}” was saved as pending verification.`);
    return submission;
  }

  function addClass() {
    if (!selectedCourse || !selectedTerm) return;
    if (profile.enrollments.some((item) => item.courseId === selectedCourse.id && item.termId === selectedTerm.id)) {
      setNotice("That class is already in My Academics for this term."); return;
    }
    onAddEnrollment({
      courseId: selectedCourse.id, termId: selectedTerm.id, sectionId: selectedSection?.id ?? null,
      instructorId: instructorId || null, customInstructor,
    });
    setNotice(`${formatCourseLabel(selectedCourse)} was added to My Academics.`);
    setCourseId(""); setSectionId(""); setInstructorId(""); setCustomInstructor(null);
  }

  const localPendingCount = submissions.filter((item) => item.universityId === universityId).length;

  function exactOption(options: AutocompleteOption[], query: string) {
    const normalized = normalizeSearchText(query);
    return options.find((option) => [option.label, ...(option.keywords ?? [])]
      .some((value) => normalizeSearchText(value) === normalized));
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="p-6 text-white" style={{ backgroundColor: theme.primary }}>
          <p className="text-sm font-semibold opacity-80">Academic Hub</p>
          <h3 className="mt-1 text-3xl font-bold">Plan classes. Find your people.</h3>
          <p className="mt-2 max-w-2xl text-sm opacity-85">
            Your academic profile stays scoped to {theme.name}; switching schools does not mix catalogs or enrollment.
          </p>
        </div>
        <div className="p-5">
          <h3 className="mb-3 text-lg font-bold text-slate-950">My Academics</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Degree / Major" value={profile.customProgram ?? (selectedProgram ? `${selectedProgram.name} ${selectedProgram.degreeType}` : "Not selected")} />
          <Summary label="Current semester" value={currentTerm?.name ?? "Not selected"} />
          <Summary label="Current classes" value={String(profile.enrollments.length)} />
          <Summary label="Catalog status" value={catalog.courses.length ? "Development dataset" : "Awaiting source"} />
          </div>
        </div>
      </section>

      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <span>{notice}</span><button type="button" className="font-bold" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      <section id="degree-major" className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold" style={{ color: theme.primary }}>Degree / Major</p>
          <h3 className="text-xl font-bold text-slate-950">Set your academic program</h3>
          <p className="mt-1 text-sm text-slate-500">Aliases such as “CS” resolve to the university-scoped catalog record.</p>
        </div>
        <SearchableAutocomplete
          key={`program-${universityId}-${profile.programId}-${profile.customProgram}`}
          label="Search programs"
          placeholder={catalog.programs.length ? "Try Computer Science or CS" : "No imported programs yet — enter yours"}
          options={programOptions}
          value={profile.customProgram ?? (selectedProgram ? `${selectedProgram.name} (${selectedProgram.degreeType})` : "")}
          onSelect={(option) => { onSetProgram(option.id, null); setNotice("Academic program updated."); }}
          onOther={(query) => {
            const exact = exactOption(programOptions, query);
            if (exact) { onSetProgram(exact.id, null); setNotice(`Matched existing program: ${exact.label}.`); return; }
            const duplicate = findProgramDuplicate(catalog.programs, query);
            if (duplicate) { onSetProgram(duplicate.id, null); setNotice(`Matched existing program: ${duplicate.name}.`); return; }
            const submission = submitMissing("academic_program", query);
            if (submission) onSetProgram(null, submission.submittedValue);
          }}
        />
        {selectedProgram && <div className="mt-3 flex items-center gap-2"><SourceBadge value={selectedProgram} /><span className="text-xs text-slate-500">{selectedProgram.department}</span></div>}
      </section>

      <section id="add-class" className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold" style={{ color: theme.primary }}>Add Class</p>
          <h3 className="text-xl font-bold text-slate-950">Build your current schedule</h3>
          <p className="mt-1 text-sm text-slate-500">Recommended courses appear first, but the full scoped catalog remains searchable.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SearchableAutocomplete
            key={`course-${universityId}-${courseId}`}
            label="1. Course"
            placeholder={catalog.courses.length ? "Search code, number, or title" : "No imported courses yet — enter one"}
            options={courseOptions}
            onSelect={(option) => { setCourseId(option.id); setSectionId(""); setInstructorId(""); }}
            onOther={(query) => {
              const exact = exactOption(courseOptions, query);
              if (exact) { setCourseId(exact.id); setNotice(`Matched existing course: ${exact.label}.`); return; }
              submitMissing("course", query);
            }}
          />
          <SelectField label="2. Semester" value={termId} disabled={!courseId}
            options={catalog.terms.map((term) => ({ id: term.id, label: term.name }))}
            onChange={(value) => { setTermId(value); setSectionId(""); setInstructorId(""); }} />
          <SearchableAutocomplete
            key={`section-${universityId}-${courseId}-${termId}-${sectionId}`}
            label="3. Section"
            placeholder={sectionOptions.length ? "Search section number or meeting time" : "No imported sections — enter yours if known"}
            disabled={!courseId || !termId}
            options={sectionOptions.map((section) => ({
              id: section.id,
              label: `Section ${section.sectionNumber}`,
              description: `${section.days.join("/")} ${section.startTime ?? "TBA"} · ${section.location}`,
              keywords: [section.sectionNumber, section.days.join(" "), section.location],
            }))}
            onSelect={(option) => { setSectionId(option.id); setInstructorId(""); }}
            onOther={(query) => submitMissing("section", query)}
          />
          <SearchableAutocomplete
            key={`instructor-${universityId}-${sectionId}-${customInstructor ?? ""}`}
            label="4. Instructor"
            placeholder={selectedSection ? "Search assigned instructors" : "No assigned instructor data — enter a name"}
            disabled={!courseId || !termId}
            options={availableInstructors.map((instructor) => ({ id: instructor.id, label: instructor.displayName, description: instructor.department }))}
            value={customInstructor ?? ""}
            onSelect={(option) => { setInstructorId(option.id); setCustomInstructor(null); }}
            onOther={(query) => {
              const exact = exactOption(availableInstructors.map((instructor) => ({
                id: instructor.id, label: instructor.displayName, keywords: [instructor.department],
              })), query);
              if (exact) { setInstructorId(exact.id); setCustomInstructor(null); setNotice(`Matched existing instructor: ${exact.label}.`); return; }
              const submission = submitMissing("instructor", query);
              if (submission) { setCustomInstructor(submission.submittedValue); setInstructorId(""); }
            }}
          />
        </div>
        <button type="button" disabled={!courseId || !termId} onClick={addClass}
          className="mt-5 rounded-xl px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: theme.primary, color: theme.secondary }}>
          Add to My Academics
        </button>
      </section>

      <section id="classes" className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-slate-950">Classes</h3>
        <p className="mt-1 text-sm text-slate-500">Locally saved for this prototype.</p>
        <div className="mt-4 space-y-3">
          {profile.enrollments.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Add your first class above.</p>}
          {profile.enrollments.map((enrollment) => {
            const course = catalog.courses.find((item) => item.id === enrollment.courseId);
            const term = catalog.terms.find((item) => item.id === enrollment.termId);
            const section = catalog.sections.find((item) => item.id === enrollment.sectionId);
            const instructor = catalog.instructors.find((item) => item.id === enrollment.instructorId);
            if (!course) return null;
            return (
              <article key={enrollment.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{formatCourseLabel(course)}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {term?.name ?? "Term unavailable"}{section ? ` · Section ${section.sectionNumber}` : " · Section not selected"}
                    </p>
                    <p className="text-sm text-slate-500">{instructor?.displayName ?? enrollment.customInstructor ?? "Instructor not selected"}</p>
                    <p className="text-sm text-slate-500">
                      {section
                        ? `${section.days.join("/")} · ${section.startTime ?? "TBA"}–${section.endTime ?? "TBA"} · ${section.location}`
                        : "Meeting details not selected"}
                    </p>
                    <div className="mt-2"><SourceBadge value={course} /></div>
                  </div>
                  <button type="button" onClick={() => onRemoveEnrollment(enrollment.id)} className="text-sm font-semibold text-rose-700">Remove</button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Class Page", "Class Chat", "Study Groups", "Find Tutor"].map((label) => (
                    <button key={label} type="button" onClick={() => setNotice(`${label} is planned for a later release.`)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">{label}</button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {futureSections.map(([title, description]) => (
          <section key={title} id={title.toLowerCase().replace(" ", "-")} className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-950">{title}</h3><p className="mt-2 text-sm text-slate-500">{description}</p>
            <button type="button" onClick={() => setNotice(`${title} is planned for a later release.`)} className="mt-4 text-sm font-semibold" style={{ color: theme.primary }}>Preview soon →</button>
          </section>
        ))}
      </div>

      {process.env.NODE_ENV === "development" && <CampusDataDebugPanel universityId={universityId} localPendingCount={localPendingCount} />}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>;
}

function SelectField({ label, value, options, onChange, emptyLabel = "Select one", disabled }: {
  label: string; value: string; options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void; emptyLabel?: string; disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">{label}
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100">
        <option value="">{emptyLabel}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  );
}
