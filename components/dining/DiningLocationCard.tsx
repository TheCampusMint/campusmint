import { DiscoverySourceBadge } from "@/components/discovery/DiscoverySourceBadge";
import { ReviewSummary } from "@/components/discovery/ReviewSummary";
import type { UniversityTheme } from "@/data/universities";
import type { DiningLocation } from "@/types/discovery";

type DiningLocationCardProps = {
  location: DiningLocation;
  theme: UniversityTheme;
  onViewDetails: (location: DiningLocation) => void;
};

export function DiningLocationCard({ location, theme, onViewDetails }: DiningLocationCardProps) {
  const hoursLabel = location.openNow === true
    ? "Open now"
    : location.openNow === false
      ? "Closed now"
      : "Live hours unavailable";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex min-h-32 items-end bg-gradient-to-br from-slate-100 to-slate-200 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{location.area}</p>
          <p className="mt-2 text-sm text-slate-600">Photos unavailable</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-2">
          <DiscoverySourceBadge source={location.source} />
          {location.categories.slice(0, 2).map((category) => (
            <span key={category} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{category}</span>
          ))}
        </div>

        <h3 className="mt-4 text-xl font-bold text-slate-950">{location.name}</h3>
        <p className="mt-1 text-sm text-slate-500">{location.address ?? "Address unavailable"}</p>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{location.description}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className={location.openNow === true ? "text-emerald-700" : "text-slate-500"}>{hoursLabel}</span>
          <span className="text-slate-300" aria-hidden="true">•</span>
          <span className="text-slate-500">Wait time unavailable</span>
        </div>

        <div className="mt-4">
          <ReviewSummary external={location.externalReviews} campusMint={location.campusMintReviews} compact />
        </div>

        <button
          type="button"
          onClick={() => onViewDetails(location)}
          className="mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ backgroundColor: theme.primary, color: theme.secondary, outlineColor: theme.primary }}
        >
          View details
        </button>
      </div>
    </article>
  );
}
