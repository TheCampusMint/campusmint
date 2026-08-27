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

type BottomBubbleNavProps = {
  activeSection: PrimarySection;
  navigationSection: SwipeSection;
  scrollY: number;
  swipeProgress: number;
  swipeSettling: boolean;
  reducedMotion: boolean;
  onSelect: (section: SwipeSection) => void;
  onMintTap: () => void;
  onCreateMint: () => void;
};

type DragState = {
  pointerId: number;
  startX: number;
  dragging: boolean;
};

const SLOT_COUNT = bottomNavigationSlots.length;
const DRAG_THRESHOLD_PX = 5;
const COMPACT_SCROLL_DISTANCE_PX = 160;
const PAGE_SWIPE_SETTLE_MS = 460;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function mod(value: number, length: number) {
  return ((value % length) + length) % length;
}

export function BottomBubbleNav({
  activeSection,
  navigationSection,
  scrollY,
  swipeProgress,
  swipeSettling,
  reducedMotion,
  onSelect,
  onMintTap,
  onCreateMint,
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
  const targetNavigationIndex =
    swipeProgress < 0
      ? mod(activeNavigationIndex + 1, primaryNavigation.length)
      : mod(activeNavigationIndex - 1, primaryNavigation.length);
  const targetSection = primaryNavigation[targetNavigationIndex]?.id;
  const targetSlot = targetSection
    ? getBottomNavigationSlotIndex(targetSection)
    : activeSlot;
  const pageSelectorPosition = pageSwipeActive
    ? activeSlot +
      (targetSlot - activeSlot) * clamp(Math.abs(swipeProgress), 0, 1)
    : activeSlot;
  const selectorPosition = dragPosition ?? pageSelectorPosition;
  const compactProgress = clamp(
    scrollY / COMPACT_SCROLL_DISTANCE_PX,
    0,
    1,
  );
  const notchHeight = 46 - compactProgress * 1.5;
  const notchInset = 3 - compactProgress * 0.25;
  const notchScaleX = 1 - compactProgress * 0.012;
  const sportsContrast = activeSection === "sports";

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
      data-contrast={sportsContrast ? "sports" : "default"}
      aria-label="Campus Mint primary navigation"
      className="pointer-events-none fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 z-50 w-[min(calc(100vw-1rem),30rem)] origin-bottom"
      style={{
        transform: `translateX(-50%) scaleX(${notchScaleX})`,
        transition: reducedMotion
          ? "none"
          : "transform 180ms cubic-bezier(.22,.8,.3,1)",
      }}
    >
      <div
        ref={trackRef}
        onPointerDown={beginScrub}
        onPointerMove={updateScrub}
        onPointerUp={finishScrub}
        onPointerCancel={cancelScrub}
        className="pointer-events-auto relative isolate select-none overflow-hidden rounded-full border"
        style={{
          height: notchHeight,
          padding: notchInset,
          touchAction: "pan-y",
          background: sportsContrast
            ? "linear-gradient(180deg, rgba(255,255,255,.82), rgba(226,232,240,.66))"
            : "linear-gradient(180deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,.055) 38%, rgba(15,23,42,.035) 100%), linear-gradient(112deg, color-mix(in srgb, var(--app-surface-elevated) 30%, transparent) 0%, color-mix(in srgb, var(--app-surface) 18%, transparent) 54%, color-mix(in srgb, var(--app-accent-soft) 16%, transparent) 100%)",
          borderColor: sportsContrast
            ? "rgba(255,255,255,.82)"
            : "color-mix(in srgb, var(--app-border) 38%, rgba(255,255,255,.34))",
          backdropFilter:
            sportsContrast
              ? "blur(24px) saturate(1.5) brightness(1.05)"
              : "blur(19px) saturate(1.42) brightness(1.06)",
          WebkitBackdropFilter:
            sportsContrast
              ? "blur(24px) saturate(1.5) brightness(1.05)"
              : "blur(19px) saturate(1.42) brightness(1.06)",
          boxShadow: sportsContrast
            ? "inset 0 1px 0 rgba(255,255,255,.92), 0 10px 30px rgba(1,25,17,.3), 0 2px 8px rgba(1,25,17,.2)"
            : "inset 0 1px 0 rgba(255,255,255,.46), inset 0 -1px 0 rgba(15,23,42,.055), 0 7px 22px rgba(15,23,42,.085), 0 1px 4px rgba(15,23,42,.06)",
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
          style={{
            background: sportsContrast
              ? "radial-gradient(120% 90% at 18% -12%, rgba(255,255,255,.9), transparent 55%), radial-gradient(85% 100% at 88% 115%, rgba(5,78,59,.08), transparent 62%)"
              : "radial-gradient(120% 85% at 18% -12%, rgba(255,255,255,.28), transparent 52%), radial-gradient(85% 100% at 88% 115%, color-mix(in srgb, var(--app-accent) 9%, transparent), transparent 62%)",
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-4 top-px z-0 h-px rounded-full bg-white/45"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-[1] transform-gpu will-change-transform"
          style={{
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
                    : "transform 440ms cubic-bezier(.18,.88,.24,1.055)",
          }}
        >
          <div
            className="absolute inset-x-0.5 inset-y-0 overflow-hidden rounded-full border"
            style={{
              background: sportsContrast
                ? "linear-gradient(145deg, rgba(255,255,255,.9), rgba(209,250,229,.62))"
                : "linear-gradient(145deg, rgba(255,255,255,.28) 0%, color-mix(in srgb, var(--app-surface-elevated) 18%, transparent) 34%, color-mix(in srgb, var(--app-accent-soft) 17%, transparent) 67%, rgba(15,23,42,.045) 100%)",
              borderColor:
                "color-mix(in srgb, var(--app-accent) 20%, rgba(255,255,255,.48))",
              backdropFilter:
                "blur(26px) saturate(1.68) brightness(1.12)",
              WebkitBackdropFilter:
                "blur(26px) saturate(1.68) brightness(1.12)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,.68), inset 1px 0 0 rgba(255,255,255,.24), inset 0 -1px 0 rgba(15,23,42,.09), 0 4px 11px rgba(15,23,42,.095), 0 1px 2px rgba(15,23,42,.07)",
              filter: scrubbing
                ? "brightness(1.08) saturate(1.12)"
                : "brightness(1) saturate(1)",
              transition: reducedMotion
                ? "none"
                : "filter 160ms ease, box-shadow 180ms ease",
            }}
          >
            <span className="absolute inset-x-2 top-0 h-px bg-white/80" />
            <span className="absolute -left-1 top-1 h-3 w-5 rounded-full bg-white/30 blur-[3px]" />
            <span
              className="absolute inset-x-1 bottom-0 h-px opacity-35"
              style={{ backgroundColor: "var(--app-accent)" }}
            />
          </div>
        </div>

        <div
          className="relative z-10 grid h-full"
          style={{
            gridTemplateColumns: `repeat(${SLOT_COUNT}, minmax(0, 1fr))`,
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
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[1.15rem] font-medium leading-none shadow-sm"
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
                      ? "#052e2b"
                      : "#1e293b"
                    : selected || previewed
                      ? "var(--app-text-primary)"
                      : "var(--app-text-secondary)",
                  transitionDuration: reducedMotion ? "0ms" : "160ms",
                }}
              >
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
