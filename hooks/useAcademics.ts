"use client";

import { useState } from "react";

import { getAcademicCatalog } from "@/data/development/campusData";
import type { UniversityId } from "@/data/universities";
import { normalizeSearchText, normalizeSubmissionDisplay } from "@/lib/campus-data/normalization";
import type { AcademicEnrollment, AcademicProfile, CampusEntityType, CommunitySubmission } from "@/types/campus-data";

function initialProfile(universityId: UniversityId): AcademicProfile {
  const catalog = getAcademicCatalog(universityId);
  return {
    universityId,
    programId: catalog.programs[0]?.id ?? null,
    customProgram: null,
    currentTermId: catalog.terms[0]?.id ?? null,
    enrollments: catalog.sections[0] ? [{
      id: `local-${universityId}-enrollment-1`, universityId,
      courseId: catalog.sections[0].courseId, termId: catalog.sections[0].termId,
      sectionId: catalog.sections[0].id, instructorId: catalog.sections[0].instructorIds[0] ?? null,
      customInstructor: null, createdAt: "2026-08-08T12:00:00.000Z",
    }] : [],
  };
}

export function useAcademics() {
  const [profiles, setProfiles] = useState<Record<UniversityId, AcademicProfile>>(() => ({
    tamu: initialProfile("tamu"), blinn: initialProfile("blinn"), texas: initialProfile("texas"),
    lsu: initialProfile("lsu"), alabama: initialProfile("alabama"),
  }));
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);

  function setProgram(universityId: UniversityId, programId: string | null, customProgram: string | null = null) {
    setProfiles((current) => ({ ...current, [universityId]: { ...current[universityId], programId, customProgram } }));
  }

  function addEnrollment(universityId: UniversityId, enrollment: Omit<AcademicEnrollment, "id" | "createdAt" | "universityId">) {
    setProfiles((current) => ({
      ...current,
      [universityId]: {
        ...current[universityId],
        enrollments: [...current[universityId].enrollments, {
          ...enrollment, universityId, id: crypto.randomUUID(), createdAt: new Date().toISOString(),
        }],
      },
    }));
  }

  function removeEnrollment(universityId: UniversityId, enrollmentId: string) {
    setProfiles((current) => ({ ...current, [universityId]: {
      ...current[universityId],
      enrollments: current[universityId].enrollments.filter((item) => item.id !== enrollmentId),
    } }));
  }

  function submitMissing(universityId: UniversityId, entityType: CampusEntityType, rawValue: string) {
    const submittedValue = normalizeSubmissionDisplay(rawValue);
    if (!submittedValue) return null;
    const existing = submissions.find((item) => item.universityId === universityId
      && item.entityType === entityType && item.normalizedValue === normalizeSearchText(submittedValue));
    if (existing) {
      setSubmissions((current) => current.map((item) => item.id === existing.id
        ? { ...item, confirmationCount: item.confirmationCount + 1 } : item));
      return existing;
    }
    const submission: CommunitySubmission = {
      id: crypto.randomUUID(), universityId, entityType, submittedValue,
      normalizedValue: normalizeSearchText(submittedValue), confirmationCount: 1,
      status: "pending", confidenceLevel: "pending", createdAt: new Date().toISOString(),
    };
    setSubmissions((current) => [...current, submission]);
    return submission;
  }

  return { profiles, submissions, setProgram, addEnrollment, removeEnrollment, submitMissing };
}
