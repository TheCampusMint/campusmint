"use client";

import { useRef, type PointerEvent } from "react";

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
  onSwipeDelta: (deltaSections: number, velocitySectionsPerMs: number) => void;
  onSwipeEnd: (velocitySectionsPerMs: number) => void;
  onSwipeCancel: () => void;
};

type DragState = {
  pointerId: number;
  lastX: number;
  lastTime: number;
  distance: number;
  velocity: number;
};

const navigation = [...dailyNavigation, ...secondaryNavigation];
const ITEM_STRIDE = 52;
const NAV_WIDTH = ITEM_STRIDE * 5;
const WINDOW_RADIUS = 7;

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
}: BottomBubbleNavProps) {
  const dragRef = useRef<DragState | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const shellFrameRef = useRef<number | null>(null);
  const didDragRef = useRef(false);

  const activeSet =
    mod(virtualIndex, navigation.length) < dailyNavigation.length ? 0 : 1;

  const visibleWindow = Array.from(
    { length: WINDOW_RADIUS * 2 + 1 },
    (_, slot) => {
      const itemVirtualIndex = virtualIndex + slot - WINDOW_RADIUS;
      return {
        virtualIndex: itemVirtualIndex,
        item: navigation[mod(itemVirtualIndex, navigation.length)],
      };
    },
  );

  const baseOffset =
    NAV_WIDTH / 2 - (WINDOW_RADIUS + 0.5) * ITEM_STRIDE;

  const trackOffset =
    baseOffset + swipeProgress * ITEM_STRIDE;

  function paintShell(x: number, y: number, settling = false) {
    if (reducedMotion || !shellRef.current) return;

    if (shellFrameRef.current) {
      window.cancelAnimationFrame(shellFrameRef.current);
    }

    shellFrameRef.current = window.requestAnimationFrame(() => {
      shellFrameRef.current = null;
      if (!shellRef.current) return;

      shellRef.current.style.transition = settling
        ? "transform 400ms cubic-bezier(.22,1,.36,1)"
        : "transform 55ms linear";

      shellRef.current.style.transform =
        `translate3d(${x}px, ${y}px, 0) rotateX(${y * -0.22}deg) rotateY(${x * 0.18}deg)`;
    });
  }

  function moveShell(event: PointerEvent<HTMLElement>) {
    if (reducedMotion || !shellRef.current) return;

    const bounds = shellRef.current.getBoundingClientRect();
    const nx = (event.clientX - bounds.left) / bounds.width - 0.5;
    const ny = (event.clientY - bounds.top) / bounds.height - 0.5;

    paintShell(nx * 3.2, ny * 2.2);
  }

  function resetShell() {
    paintShell(0, 0, true);
  }

  function beginSwipe(event: PointerEvent<HTMLDivElement>) {
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      distance: 0,
      velocity: 0,
    };

    didDragRef.current = false;
  }

  function updateSwipe(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.lastX;
    const elapsed = Math.max(1, event.timeStamp - drag.lastTime);

    drag.distance += Math.abs(deltaX);
    drag.velocity = deltaX / ITEM_STRIDE / elapsed;
    drag.lastX = event.clientX;
    drag.lastTime = event.timeStamp;

    if (drag.distance > 5) {
      didDragRef.current = true;

      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }

    onSwipeDelta(deltaX / ITEM_STRIDE, drag.velocity);
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    onSwipeEnd(drag.velocity);
  }

  function cancelSwipe() {
    dragRef.current = null;
    onSwipeCancel();
  }

  return (
    <nav
      data-bottom-bubble-nav
      aria-label="Primary Campus Mint navigation"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto w-fit max-w-full pb-[max(0.4rem,env(safe-area-inset-bottom))]"
    >
      <div
        ref={shellRef}
        onPointerMove={moveShell}
        onPointerLeave={resetShell}
        onPointerCancel={resetShell}
        className="relative isolate overflow-visible rounded-full border border-slate-200 bg-white/95 px-3 py-0.5 shadow-[0_12px_34px_rgba(15,23,42,0.18)] backdrop-blur-xl will-change-transform"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          className="relative touch-pan-y select-none py-1"
          style={{
            width: NAV_WIDTH,
            clipPath: "inset(-26px 0 -26px 0)",
          }}
          onPointerDown={beginSwipe}
          onPointerMove={updateSwipe}
          onPointerUp={finishSwipe}
          onPointerCancel={cancelSwipe}
          onClickCapture={(event) => {
            if (!didDragRef.current) return;
            event.preventDefault();
            event.stopPropagation();
            didDragRef.current = false;
          }}
        >
          <div
            className="flex w-max transform-gpu items-center will-change-transform"
            style={{
              transform: `translate3d(${trackOffset}px, 0, 0)`,
              transition:
                reducedMotion || !swipeSettling
                  ? "none"
                  : "transform 340ms cubic-bezier(.22,1,.36,1)",
            }}
          >
            {visibleWindow.map(({ virtualIndex: itemIndex, item }) => (
              <div
                key={itemIndex}
                className="flex shrink-0 items-center justify-center overflow-visible"
                style={{ width: ITEM_STRIDE }}
              >
                <BubbleNavItem
                  id={item.id}
                  label={item.label}
                  selected={activeSection === item.id}
                  reducedMotion={reducedMotion}
                  onSelect={onSelect}
                />
              </div>
            ))}
          </div>
        </div>

        <div
          className="pointer-events-none -mt-0.5 flex justify-center gap-1"
          aria-label={`Navigation set ${activeSet + 1} of 2`}
        >
          {[0, 1].map((index) => (
            <span
              key={index}
              className="h-[3px] rounded-full transition-all duration-300"
              style={{
                width: index === activeSet ? 15 : 4,
                backgroundColor:
                  index === activeSet
                    ? "var(--app-accent)"
                    : "var(--app-border)",
              }}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
