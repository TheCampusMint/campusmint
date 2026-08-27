import { developmentInstitutionEligibilityRecords } from "../../data/development/institutionEligibility.ts";
import type {
  InstitutionEligibilityProvider,
  InstitutionEligibilityResult,
} from "../../types/universityIdentity.ts";

const developmentRecordByDomain = new Map(
  developmentInstitutionEligibilityRecords.flatMap(
    (record) =>
      record.acceptedDomains.map(
        (domain) => [domain, record] as const,
      ),
  ),
);

/**
 * Prototype provider boundary. Replace this provider with a maintained
 * institution registry in production; consumers should not need to change.
 */
export const developmentInstitutionEligibilityProvider:
  InstitutionEligibilityProvider = {
    sourceId:
      "campus-mint-development-institution-registry-v1",
    sourceKind: "development_fixture",
    findByDomain(normalizedDomain) {
      return (
        developmentRecordByDomain.get(
          normalizedDomain,
        ) ?? null
      );
    },
  };

export function resolveInstitutionEligibility(
  normalizedDomain: string,
  provider: InstitutionEligibilityProvider =
    developmentInstitutionEligibilityProvider,
): InstitutionEligibilityResult {
  const record = provider.findByDomain(
    normalizedDomain,
  );

  if (!record) {
    return {
      normalizedDomain,
      canonicalDomain: null,
      status: "unknown",
      institutionType: "unknown",
      institutionName: null,
      evidence: {
        sourceId: provider.sourceId,
        sourceKind: provider.sourceKind,
        recordId: null,
      },
      reason: "institution_not_found",
    };
  }

  const evidence = {
    sourceId: provider.sourceId,
    sourceKind: provider.sourceKind,
    recordId: record.id,
  } as const;

  if (
    record.eligibilityStatus ===
    "eligible_higher_ed"
  ) {
    return {
      normalizedDomain,
      canonicalDomain: record.canonicalDomain,
      status: "eligible_higher_ed",
      institutionType: record.institutionType,
      institutionName: record.name,
      evidence,
      reason: "registry_confirmed_higher_ed",
    };
  }

  return {
    normalizedDomain,
    canonicalDomain: record.canonicalDomain,
    status: "ineligible_k12",
    institutionType: record.institutionType,
    institutionName: record.name,
    evidence,
    reason: "registry_confirmed_k12",
  };
}
