import { developmentOrganizations } from "@/data/organizations";
import { normalizeIncomingRecord } from "@/lib/sync/normalize";
import type { SourceAdapter } from "@/lib/sync/types";

import { createRegisteredOfficialAdapter } from "./registeredOfficialAdapter";

export const developmentOrganizationAdapter: SourceAdapter = {
  key: "development-organizations",
  async load(source) {
    return developmentOrganizations
      .filter((organization) => organization.universityId === source.universityId)
      .map((organization) => {
        const { id, logo, photo, ...record } = organization;
        return normalizeIncomingRecord("organization", source.universityId, id, {
          ...record,
          logoUrl: logo?.url ?? null,
          photoUrl: photo?.url ?? null,
        });
      });
  },
};

export const tamuOfficialOrganizationsAdapter = createRegisteredOfficialAdapter(
  "tamu-official-organizations",
  "Texas A&M University",
);

export const blinnOfficialOrganizationsAdapter = createRegisteredOfficialAdapter(
  "blinn-official-organizations",
  "Blinn College",
);
