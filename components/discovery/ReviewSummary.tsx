import type { CampusMintReviewSummary, ExternalReviewSummary } from "@/types/discovery";

type ReviewSummaryProps = {
  external: ExternalReviewSummary | null;
  campusMint: CampusMintReviewSummary;
  compact?: boolean;
};

function RatingValue({ rating }: { rating: number | null }) {
  return rating === null ? (
    <span className="font-medium text-slate-500">Not available</span>
  ) : (
    <span className="font-bold text-slate-950">{rating.toFixed(1)} <span aria-hidden="true" className="text-amber-500">★</span></span>
  );
}

export function ReviewSummary({ external, campusMint, compact = false }: ReviewSummaryProps) {
  return (
    <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "md:grid-cols-2"}`}>
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {external?.provider === "google_maps" ? <span translate="no">Google Maps</span> : "External rating"}
        </p>
        <p className="mt-1 text-sm">
          <RatingValue rating={external?.rating ?? null} />
          {external && <span className="ml-2 text-xs text-slate-500">{external.reviewCount.toLocaleString("en-US")} provider reviews</span>}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Campus Mint reviews</p>
        <p className="mt-1 text-sm">
          {campusMint.reviewCount === 0 ? (
            <span className="font-medium text-slate-500">No reviews yet · 0 reviews</span>
          ) : (
            <><RatingValue rating={campusMint.rating} /><span className="ml-2 text-xs text-slate-500">{campusMint.reviewCount.toLocaleString("en-US")} reviews</span></>
          )}
        </p>
      </section>
    </div>
  );
}
