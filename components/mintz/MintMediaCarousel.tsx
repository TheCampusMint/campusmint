"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode, type UIEvent } from "react";

import type { UniversityTheme } from "@/data/universities";
import type { MintMedia } from "@/types/mint";

type MintMediaCarouselProps = {
  media: MintMedia[];
  theme: UniversityTheme;
  fallbackLabel: string;
  fallbackDetail?: string | null;
  children?: ReactNode;
};

export function MintMediaCarousel({ media, theme, fallbackLabel, fallbackDetail, children }: MintMediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const items = media.length > 0 ? media : [null];

  function updatePosition(event: UIEvent<HTMLDivElement>) {
    const width = event.currentTarget.clientWidth;
    if (!width) return;
    setActiveIndex(Math.max(0, Math.min(items.length - 1, Math.round(event.currentTarget.scrollLeft / width))));
  }

  function goTo(index: number) {
    carouselRef.current?.scrollTo({ left: index * (carouselRef.current.clientWidth || 0), behavior: "smooth" });
    setActiveIndex(index);
  }

  return (
    <div className="relative overflow-hidden bg-slate-900" data-mint-carousel>
      <div ref={carouselRef} onScroll={updatePosition} className="mint-carousel flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain" aria-label={items.length > 1 ? `Mint media carousel, item ${activeIndex + 1} of ${items.length}` : "Mint media"}>
        {items.map((item, index) => (
          <div key={item?.id ?? "fallback"} className="relative aspect-[4/5] w-full shrink-0 snap-center sm:aspect-[4/3]">
            {item?.url ? (
              item.type === "image" ? <Image src={item.url} alt={`${fallbackLabel}, media ${index + 1}`} fill sizes="(max-width: 680px) 100vw, 640px" className="object-cover" unoptimized /> : <video src={item.url} controls playsInline className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col justify-end p-7 text-white" style={{ background: `radial-gradient(circle at ${24 + index * 18}% ${22 + index * 12}%, color-mix(in srgb, ${theme.secondary} 26%, transparent), transparent 34%), linear-gradient(145deg, ${theme.primary}, color-mix(in srgb, ${theme.primary} 64%, #111827))` }}>
                <span className="text-[10px] font-black uppercase tracking-[0.24em] opacity-70">Development media</span>
                <strong className="mt-2 max-w-sm text-2xl font-black tracking-tight">{fallbackLabel}</strong>
                {fallbackDetail && <span className="mt-2 max-w-md text-sm leading-6 opacity-75">{fallbackDetail}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <>
          <span className="absolute right-3 top-3 rounded-full bg-slate-950/65 px-2.5 py-1 text-[11px] font-black text-white backdrop-blur">{activeIndex + 1}/{items.length}</span>
          <div className="absolute inset-x-4 top-3 flex gap-1 pr-12" aria-hidden="true">
            {items.map((_, index) => <button key={index} type="button" tabIndex={-1} onClick={() => goTo(index)} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"><span className="block h-full rounded-full transition-all" style={{ width: index === activeIndex ? "100%" : "0%", backgroundColor: theme.secondary }} /></button>)}
          </div>
        </>
      )}
      {children}
    </div>
  );
}
