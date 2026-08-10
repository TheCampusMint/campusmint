import { developmentAcademicAdapter } from "./developmentAcademicAdapter";
import { blinnOfficialAcademicsAdapter } from "./blinnAcademicAdapter";
import { blinnOfficialDiningAdapter } from "./blinnDiningAdapter";
import { blinnOfficialHousingAdapter } from "./blinnHousingAdapter";
import { tamuOfficialCatalogAdapter, tamuOfficialProgramsAdapter } from "./tamuAcademicAdapter";
import { googlePlacesRegistryAdapter } from "./googlePlacesAdapter";
import { tamuOfficialDiningAdapter } from "./tamuDiningAdapter";
import { tamuOfficialHousingAdapter } from "./tamuHousingAdapter";
import { blinnOfficialOrganizationsAdapter, developmentOrganizationAdapter, tamuOfficialOrganizationsAdapter } from "./organizationAdapters";

export function getSourceAdapter(adapterKey: string) {
  if (adapterKey.endsWith("development-academics")) return developmentAcademicAdapter;
  if (adapterKey === "tamu-official-catalog") return tamuOfficialCatalogAdapter;
  if (adapterKey === "tamu-official-programs") return tamuOfficialProgramsAdapter;
  if (adapterKey === "blinn-official-academics") return blinnOfficialAcademicsAdapter;
  if (adapterKey === "tamu-official-dining") return tamuOfficialDiningAdapter;
  if (adapterKey === "blinn-official-dining") return blinnOfficialDiningAdapter;
  if (adapterKey === "tamu-official-housing") return tamuOfficialHousingAdapter;
  if (adapterKey === "blinn-official-housing") return blinnOfficialHousingAdapter;
  if (adapterKey === "google-places") return googlePlacesRegistryAdapter;
  if (adapterKey.endsWith("development-organizations")) return developmentOrganizationAdapter;
  if (adapterKey === "tamu-official-organizations") return tamuOfficialOrganizationsAdapter;
  if (adapterKey === "blinn-official-organizations") return blinnOfficialOrganizationsAdapter;
  throw new Error(`No adapter is registered for ${adapterKey}.`);
}
