import type { UniversityId } from "./campus";

export type InstitutionEligibilityStatus =
  | "eligible_higher_ed"
  | "ineligible_k12"
  | "unknown";

export type InstitutionType =
  | "university"
  | "college"
  | "postsecondary"
  | "k12_school"
  | "school_district"
  | "pre_college"
  | "unknown";

export type HigherEducationInstitutionType = Extract<
  InstitutionType,
  "university" | "college" | "postsecondary"
>;

export type IneligibleInstitutionType = Extract<
  InstitutionType,
  "k12_school" | "school_district" | "pre_college"
>;

export type InstitutionEligibilityReason =
  | "registry_confirmed_higher_ed"
  | "registry_confirmed_k12"
  | "institution_not_found";

export type InstitutionEligibilityEvidence = {
  sourceId: string;
  sourceKind:
    | "development_fixture"
    | "maintained_registry";
  recordId: string | null;
};

type InstitutionEligibilityRecordBase = {
  id: string;
  name: string;
  canonicalDomain: string;
  acceptedDomains: readonly string[];
};

export type InstitutionEligibilityRecord =
  InstitutionEligibilityRecordBase &
    (
      | {
          institutionType: HigherEducationInstitutionType;
          eligibilityStatus: "eligible_higher_ed";
        }
      | {
          institutionType: IneligibleInstitutionType;
          eligibilityStatus: "ineligible_k12";
        }
    );

export type InstitutionEligibilityProvider = {
  sourceId: string;
  sourceKind:
    | "development_fixture"
    | "maintained_registry";
  findByDomain: (
    normalizedDomain: string,
  ) => InstitutionEligibilityRecord | null;
};

type InstitutionEligibilityResultBase = {
  normalizedDomain: string;
  evidence: InstitutionEligibilityEvidence;
};

export type InstitutionEligibilityResult =
  InstitutionEligibilityResultBase &
    (
      | {
          canonicalDomain: string;
          status: "eligible_higher_ed";
          institutionType: HigherEducationInstitutionType;
          institutionName: string;
          reason: "registry_confirmed_higher_ed";
        }
      | {
          canonicalDomain: string;
          status: "ineligible_k12";
          institutionType: IneligibleInstitutionType;
          institutionName: string;
          reason: "registry_confirmed_k12";
        }
      | {
          canonicalDomain: null;
          status: "unknown";
          institutionType: "unknown";
          institutionName: null;
          reason: "institution_not_found";
        }
    );

export type EligibleInstitutionEligibilityResult =
  Extract<
    InstitutionEligibilityResult,
    { status: "eligible_higher_ed" }
  >;

export type UniversityIdentity = {
  id: string;
  domain: string;
  name: string;
  shortName: string;
  knownUniversityId: UniversityId | null;
  verificationMethod: "edu_email";
  metadataStatus: "configured" | "provisional";
};

export type ResolvedStudentEmail = {
  email: string;
  localPart: string;
  domain: string;
  identity: UniversityIdentity;
  eligibility: EligibleInstitutionEligibilityResult;
  /** Eligibility never proves control of the mailbox. */
  mailboxVerificationStatus: "unverified";
};

export type StudentEmailRejectionReason =
  | "invalid_email"
  | "not_edu_domain"
  | "ineligible_k12"
  | "unknown_institution";

export type StudentEmailAssessment =
  | {
      ok: true;
      resolved: ResolvedStudentEmail;
    }
  | {
      ok: false;
      normalizedEmail: string;
      normalizedDomain: string | null;
      eligibility: InstitutionEligibilityResult | null;
      reason: StudentEmailRejectionReason;
      metadataStatus: null;
      mailboxVerificationStatus: "unverified";
    };
