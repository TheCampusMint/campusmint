"use client";

import { useState } from "react";

import { normalizeSearchText, normalizeSubmissionDisplay } from "@/lib/campus-data/normalization";
import type {
  NewOrganizationSubmission,
  Organization,
  OrganizationMembership,
  OrganizationMembershipStatus,
  OrganizationSubmission,
} from "@/types/organization";

export function useOrganizations() {
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [submissions, setSubmissions] = useState<OrganizationSubmission[]>([]);

  function getMembershipStatus(organizationId: string): OrganizationMembershipStatus {
    return memberships.find((membership) => membership.organizationId === organizationId)?.status ?? "none";
  }

  function joinOrRequest(organization: Organization) {
    if (organization.membershipType === "invitation" || organization.membershipType === "restricted") return null;
    const status: OrganizationMembership["status"] = organization.membershipType === "open" ? "member" : "requested";
    const now = new Date().toISOString();
    const existing = memberships.find((membership) => membership.organizationId === organization.id);
    const membership: OrganizationMembership = existing
      ? { ...existing, status, updatedAt: now }
      : { id: crypto.randomUUID(), organizationId: organization.id, status, createdAt: now, updatedAt: now };
    setMemberships((current) => existing
      ? current.map((item) => item.id === existing.id ? membership : item)
      : [...current, membership]);
    return membership;
  }

  function leaveOrganization(organizationId: string) {
    setMemberships((current) => current.filter((membership) => membership.organizationId !== organizationId));
  }

  function submitOrganization(input: NewOrganizationSubmission) {
    const name = normalizeSubmissionDisplay(input.name);
    if (!name) return null;
    const normalizedName = normalizeSearchText(name);
    const existing = submissions.find((submission) =>
      submission.universityId === input.universityId && normalizeSearchText(submission.name) === normalizedName
    );
    if (existing) return existing;
    const submission: OrganizationSubmission = {
      ...input,
      name,
      description: normalizeSubmissionDisplay(input.description),
      contact: normalizeSubmissionDisplay(input.contact),
      id: crypto.randomUUID(),
      status: "pending",
      confidenceLevel: "pending",
      createdAt: new Date().toISOString(),
    };
    setSubmissions((current) => [...current, submission]);
    return submission;
  }

  return {
    memberships,
    submissions,
    getMembershipStatus,
    joinOrRequest,
    leaveOrganization,
    submitOrganization,
  };
}
