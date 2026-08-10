import { marketplaceCategoryDetails } from "@/data/marketplace";
import type { MarketplaceCategory } from "@/types/marketplace";

export function MarketplacePhotoPlaceholder({ category, compact = false }: { category: MarketplaceCategory; compact?: boolean }) {
  const detail = marketplaceCategoryDetails[category];
  return (
    <div className="flex h-full min-h-28 flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4 text-center">
      <span className={compact ? "text-3xl" : "text-5xl"} aria-hidden="true">{detail.icon}</span>
      <span className="mt-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">Development placeholder</span>
    </div>
  );
}
