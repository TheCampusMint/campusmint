import type { DiscoverySource } from "@/types/discovery";

type DiscoverySourceBadgeProps = {
  source: DiscoverySource;
};

const sourceLabels: Record<DiscoverySource["type"], string> = {
  university_official: "Official university source",
  google_places: "External provider",
  authorized_partner: "Authorized partner",
  community_verified: "Community verified",
  pending: "Pending verification",
  campus_mint_user: "Campus Mint user",
  business_owner: "Business owner",
  development: "Development example",
};

export function DiscoverySourceBadge({ source }: DiscoverySourceBadgeProps) {
  const className = source.isDevelopment
    ? "border-amber-300 bg-amber-50 text-amber-900"
    : source.type === "university_official"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-slate-200 bg-slate-50 text-slate-700";

  const badge = (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      <span aria-hidden="true">{source.type === "university_official" ? "✓" : "•"}</span>
      {sourceLabels[source.type]}
    </span>
  );

  return source.url ? (
    <a href={source.url} target="_blank" rel="noreferrer" title={source.label} className="focus-visible:outline-2 focus-visible:outline-offset-2">
      {badge}
    </a>
  ) : badge;
}
