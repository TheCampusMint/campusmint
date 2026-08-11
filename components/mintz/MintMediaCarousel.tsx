"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
  type UIEvent,
} from "react";

import type { UniversityTheme } from "@/data/universities";
import type { MintMedia } from "@/types/mint";

type MintMediaCarouselProps = {
  media: MintMedia[];
  theme: UniversityTheme;
  fallbackLabel: string;
  fallbackDetail?: string | null;
  children?: ReactNode;
  autoplayVideo?: boolean;
};

type ZoomView = {
  scale: number;
  x: number;
  y: number;
};

const restingZoom: ZoomView = {
  scale: 1,
  x: 0,
  y: 0,
};

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.max(min, Math.min(max, value));
}

function touchDistance(
  touches: TouchEvent<HTMLDivElement>["touches"],
) {
  if (touches.length < 2) return 0;

  const dx =
    touches[0].clientX -
    touches[1].clientX;

  const dy =
    touches[0].clientY -
    touches[1].clientY;

  return Math.hypot(dx, dy);
}

function ZoomableMedia({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const [view, setView] =
    useState<ZoomView>(restingZoom);

  const viewRef =
    useRef<ZoomView>(restingZoom);

  const pinchRef = useRef<{
    distance: number;
    scale: number;
  } | null>(null);

  const panRef = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);

  function updateView(next: ZoomView) {
    viewRef.current = next;
    setView(next);
  }

  function reset() {
    pinchRef.current = null;
    panRef.current = null;
    updateView(restingZoom);
  }

  useEffect(() => {
    if (!active) reset();
  }, [active]);

  function handleTouchStart(
    event: TouchEvent<HTMLDivElement>,
  ) {
    if (event.touches.length >= 2) {
      event.stopPropagation();

      pinchRef.current = {
        distance: Math.max(
          1,
          touchDistance(event.touches),
        ),
        scale: viewRef.current.scale,
      };

      panRef.current = null;
      return;
    }

    if (
      event.touches.length === 1 &&
      viewRef.current.scale > 1
    ) {
      event.stopPropagation();

      panRef.current = {
        x: viewRef.current.x,
        y: viewRef.current.y,
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
      };
    }
  }

  function handleTouchMove(
    event: TouchEvent<HTMLDivElement>,
  ) {
    if (
      event.touches.length >= 2 &&
      pinchRef.current
    ) {
      event.preventDefault();
      event.stopPropagation();

      const distance = Math.max(
        1,
        touchDistance(event.touches),
      );

      const scale = clamp(
        pinchRef.current.scale *
          (distance /
            pinchRef.current.distance),
        1,
        4,
      );

      const bounds =
        containerRef.current?.getBoundingClientRect();

      const maxX = bounds
        ? ((scale - 1) * bounds.width) / 2
        : 0;

      const maxY = bounds
        ? ((scale - 1) * bounds.height) / 2
        : 0;

      updateView({
        scale,
        x: clamp(
          viewRef.current.x,
          -maxX,
          maxX,
        ),
        y: clamp(
          viewRef.current.y,
          -maxY,
          maxY,
        ),
      });

      return;
    }

    if (
      event.touches.length === 1 &&
      panRef.current &&
      viewRef.current.scale > 1
    ) {
      event.preventDefault();
      event.stopPropagation();

      const bounds =
        containerRef.current?.getBoundingClientRect();

      if (!bounds) return;

      const maxX =
        ((viewRef.current.scale - 1) *
          bounds.width) /
        2;

      const maxY =
        ((viewRef.current.scale - 1) *
          bounds.height) /
        2;

      updateView({
        ...viewRef.current,
        x: clamp(
          panRef.current.x +
            event.touches[0].clientX -
            panRef.current.startX,
          -maxX,
          maxX,
        ),
        y: clamp(
          panRef.current.y +
            event.touches[0].clientY -
            panRef.current.startY,
          -maxY,
          maxY,
        ),
      });
    }
  }

  function handleTouchEnd(
    event: TouchEvent<HTMLDivElement>,
  ) {
    if (event.touches.length < 2) {
      pinchRef.current = null;
    }

    if (
      event.touches.length === 1 &&
      viewRef.current.scale > 1
    ) {
      panRef.current = {
        x: viewRef.current.x,
        y: viewRef.current.y,
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
      };
    } else if (event.touches.length === 0) {
      panRef.current = null;
    }

    if (viewRef.current.scale <= 1.02) {
      reset();
    }
  }

  return (
    <div
      ref={containerRef}
      data-mint-zoomable
      className="absolute inset-0 overflow-hidden"
      style={{
        touchAction:
          view.scale > 1
            ? "none"
            : "pan-x pan-y",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className="relative h-full w-full will-change-transform"
        style={{
          transform:
            `translate3d(${view.x}px,${view.y}px,0) scale(${view.scale})`,
          transformOrigin: "center",
          transition:
            view.scale === 1
              ? "transform 220ms cubic-bezier(.22,1,.36,1)"
              : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function MintMediaCarousel({
  media,
  theme,
  fallbackLabel,
  fallbackDetail,
  children,
  autoplayVideo = true,
}: MintMediaCarouselProps) {
  const [activeIndex, setActiveIndex] =
    useState(0);

  const carouselRef =
    useRef<HTMLDivElement>(null);

  const activeIndexRef = useRef(0);

  const activeIndicatorRef =
    useRef<HTMLSpanElement>(null);

  const queuedProgress = useRef(0);
  const animationFrame =
    useRef<number | null>(null);

  const items =
    media.length > 0 ? media : [null];

  const indicatorStep =
    items.length > 7
      ? 8
      : items.length > 5
        ? 9
        : 11;

  const indicatorWidth =
    18 +
    indicatorStep * (items.length - 1);

  function paintIndicator(progress: number) {
    queuedProgress.current = progress;

    if (animationFrame.current) return;

    animationFrame.current =
      window.requestAnimationFrame(() => {
        animationFrame.current = null;

        if (!activeIndicatorRef.current) {
          return;
        }

        activeIndicatorRef.current.style.transform =
          `translate3d(${queuedProgress.current * indicatorStep}px,0,0)`;
      });
  }

  function updatePosition(
    event: UIEvent<HTMLDivElement>,
  ) {
    const width =
      event.currentTarget.clientWidth;

    if (!width) return;

    const progress = Math.max(
      0,
      Math.min(
        items.length - 1,
        event.currentTarget.scrollLeft /
          width,
      ),
    );

    const nextIndex = Math.round(progress);

    paintIndicator(progress);

    if (
      nextIndex !==
      activeIndexRef.current
    ) {
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    }
  }

  useEffect(
    () => () => {
      if (animationFrame.current) {
        window.cancelAnimationFrame(
          animationFrame.current,
        );
      }
    },
    [],
  );

  return (
    <div
      className="relative overflow-hidden bg-slate-900"
      data-mint-carousel
    >
      <div
        ref={carouselRef}
        onScroll={updatePosition}
        className="mint-carousel flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        aria-label={
          items.length > 1
            ? `Mint media carousel, item ${activeIndex + 1} of ${items.length}`
            : "Mint media"
        }
      >
        {items.map((item, index) => (
          <div
            key={item?.id ?? "fallback"}
            className="relative aspect-[4/5] w-full shrink-0 snap-center sm:aspect-[4/3]"
          >
            {item?.url ? (
              <ZoomableMedia
                active={
                  index === activeIndex
                }
              >
                {item.type === "image" ? (
                  <Image
                    src={item.url}
                    alt={`${fallbackLabel}, media ${index + 1}`}
                    fill
                    sizes="(max-width: 680px) 100vw, 640px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <video
                    src={item.url}
                    controls
                    playsInline
                    autoPlay={
                      autoplayVideo
                    }
                    muted={autoplayVideo}
                    className="h-full w-full object-cover"
                  />
                )}
              </ZoomableMedia>
            ) : (
              <div
                className="flex h-full flex-col justify-end p-7 text-white"
                style={{
                  background:
                    `radial-gradient(circle at ${24 + index * 18}% ${22 + index * 12}%, color-mix(in srgb, ${theme.secondary} 26%, transparent), transparent 34%), linear-gradient(145deg, ${theme.primary}, color-mix(in srgb, ${theme.primary} 64%, #111827))`,
                }}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.24em] opacity-70">
                  Development media
                </span>

                <strong className="mt-2 max-w-sm text-2xl font-black tracking-tight">
                  {fallbackLabel}
                </strong>

                {fallbackDetail && (
                  <span className="mt-2 max-w-md text-sm leading-6 opacity-75">
                    {fallbackDetail}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <>
          <span className="absolute right-3 top-3 rounded-full bg-slate-950/65 px-2.5 py-1 text-[11px] font-black text-white backdrop-blur">
            {activeIndex + 1}/{items.length}
          </span>

          <div
            className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-950/40 px-2.5 py-2 shadow-sm backdrop-blur-md"
            aria-hidden="true"
          >
            <div
              className="relative h-1"
              style={{
                width: indicatorWidth,
              }}
            >
              {items.map((_, index) => (
                <span
                  key={index}
                  className="absolute top-0 h-1 w-[5px] rounded-full bg-white/35"
                  style={{
                    left:
                      index *
                      indicatorStep,
                  }}
                />
              ))}

              <span
                ref={activeIndicatorRef}
                className="absolute left-0 top-0 h-1 w-[18px] rounded-full bg-white shadow-sm will-change-transform"
              />
            </div>
          </div>
        </>
      )}

      {children}
    </div>
  );
}
