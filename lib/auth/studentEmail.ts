import {
  configuredUniversityIds,
  universities,
} from "../../data/universities.ts";
import { resolveInstitutionEligibility } from "./institutionEligibility.ts";
import type {
  InstitutionEligibilityResult,
  ResolvedStudentEmail,
  StudentEmailAssessment,
  StudentEmailRejectionReason,
  UniversityIdentity,
} from "../../types/universityIdentity.ts";

const EDU_DOMAIN_PATTERN = /\.edu$/;
const EMAIL_LOCAL_PART_PATTERN =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i;
const DOMAIN_LABEL_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type ParsedStudentEmail = {
  email: string;
  localPart: string;
  domain: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function validDomain(domain: string) {
  if (
    domain.length === 0 ||
    domain.length > 253
  ) {
    return false;
  }

  const labels = domain.split(".");

  return labels.every(
    (label) =>
      label.length <= 63 &&
      DOMAIN_LABEL_PATTERN.test(label),
  );
}

export function parseStudentEmail(
  value: string,
): ParsedStudentEmail | null {
  const email = normalizeEmail(value);
  const at = email.indexOf("@");

  if (
    email.length === 0 ||
    /\s/.test(email) ||
    at <= 0 ||
    at !== email.lastIndexOf("@") ||
    at === email.length - 1
  ) {
    return null;
  }

  const localPart = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !EMAIL_LOCAL_PART_PATTERN.test(localPart) ||
    !validDomain(domain)
  ) {
    return null;
  }

  return { email, localPart, domain };
}

function provisionalName(domain: string) {
  const root = domain.replace(EDU_DOMAIN_PATTERN, "");

  return root
    .split(/[.-]+/)
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}

function provisionalId(domain: string) {
  return `edu:${domain}`;
}

export function isEduEmail(value: string) {
  const parsed = parseStudentEmail(value);

  return Boolean(
    parsed &&
      EDU_DOMAIN_PATTERN.test(parsed.domain),
  );
}

function rejectedAssessment(
  value: string,
  reason: StudentEmailRejectionReason,
  parsed: ParsedStudentEmail | null,
  eligibility: InstitutionEligibilityResult | null =
    null,
): StudentEmailAssessment {
  return {
    ok: false,
    normalizedEmail: normalizeEmail(value),
    normalizedDomain: parsed?.domain ?? null,
    eligibility,
    reason,
    metadataStatus: null,
    mailboxVerificationStatus: "unverified",
  };
}

export function assessStudentEmail(
  value: string,
): StudentEmailAssessment {
  const parsed = parseStudentEmail(value);

  if (!parsed) {
    return rejectedAssessment(
      value,
      "invalid_email",
      null,
    );
  }

  if (!EDU_DOMAIN_PATTERN.test(parsed.domain)) {
    return rejectedAssessment(
      value,
      "not_edu_domain",
      parsed,
    );
  }

  const eligibility =
    resolveInstitutionEligibility(parsed.domain);

  if (
    eligibility.status === "ineligible_k12"
  ) {
    return rejectedAssessment(
      value,
      "ineligible_k12",
      parsed,
      eligibility,
    );
  }

  if (eligibility.status === "unknown") {
    return rejectedAssessment(
      value,
      "unknown_institution",
      parsed,
      eligibility,
    );
  }

  const canonicalDomain =
    eligibility.canonicalDomain;

  const knownUniversityId = configuredUniversityIds.find(
    (universityId) =>
      universities[universityId].emailDomains?.some(
      (candidate) =>
        candidate.toLowerCase() ===
        canonicalDomain,
      ),
  );

  let identity: UniversityIdentity;

  if (knownUniversityId) {
    const university = universities[knownUniversityId];

    identity = {
      id: knownUniversityId,
      domain: canonicalDomain,
      name: university.name,
      shortName: university.shortName,
      knownUniversityId,
      verificationMethod: "edu_email",
      metadataStatus: "configured",
    };
  } else {
    const name =
      eligibility.institutionName ??
      provisionalName(canonicalDomain);

    identity = {
      id: provisionalId(canonicalDomain),
      domain: canonicalDomain,
      name: name || canonicalDomain,
      shortName: name || canonicalDomain,
      knownUniversityId: null,
      verificationMethod: "edu_email",
      metadataStatus: "provisional",
    };
  }

  const resolved: ResolvedStudentEmail = {
    email: parsed.email,
    localPart: parsed.localPart,
    domain: parsed.domain,
    identity,
    eligibility,
    mailboxVerificationStatus: "unverified",
  };

  return { ok: true, resolved };
}

export function resolveStudentEmail(
  value: string,
): ResolvedStudentEmail | null {
  const assessment = assessStudentEmail(value);

  return assessment.ok
    ? assessment.resolved
    : null;
}

export function getStudentEmailRejectionMessage(
  reason: StudentEmailRejectionReason,
) {
  if (reason === "ineligible_k12") {
    return "Campus Mint is currently for college and university students.";
  }

  if (reason === "unknown_institution") {
    return "We couldn't verify this institution as a college or university yet.";
  }

  return "Enter a valid college or university .edu email.";
}
