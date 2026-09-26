"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import {
  bottomNavigationSlots,
  createMintAction,
  getBottomNavigationSlotIndex,
  getPrimaryNavigationIndex,
  primaryNavigation,
  type PrimarySection,
  type SwipeSection,
} from "@/components/shell/navigation";
import { motion } from "@/lib/motion/interaction";
import { getNotchDotAvailability, type NotchPresentation } from "@/lib/motion/interaction";

type BottomBubbleNavProps = {
  activeSection: PrimarySection;
  navigationSection: SwipeSection;
  presentation: NotchPresentation;
  swipeProgress: number;
  swipeSettling: boolean;
  reducedMotion: boolean;
  onSelect: (section: SwipeSection) => void;
  onMintTap: () => void;
  onCreateMint: () => void;
  onExpand: () => void;
};

type DragState = {
  pointerId: number;
  startX: number;
  dragging: boolean;
};

const SLOT_COUNT = bottomNavigationSlots.length;
const DRAG_THRESHOLD_PX = 8;
const PAGE_SWIPE_SETTLE_MS = motion.duration.settle;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function BottomBubbleNav({
  activeSection,
  navigationSection,
  presentation,
  swipeProgress,
  swipeSettling,
  reducedMotion,
  onSelect,
  onMintTap,
  onCreateMint,
  onExpand,
}: BottomBubbleNavProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);
  const settleFrameRef = useRef<number | null>(null);
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const [previewSection, setPreviewSection] =
    useState<SwipeSection | null>(null);
  const [scrubbing, setScrubbing] = useState(false);

  const activeNavigationIndex = Math.max(
    0,
    getPrimaryNavigationIndex(navigationSection),
  );
  const activeSlot = Math.max(
    0,
    getBottomNavigationSlotIndex(navigationSection),
  );
  const pageSwipeActive = Math.abs(swipeProgress) > 0.001;
  const targetNavigationIndex = clamp(
    swipeProgress < 0
      ? activeNavigationIndex + 1
      : activeNavigationIndex - 1,
    0,
    primaryNavigation.length - 1,
  );
  const targetSection = primaryNavigation[targetNavigationIndex]?.id;
  const targetSlot = targetSection
    ? getBottomNavigationSlotIndex(targetSection)
    : activeSlot;
  const pageSelectorPosition = pageSwipeActive
    ? activeSlot +
      (targetSlot - activeSlot) * clamp(Math.abs(swipeProgress), 0, 1)
    : activeSlot;
  const selectorPosition = dragPosition ?? pageSelectorPosition;
  const dots = presentation === "dots";
  const compact = presentation === "compact";
  const notchHeight = dots ? 30 : compact ? 42 : 56;
  const notchInset = dots ? 2 : compact ? 2.5 : 4;
  const sportsContrast = activeSection === "sports";
  const dotAvailability = getNotchDotAvailability(activeNavigationIndex, primaryNavigation.length);

  function clearSuppressClickTimer() {
    if (suppressClickTimerRef.current === null) return;

    window.clearTimeout(suppressClickTimerRef.current);
    suppressClickTimerRef.current = null;
  }

  function suppressSyntheticClick() {
    suppressClickRef.current = true;
    clearSuppressClickTimer();
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, 0);
  }

  function positionFromClientX(clientX: number) {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0) return activeSlot;

    return clamp(
      ((clientX - bounds.left) / bounds.width) * SLOT_COUNT - 0.5,
      0,
      SLOT_COUNT - 1,
    );
  }

  function nearestSection(position: number) {
    return primaryNavigation.reduce(
      (nearest, item) => {
        const itemSlot = getBottomNavigationSlotIndex(item.id);
        const distance = Math.abs(itemSlot - position);

        return distance < nearest.distance
          ? { item, slot: itemSlot, distance }
          : nearest;
      },
      {
        item: primaryNavigation[activeNavigationIndex],
        slot: activeSlot,
        distance: Number.POSITIVE_INFINITY,
      },
    );
  }

  function activateSection(section: SwipeSection) {
    if (section === "mint" && activeSection === "mint") {
      onMintTap();
      return;
    }

    onSelect(section);
  }

  function beginScrub(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (
      event.target instanceof Element &&
      event.target.closest("[data-create-mint-action]")
    ) {
      return;
    }

    clearSuppressClickTimer();
    suppressClickRef.current = false;

    if (settleFrameRef.current !== null) {
      window.cancelAnimationFrame(settleFrameRef.current);
      settleFrameRef.current = null;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateScrub(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (
      !drag.dragging &&
      Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD_PX
    ) {
      return;
    }

    drag.dragging = true;
    const nextPosition = positionFromClientX(event.clientX);
    const next = nearestSection(nextPosition);

    setScrubbing(true);
    setDragPosition(nextPosition);
    setPreviewSection(next.item.id);
  }

  function finishScrub(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const next = nearestSection(positionFromClientX(event.clientX));
    suppressSyntheticClick();

    if (!drag.dragging) {
      activateSection(next.item.id);
      return;
    }

    setScrubbing(false);
    setDragPosition(next.slot);
    setPreviewSection(next.item.id);
    activateSection(next.item.id);

    settleFrameRef.current = window.requestAnimationFrame(() => {
      settleFrameRef.current = null;
      setDragPosition(null);
      setPreviewSection(null);
    });
  }

  function cancelScrub(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setScrubbing(false);
    setDragPosition(null);
    setPreviewSection(null);
  }

  useEffect(() => {
    return () => {
      clearSuppressClickTimer();

      if (settleFrameRef.current !== null) {
        window.cancelAnimationFrame(settleFrameRef.current);
      }
    };
  }, []);

  return (
    <nav
      data-bottom-bubble-nav
      data-active-section={activeSection}
      data-navigation-section={navigationSection}
      data-collapsed={presentation !== "expanded" ? "true" : "false"}
      data-notch-presentation={presentation}
      data-contrast={sportsContrast ? "sports" : "default"}
      aria-label="Campus Mint primary navigation"
      className="pointer-events-none fixed bottom-[max(0.6rem,env(safe-area-inset-bottom))] left-1/2 z-50 origin-bottom"
      style={{
        width: dots ? "4.25rem" : compact ? "min(calc(100vw - 4rem), 19rem)" : "min(calc(100vw - 3rem), 21.75rem)",
        transform: "translateX(-50%)",
        transition: reducedMotion
          ? "none"
          : `width ${motion.duration.standard}ms ${motion.easing.settle}, transform ${motion.duration.standard}ms ${motion.easing.settle}`,
      }}
    >
      <div
        ref={trackRef}
        onPointerDown={dots ? undefined : beginScrub}
        onPointerMove={dots ? undefined : updateScrub}
        onPointerUp={dots ? undefined : finishScrub}
        onPointerCancel={dots ? undefined : cancelScrub}
        className="pointer-events-auto relative isolate select-none overflow-hidden rounded-full"
        style={{
          height: notchHeight,
          padding: notchInset,
          transition: reducedMotion
            ? "none"
            : `height ${motion.duration.standard}ms ${motion.easing.settle}, padding ${motion.duration.standard}ms ${motion.easing.settle}, box-shadow ${motion.duration.fast}ms ease`,
          touchAction: "pan-y",
          background: "var(--app-surface)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-[1] transform-gpu will-change-transform"
          style={{
            opacity: dots ? 0 : 1,
            top: notchInset,
            bottom: notchInset,
            left: notchInset,
            width: `calc((100% - ${notchInset * 2}px) / ${SLOT_COUNT})`,
            transform: `translate3d(${selectorPosition * 100}%,0,0)`,
            transition:
              scrubbing || (pageSwipeActive && !swipeSettling)
                ? "none"
              : reducedMotion
                  ? "none"
                  : swipeSettling
                    ? `transform ${PAGE_SWIPE_SETTLE_MS}ms cubic-bezier(.22,1,.36,1)`
                    : `transform ${motion.duration.panelEnter}ms ${motion.easing.settle}`,
          }}
        >
          <div
            className="absolute inset-x-0.5 inset-y-0 overflow-hidden rounded-full"
            style={{
              background: "var(--app-accent-soft)",
            }}
          >
          </div>
        </div>

        <div
          className="relative z-10 grid h-full"
          style={{
            gridTemplateColumns: `repeat(${SLOT_COUNT}, minmax(0, 1fr))`,
            opacity: dots ? 0 : 1,
            transform: dots ? "scale(.72)" : "scale(1)",
            pointerEvents: dots ? "none" : "auto",
            transition: reducedMotion ? "none" : `opacity ${motion.duration.fast}ms ease, transform ${motion.duration.standard}ms ${motion.easing.settle}`,
          }}
        >
          {bottomNavigationSlots.map((slot) => {
            if (slot.kind === "action") {
              return (
                <button
                  key={slot.action.id}
                  type="button"
                  data-create-mint-action
                  aria-label={createMintAction.label}
                  title={createMintAction.label}
                  onClick={onCreateMint}
                  className="relative z-20 flex min-h-9 min-w-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[1.15rem] font-medium leading-none shadow-sm transition-transform duration-200"
                    style={{
                      backgroundColor: "var(--app-accent)",
                      color: "var(--app-accent-contrast)",
                    }}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </button>
              );
            }

            const item = slot.item;
            const selected = navigationSection === item.id;
            const previewed = previewSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-label={`Go to ${item.label}`}
                aria-current={
                  activeSection === item.id ? "page" : undefined
                }
                onClick={() => {
                  if (suppressClickRef.current) return;
                  activateSection(item.id);
                }}
                className="relative z-10 flex min-h-9 min-w-0 items-center justify-center rounded-full px-1 text-[0.66rem] font-semibold tracking-[-0.01em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent sm:text-[0.7rem]"
                style={{
                  color: sportsContrast
                    ? selected || previewed
                      ? "var(--app-text-primary)"
                      : "var(--app-text-secondary)"
                    : selected || previewed
                      ? "var(--app-text-primary)"
                      : "var(--app-text-secondary)",
                  transitionDuration: reducedMotion ? "0ms" : "160ms",
                }}
              >
                <span
                  className="max-w-full truncate transition-[font-size,opacity]"
                  style={{
                    fontSize: compact ? "0.63rem" : undefined,
                    opacity: compact ? 0.86 : 1,
                    transitionDuration: reducedMotion
                      ? "0ms"
                      : `${motion.duration.fast}ms`,
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onExpand} aria-label="Expand navigation" className="absolute inset-0 z-20 flex items-center justify-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]" style={{ opacity: dots ? 1 : 0, pointerEvents: dots ? "auto" : "none", transition: reducedMotion ? "none" : `opacity ${motion.duration.fast}ms ease` }}>
          <span className="h-1.5 w-1.5 rounded-full bg-slate-700 transition-opacity" style={{ opacity: dotAvailability.hasPrevious ? (swipeProgress > 0.08 ? 0.95 : 0.55) : 0.18 }} aria-hidden="true" />
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--app-accent)" }} aria-hidden="true" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-700 transition-opacity" style={{ opacity: dotAvailability.hasNext ? (swipeProgress < -0.08 ? 0.95 : 0.55) : 0.18 }} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
