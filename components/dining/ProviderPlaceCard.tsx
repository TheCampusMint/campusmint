import type { PlaceProviderResult } from "@/lib/providers/places/types";

export function ProviderPlaceCard({ place }: { place: PlaceProviderResult }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-slate-950">{place.name}</h4>
          <p className="mt-1 text-sm text-slate-500">{place.address ?? "Address unavailable"}</p>
        </div>
        <span translate="no" className="shrink-0 text-sm font-normal text-slate-600">Google Maps</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
        <span>{place.openNow === null ? "Live hours unavailable" : place.openNow ? "Open now" : "Closed now"}</span>
        <span>{place.rating === null ? "Rating unavailable" : `${place.rating.toFixed(1)} ★${place.userRatingCount === null ? "" : ` · ${place.userRatingCount.toLocaleString("en-US")} Google Maps reviews`}`}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {place.googleMapsUri && <a href={place.googleMapsUri} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">View on Google Maps</a>}
        {place.website && <a href={place.website} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Website</a>}
      </div>
    </article>
  );
}
