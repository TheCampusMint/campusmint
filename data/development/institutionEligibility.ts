import { universities } from "../universities.ts";
import type { UniversityId } from "../../types/campus.ts";
import type { InstitutionEligibilityRecord } from "../../types/universityIdentity.ts";

type ConfiguredHigherEducationFixture = {
  universityId: UniversityId;
  institutionType: "university" | "college";
};

const configuredHigherEducationFixtures = [
  { universityId: "tamu", institutionType: "university" },
  { universityId: "blinn", institutionType: "college" },
  { universityId: "texas", institutionType: "university" },
  { universityId: "lsu", institutionType: "university" },
  { universityId: "alabama", institutionType: "university" },
] as const satisfies readonly ConfiguredHigherEducationFixture[];

function configuredHigherEducationRecord(
  fixture: ConfiguredHigherEducationFixture,
): InstitutionEligibilityRecord {
  const university = universities[fixture.universityId];
  const [canonicalDomain, ...additionalDomains] =
    university.emailDomains ?? [];

  if (!canonicalDomain) {
    throw new Error(
      `Configured university ${fixture.universityId} needs an email domain for institution eligibility.`,
    );
  }

  return {
    id: `configured-${fixture.universityId}`,
    name: university.name,
    canonicalDomain,
    acceptedDomains: [
      canonicalDomain,
      ...additionalDomains,
    ],
    institutionType: fixture.institutionType,
    eligibilityStatus: "eligible_higher_ed",
  };
}

/**
 * Small deterministic development/test registry.
 *
 * This is intentionally a provider fixture, not a production institution
 * directory. A maintained registry can replace it without changing onboarding.
 * All example.edu entries are clearly fictional and are not advertised in UI.
 */
export const developmentInstitutionEligibilityRecords:
  readonly InstitutionEligibilityRecord[] = [
    ...configuredHigherEducationFixtures.map(
      configuredHigherEducationRecord,
    ),
    {
      id: "development-example-higher-ed",
      name: "Development Example University",
      canonicalDomain: "example.edu",
      acceptedDomains: [
        "example.edu",
        "mail.example.edu",
      ],
      institutionType: "university",
      eligibilityStatus: "eligible_higher_ed",
    },
    {
      id: "development-example-k12",
      name: "Development Example K-12 School",
      canonicalDomain: "k12.example.edu",
      acceptedDomains: ["k12.example.edu"],
      institutionType: "k12_school",
      eligibilityStatus: "ineligible_k12",
    },
    {
      id: "development-example-district",
      name: "Development Example School District",
      canonicalDomain: "district.example.edu",
      acceptedDomains: ["district.example.edu"],
      institutionType: "school_district",
      eligibilityStatus: "ineligible_k12",
    },
    {
      id: "development-example-pre-college",
      name: "Development Example Pre-College Program",
      canonicalDomain: "precollege.example.edu",
      acceptedDomains: ["precollege.example.edu"],
      institutionType: "pre_college",
      eligibilityStatus: "ineligible_k12",
    },
  ];
