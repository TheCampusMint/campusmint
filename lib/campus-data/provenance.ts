import type { ProvenanceMetadata } from "@/types/campus-data";

export function getProvenanceLabel(value: ProvenanceMetadata) {
  if (value.isDevelopment || value.sourceType === "development_seed") return "Development data";
  if (value.confidenceLevel === "official") return "Official";
  if (value.confidenceLevel === "community_verified") return "Community verified";
  return "Pending verification";
}
