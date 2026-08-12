import { universities } from "@/data/universities";
import type {
  ResolvedStudentEmail,
  UniversityIdentity,
} from "@/types/universityIdentity";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function domainFromEmail(email: string) {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;

  return email.slice(at + 1);
}

function provisionalName(domain: string) {
  const root = domain.replace(/\.edu$/i, "");

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
  const email = normalizeEmail(value);
  const domain = domainFromEmail(email);

  return Boolean(
    domain &&
      (domain === "edu" ||
        domain.endsWith(".edu")),
  );
}

export function resolveStudentEmail(
  value: string,
): ResolvedStudentEmail | null {
  const email = normalizeEmail(value);
  const domain = domainFromEmail(email);

  if (
    !domain ||
    !domain.endsWith(".edu")
  ) {
    return null;
  }

  const knownEntry = Object.entries(
    universities,
  ).find(([, university]) =>
    university.emailDomains?.some(
      (candidate) =>
        candidate.toLowerCase() === domain,
    ),
  );

  let identity: UniversityIdentity;

  if (knownEntry) {
    const [knownUniversityId, university] =
      knownEntry;

    identity = {
      id: knownUniversityId,
      domain,
      name: university.name,
      shortName: university.shortName,
      knownUniversityId,
      verificationMethod: "edu_email",
      metadataStatus: "configured",
    };
  } else {
    const name = provisionalName(domain);

    identity = {
      id: provisionalId(domain),
      domain,
      name: name || domain,
      shortName: name || domain,
      knownUniversityId: null,
      verificationMethod: "edu_email",
      metadataStatus: "provisional",
    };
  }

  return {
    email,
    localPart: email.slice(
      0,
      email.lastIndexOf("@"),
    ),
    domain,
    identity,
  };
}
