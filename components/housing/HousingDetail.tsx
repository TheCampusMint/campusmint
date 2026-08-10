import { DiscoverySourceBadge } from "@/components/discovery/DiscoverySourceBadge";
import { ReviewSummary } from "@/components/discovery/ReviewSummary";
import { housingReviewCategories, type HousingEntity } from "@/types/discovery";

export function HousingDetail({ housing, onClose }: { housing: HousingEntity; onClose: () => void }) {
  return (
    <section aria-label={`${housing.name} details`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><DiscoverySourceBadge source={housing.source} /><h3 className="mt-4 text-2xl font-bold text-slate-950">{housing.name}</h3><p className="mt-1 text-sm text-slate-500">{housing.campusName} · {housing.address ?? "Address unavailable"}</p></div>
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Close</button>
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div><h4 className="font-semibold text-slate-950">About this property</h4><p className="mt-2 text-sm leading-6 text-slate-600">{housing.description}</p></div>

          <div>
            <h4 className="font-semibold text-slate-950">Units and rates</h4>
            {housing.units.length ? <div className="mt-3 space-y-3">{housing.units.map((unit) => {
              const rate = housing.rates.find((item) => item.unitType.includes(unit.name) || item.unitType.includes("2-bed or 4-bed")) ?? housing.rates[0];
              return <div key={unit.id} className="rounded-xl border border-slate-200 p-3"><p className="font-semibold text-slate-900">{unit.name}</p><p className="mt-1 text-sm text-slate-500">{unit.bedroomCount ?? "—"} bedrooms · {unit.bathroomCount ?? "—"} bathrooms</p>{rate && <p className="mt-2 text-sm font-semibold text-slate-900">{new Intl.NumberFormat("en-US", { style: "currency", currency: rate.currency, maximumFractionDigits: 0 }).format(rate.amount)} / {rate.cadence} <span className="font-normal text-slate-500">({rate.termLabel})</span></p>}</div>;
            })}</div> : <p className="mt-2 text-sm text-slate-500">Unit configurations and current rates are unavailable. Confirm them with the listed source.</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Published capacity</p><p className="mt-1 font-semibold text-slate-900">{housing.capacity === null ? "Unavailable" : housing.capacity.toLocaleString("en-US")}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Furnished</p><p className="mt-1 font-semibold text-slate-900">{housing.furnished === null ? "Not specified" : housing.furnished ? "Yes" : "No"}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parking</p><p className="mt-1 font-semibold text-slate-900">{housing.parking ?? "Not specified"}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pet policy</p><p className="mt-1 font-semibold text-slate-900">{housing.petPolicy ?? "Not specified"}</p></div>
          </div>

          {housing.restrictions.length > 0 && <div><h4 className="font-semibold text-slate-950">Eligibility notes</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{housing.restrictions.map((restriction) => <li key={restriction}>{restriction}</li>)}</ul></div>}
          {housing.website && <a href={housing.website} target="_blank" rel="noreferrer" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">View official housing source</a>}
        </div>

        <div>
          <ReviewSummary external={housing.externalReviews} campusMint={housing.campusMintReviews} />
          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Campus Mint housing categories</p>
            <div className="mt-3 flex flex-wrap gap-2">{housingReviewCategories.map((category) => <span key={category} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 shadow-sm">{category}</span>)}</div>
            <button type="button" disabled className="mt-4 w-full cursor-not-allowed rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">Sign in to write a verified review</button>
            <p className="mt-2 text-xs leading-5 text-slate-500">Review submission is disabled until authenticated, verified accounts are available.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
