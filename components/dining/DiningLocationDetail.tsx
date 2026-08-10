import { DiscoverySourceBadge } from "@/components/discovery/DiscoverySourceBadge";
import { ReviewSummary } from "@/components/discovery/ReviewSummary";
import { diningHallReviewCategories, restaurantReviewCategories, type DiningLocation } from "@/types/discovery";

type DiningLocationDetailProps = {
  location: DiningLocation;
  onClose: () => void;
};

export function DiningLocationDetail({ location, onClose }: DiningLocationDetailProps) {
  const reviewCategories = location.categories.includes("Dining hall")
    ? diningHallReviewCategories
    : restaurantReviewCategories;

  return (
    <section aria-label={`${location.name} details`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <DiscoverySourceBadge source={location.source} />
          <h3 className="mt-4 text-2xl font-bold text-slate-950">{location.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{location.area} · {location.address ?? "Address unavailable"}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Close</button>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-slate-950">About</h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">{location.description}</p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-950">Hours & service</h4>
            {location.regularHours.length ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-600">{location.regularHours.map((hours) => <li key={hours}>{hours}</li>)}</ul>
            ) : <p className="mt-2 text-sm text-slate-500">Current hours are unavailable. Check the official source before visiting.</p>}
            {location.specialHours && <p className="mt-2 text-xs text-slate-500">{location.specialHours}</p>}
            <p className="mt-3 text-sm text-slate-500">Wait time: unavailable</p>
            <p className="mt-1 text-sm text-slate-500">Daily recommendation: unavailable</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {location.todayMenuUrl && <a href={location.todayMenuUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Official menu / hours</a>}
            {location.website && location.website !== location.todayMenuUrl && <a href={location.website} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Website</a>}
          </div>
        </div>

        <div>
          <ReviewSummary external={location.externalReviews} campusMint={location.campusMintReviews} />
          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Campus Mint review categories</p>
            <div className="mt-3 flex flex-wrap gap-2">{reviewCategories.map((category) => <span key={category} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 shadow-sm">{category}</span>)}</div>
            <button type="button" disabled className="mt-4 w-full cursor-not-allowed rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">Sign in to write a verified review</button>
            <p className="mt-2 text-xs leading-5 text-slate-500">Review submission remains disabled until authentication and verified-user permissions are connected.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
