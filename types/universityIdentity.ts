export type UniversityIdentity = {
  id: string;
  domain: string;
  name: string;
  shortName: string;
  knownUniversityId: string | null;
  verificationMethod: "edu_email";
  metadataStatus: "configured" | "provisional";
};

export type ResolvedStudentEmail = {
  email: string;
  localPart: string;
  domain: string;
  identity: UniversityIdentity;
};
