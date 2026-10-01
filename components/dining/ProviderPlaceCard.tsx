import type { PlaceProviderResult } from "@/lib/providers/places/types";

export function ProviderPlaceCard({ place }: { place: PlaceProviderResult }) {
  return (
    <article className="rounded-2xl bg-[var(--app-surface)] p-5 text-[var(--app-text-primary)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-bold">{place.name}</h4>
          {place.address && <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{place.address}</p>}
        </div>
        <span translate="no" className="shrink-0 text-sm font-normal">Google Maps</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {place.googleMapsUri && <a href={place.googleMapsUri} target="_blank" rel="noreferrer" className="rounded-xl py-2 text-sm font-semibold text-[var(--app-accent)] focus-visible:outline-2">View on Google Maps</a>}
      </div>
      {place.attributions.map((attribution, index) => attribution.providerUri
        ? <a key={index} href={attribution.providerUri} target="_blank" rel="noreferrer" className="mr-2 text-xs">{attribution.provider}</a>
        : <span key={index} className="mr-2 text-xs">{attribution.provider}</span>)}
    </article>
  );
}
