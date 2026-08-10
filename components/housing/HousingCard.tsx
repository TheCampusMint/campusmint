import { DiscoverySourceBadge } from "@/components/discovery/DiscoverySourceBadge";
import { ReviewSummary } from "@/components/discovery/ReviewSummary";
import type { UniversityTheme } from "@/data/universities";
import type { HousingEntity } from "@/types/discovery";

type HousingCardProps = {
  housing: HousingEntity;
  theme: UniversityTheme;
  onViewDetails: (housing: HousingEntity) => void;
};

const housingTypeLabels: Record<HousingEntity["housingType"], string> = {
  residence_hall: "Residence hall",
  university_apartment: "University apartment",
  apartment: "Apartment",
  shared_housing: "Shared housing",
};

function formatRate(housing: HousingEntity) {
  const rate = housing.rates[0];
  if (!rate) return "Rate unavailable";
  return `${new Intl.NumberFormat("en-US", { style: "currency", currency: rate.currency, maximumFractionDigits: 0 }).format(rate.amount)} / ${rate.cadence}`;
}

export function HousingCard({ housing, theme, onViewDetails }: HousingCardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex min-h-36 items-end bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{housing.campusName}</p>
          <p className="mt-2 text-sm text-slate-600">Photos unavailable</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-2">
          <DiscoverySourceBadge source={housing.source} />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{housingTypeLabels[housing.housingType]}</span>
        </div>
        <h3 className="mt-4 text-xl font-bold text-slate-950">{housing.name}</h3>
        <p className="mt-1 text-sm text-slate-500">{housing.address ?? "Address unavailable"}</p>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{housing.description}</p>

        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Published rate</dt><dd className="mt-1 font-semibold text-slate-900">{formatRate(housing)}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Distance</dt><dd className="mt-1 font-semibold text-slate-900">{housing.distanceMiles === null ? "Unavailable" : `${housing.distanceMiles} mi`}</dd></div>
        </dl>

        <div className="mt-4"><ReviewSummary external={housing.externalReviews} campusMint={housing.campusMintReviews} compact /></div>
        <button type="button" onClick={() => onViewDetails(housing)} className="mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2" style={{ backgroundColor: theme.primary, color: theme.secondary, outlineColor: theme.primary }}>View housing details</button>
      </div>
    </article>
  );
}
