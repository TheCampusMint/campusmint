import { getProvenanceLabel } from "@/lib/campus-data/provenance";
import type { ProvenanceMetadata } from "@/types/campus-data";

export function SourceBadge({ value }: { value: ProvenanceMetadata }) {
  const label = getProvenanceLabel(value);
  const classes = label === "Official"
    ? "bg-emerald-100 text-emerald-800"
    : label === "Community verified"
      ? "bg-sky-100 text-sky-800"
      : label === "Development data"
        ? "bg-violet-100 text-violet-800"
        : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${classes}`}>{label}</span>;
}
