"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import { BubbleNavItem } from "@/components/shell/BubbleNavItem";
import {
  dailyNavigation,
  secondaryNavigation,
  type PrimarySection,
} from "@/components/shell/navigation";

type BottomBubbleNavProps = {
  activeSection: PrimarySection;
  virtualIndex: number;
  swipeProgress: number;
  swipeSettling: boolean;
  reducedMotion: boolean;
  onSelect: (section: PrimarySection) => void;
  onSwipeDelta: (
    deltaSections: number,
    velocitySectionsPerMs: number,
  ) => void;
  onSwipeEnd: (velocitySectionsPerMs: number) => void;
  onSwipeCancel: () => void;
  onMintTap: () => void;
};

type DragState = {
  pointerId: number;
  lastX: number;
  lastTime: number;
  distance: number;
  velocity: number;
};

const navigation = [...dailyNavigation, ...secondaryNavigation];

const ITEM_STRIDE = 38;
const NAV_WIDTH = ITEM_STRIDE * 5;
const WINDOW_RADIUS = 7;
const HOLD_MS = 230;

function mod(value: number, length: number) {
  return ((value % length) + length) % length;
}

export function BottomBubbleNav({
  activeSection,
  virtualIndex,
  swipeProgress,
  swipeSettling,
  reducedMotion,
  onSelect,
  onSwipeDelta,
  onSwipeEnd,
  onSwipeCancel,
  onMintTap,
}: BottomBubbleNavProps) {
  const [expanded, setExpandedState] = useState(false);

  const expandedRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const holdTimerRef = useRef<number | null>(null);

  const swipeFrameRef = useRef<number | null>(null);
  const pendingDeltaRef = useRef(0);
  const pendingVelocityRef = useRef(0);

  function setExpanded(next: boolean) {
    expandedRef.current = next;
    setExpandedState(next);
  }

  const visibleWindow = Array.from(
    { length: WINDOW_RADIUS * 2 + 1 },
    (_, slot) => {
      const itemVirtualIndex =
        virtualIndex + slot - WINDOW_RADIUS;

      return {
        virtualIndex: itemVirtualIndex,
        item:
          navigation[
            mod(itemVirtualIndex, navigation.length)
          ],
      };
    },
  );

  const baseOffset =
    NAV_WIDTH / 2 -
    (WINDOW_RADIUS + 0.5) * ITEM_STRIDE;

  const trackOffset =
    baseOffset + swipeProgress * ITEM_STRIDE;

  function clearHoldTimer() {
    if (holdTimerRef.current === null) return;

    window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }

  function flushSwipeFrame() {
    if (swipeFrameRef.current !== null) {
      window.cancelAnimationFrame(swipeFrameRef.current);
      swipeFrameRef.current = null;
    }

    const delta = pendingDeltaRef.current;
    const velocity = pendingVelocityRef.current;

    pendingDeltaRef.current = 0;

    if (delta !== 0) {
      onSwipeDelta(delta, velocity);
    }
  }

  function queueSwipe(
    deltaSections: number,
    velocitySectionsPerMs: number,
  ) {
    pendingDeltaRef.current += deltaSections;
    pendingVelocityRef.current = velocitySectionsPerMs;

    if (swipeFrameRef.current !== null) return;

    swipeFrameRef.current =
      window.requestAnimationFrame(() => {
        swipeFrameRef.current = null;

        const delta = pendingDeltaRef.current;
        const velocity = pendingVelocityRef.current;

        pendingDeltaRef.current = 0;

        if (delta !== 0) {
          onSwipeDelta(delta, velocity);
        }
      });
  }

  function beginInteraction(
    event: PointerEvent<HTMLDivElement>,
  ) {
    clearHoldTimer();

    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      distance: 0,
      velocity: 0,
    };

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      setExpanded(true);
    }, HOLD_MS);
  }

  function moveInteraction(
    event: PointerEvent<HTMLDivElement>,
  ) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - drag.lastX;
    const elapsed = Math.max(
      1,
      event.timeStamp - drag.lastTime,
    );

    drag.distance += Math.abs(deltaX);
    const instantaneousVelocity =
      deltaX / ITEM_STRIDE / elapsed;

    drag.velocity =
      drag.velocity * 0.45 +
      instantaneousVelocity * 0.55;

    drag.lastX = event.clientX;
    drag.lastTime = event.timeStamp;

    // Keep tracking before expansion so there is no jump
    // at the moment the notch opens.
    if (!expandedRef.current) return;

    queueSwipe(
      deltaX / (ITEM_STRIDE * 0.94),
      drag.velocity,
    );
  }

  function finishInteraction(
    event: PointerEvent<HTMLDivElement>,
  ) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    clearHoldTimer();
    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    if (expandedRef.current) {
      flushSwipeFrame();
      onSwipeEnd(drag.velocity);
      setExpanded(false);
      return;
    }

    if (drag.distance < 8) {
      onMintTap();
    }
  }

  function cancelInteraction(
    event: PointerEvent<HTMLDivElement>,
  ) {
    clearHoldTimer();

    if (
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    dragRef.current = null;

    if (swipeFrameRef.current !== null) {
      window.cancelAnimationFrame(
        swipeFrameRef.current,
      );
      swipeFrameRef.current = null;
    }

    pendingDeltaRef.current = 0;

    if (expandedRef.current) {
      onSwipeCancel();
    }

    setExpanded(false);
  }

  useEffect(() => {
    return () => {
      clearHoldTimer();

      if (swipeFrameRef.current !== null) {
        window.cancelAnimationFrame(
          swipeFrameRef.current,
        );
      }
    };
  }, []);

  return (
    <nav
      data-bottom-bubble-nav
      aria-label="Campus Mint navigation"
      className="pointer-events-none fixed bottom-[max(0.4rem,env(safe-area-inset-bottom))] left-1/2 z-50 h-0 w-0 -translate-x-1/2 overflow-visible bg-transparent p-0"
    >
      <div
        onPointerDown={beginInteraction}
        onPointerMove={moveInteraction}
        onPointerUp={finishInteraction}
        onPointerCancel={cancelInteraction}
        className={
          expanded
            ? "pointer-events-auto absolute bottom-0 left-1/2 flex h-11 -translate-x-1/2 items-center justify-center overflow-visible rounded-full border border-slate-200 bg-white/95 px-1 shadow-[0_8px_24px_rgba(15,23,42,0.14)] backdrop-blur-xl"
            : "pointer-events-auto absolute bottom-0 left-1/2 flex h-5 w-10 -translate-x-1/2 items-center justify-center overflow-visible bg-transparent"
        }
        style={{
          touchAction: expanded ? "none" : "manipulation",
          transition: reducedMotion
            ? "none"
            : "width 360ms cubic-bezier(.22,1,.36,1), height 360ms cubic-bezier(.22,1,.36,1), background-color 260ms ease, box-shadow 300ms ease",
        }}
      >
        {!expanded ? (
          <div
            className="pointer-events-none flex h-4 w-4 items-center justify-center text-black"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 32 32"
              className="h-3 w-3 overflow-visible"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d="M25.8 5.5C17 5.8 8.6 9.9 7 18.1c-.8 4.3 2.6 7.7 6.8 6.4 7.8-2.4 10.7-10.6 12-19Z"
                strokeWidth="2.4"
              />
              <path
                d="M8.6 24.8c2.8-6.2 7.2-10.1 13.8-13.2"
                strokeWidth="2"
              />
              <path
                d="M13.4 18.7c1.9.1 3.7.5 5.2 1.2M16.7 14.5c.1-1.5-.1-2.8-.5-4"
                strokeWidth="1.45"
                opacity=".82"
              />
            </svg>
          </div>
        ) : (
          <div
            className="relative select-none overflow-visible"
            style={{
              width: NAV_WIDTH,
              clipPath: "inset(-24px 0 -24px 0)",
            }}
          >
            <div
              className="flex w-max transform-gpu items-center will-change-transform"
              style={{
                transform:
                  `translate3d(${trackOffset}px,0,0)`,
                transition:
                  reducedMotion || !swipeSettling
                    ? "none"
                    : "transform 300ms cubic-bezier(.22,1,.36,1)",
              }}
            >
              {visibleWindow.map(
                ({
                  virtualIndex: itemIndex,
                  item,
                }) => (
                  <div
                    key={itemIndex}
                    className="flex shrink-0 items-center justify-center overflow-visible"
                    style={{ width: ITEM_STRIDE }}
                  >
                    <BubbleNavItem
                      id={item.id}
                      label={item.label}
                      selected={
                        activeSection === item.id
                      }
                      reducedMotion={reducedMotion}
                      onSelect={onSelect}
                    />
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
