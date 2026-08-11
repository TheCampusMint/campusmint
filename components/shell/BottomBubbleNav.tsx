"use client";

import { useEffect, useRef, type PointerEvent } from "react";

import { BubbleNavItem } from "@/components/shell/BubbleNavItem";
import {
  dailyNavigation,
  secondaryNavigation,
  type PrimarySection,
} from "@/components/shell/navigation";

type BottomBubbleNavProps = {
  activeSection: PrimarySection;
  activeSet: 0 | 1;
  reducedMotion: boolean;
  onSelect: (section: PrimarySection) => void;
  onSetChange: (set: 0 | 1) => void;
};

type DragState = {
  pointerId: number;
  lastX: number;
  lastTime: number;
  velocity: number;
  distance: number;
};

const pageSets = [dailyNavigation, secondaryNavigation] as const;
const REPEAT_COUNT = 7;
const CENTER_REPEAT = 3;
const SNAP_DURATION = 430;

export function BottomBubbleNav({
  activeSection,
  activeSet,
  reducedMotion,
  onSelect,
  onSetChange,
}: BottomBubbleNavProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const pageWidthRef = useRef(288);
  const offsetRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);

  const trackFrameRef = useRef<number | null>(null);
  const shellFrameRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  const didDragRef = useRef(false);

  function canonicalPage(set: 0 | 1) {
    return CENTER_REPEAT * 2 + set;
  }

  function normalizeOffset(value: number) {
    const pageWidth = pageWidthRef.current;
    const loopWidth = pageWidth * 2;

    const upper = -(CENTER_REPEAT - 1) * loopWidth;
    const lower = -(CENTER_REPEAT + 1) * loopWidth - pageWidth;

    let next = value;

    while (next > upper) next -= loopWidth;
    while (next < lower) next += loopWidth;

    return next;
  }

  function paintTrack(
    value: number,
    settling = false,
    normalize = true,
  ) {
    const next = normalize ? normalizeOffset(value) : value;
    offsetRef.current = next;

    if (trackFrameRef.current) {
      window.cancelAnimationFrame(trackFrameRef.current);
    }

    trackFrameRef.current = window.requestAnimationFrame(() => {
      trackFrameRef.current = null;
      if (!trackRef.current) return;

      trackRef.current.style.transition =
        reducedMotion || !settling
          ? "none"
          : `transform ${SNAP_DURATION}ms cubic-bezier(.18,1.18,.28,1)`;

      trackRef.current.style.transform =
        `translate3d(${offsetRef.current}px, 0, 0)`;
    });
  }

  function recenter(set: 0 | 1) {
    const pageWidth = pageWidthRef.current;
    paintTrack(-canonicalPage(set) * pageWidth, false, false);
  }

  function snapToClosestPage(velocity = 0) {
    const pageWidth = pageWidthRef.current;

    // Small velocity projection gives the release a magnetic/flick feel.
    const projectedOffset = offsetRef.current + velocity * 85;
    let page = Math.round(-projectedOffset / pageWidth);

    const nextSet = (((page % 2) + 2) % 2) as 0 | 1;

    // Keep the animation in the nearby repeated copies.
    while (page < CENTER_REPEAT * 2 - 2) page += 2;
    while (page > CENTER_REPEAT * 2 + 3) page -= 2;

    paintTrack(-page * pageWidth, true, false);

    onSetChange(nextSet);
    onSelect(nextSet === 0 ? "mint" : "groups");

    if (settleTimerRef.current) {
      window.clearTimeout(settleTimerRef.current);
    }

    settleTimerRef.current = window.setTimeout(() => {
      recenter(nextSet);
    }, SNAP_DURATION + 30);
  }

  function paintShell(x: number, y: number, settling = false) {
    if (reducedMotion || !shellRef.current) return;

    if (shellFrameRef.current) {
      window.cancelAnimationFrame(shellFrameRef.current);
    }

    shellFrameRef.current = window.requestAnimationFrame(() => {
      shellFrameRef.current = null;
      if (!shellRef.current) return;

      shellRef.current.style.transition = settling
        ? "transform 420ms cubic-bezier(.2,1.35,.3,1)"
        : "transform 85ms linear";

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
    if (settleTimerRef.current) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
      distance: 0,
    };

    didDragRef.current = false;

    if (trackRef.current) {
      trackRef.current.style.transition = "none";
    }
  }

  function updateSwipe(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) return;

    const delta = event.clientX - drag.lastX;
    const elapsed = Math.max(1, event.timeStamp - drag.lastTime);

    drag.velocity = delta / elapsed;
    drag.distance += Math.abs(delta);
    drag.lastX = event.clientX;
    drag.lastTime = event.timeStamp;

    if (drag.distance > 3) {
      didDragRef.current = true;

      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }

    // No edge resistance. Keep dragging through repeating copies forever.
    paintTrack(offsetRef.current + delta);
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) return;

    const velocity = drag.velocity;
    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    snapToClosestPage(velocity);
  }

  function cancelSwipe() {
    const velocity = dragRef.current?.velocity ?? 0;
    dragRef.current = null;
    snapToClosestPage(velocity);
  }

  function selectSection(section: PrimarySection) {
    const nextSet: 0 | 1 = secondaryNavigation.some(
      (item) => item.id === section,
    )
      ? 1
      : 0;

    onSetChange(nextSet);
    onSelect(section);

    if (nextSet !== activeSet) {
      recenter(nextSet);
    }
  }

  useEffect(() => {
    function measure() {
      if (!viewportRef.current) return;

      pageWidthRef.current = viewportRef.current.clientWidth;
      recenter(activeSet);
    }

    const frame = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);

      if (trackFrameRef.current) {
        window.cancelAnimationFrame(trackFrameRef.current);
      }

      if (shellFrameRef.current) {
        window.cancelAnimationFrame(shellFrameRef.current);
      }

      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  return (
    <nav
      aria-label="Primary Campus Mint navigation"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto w-fit max-w-full pb-[max(0.4rem,env(safe-area-inset-bottom))]"
    >
      <div
        ref={shellRef}
        onPointerMove={moveShell}
        onPointerLeave={resetShell}
        onPointerCancel={resetShell}
        className="relative isolate overflow-visible rounded-[1.25rem] border border-slate-200 bg-white/95 px-1.5 py-1 shadow-[0_12px_34px_rgba(15,23,42,0.18)] backdrop-blur-xl will-change-transform"
        style={{
          transformStyle: "preserve-3d",
        }}
      >
        <div
          ref={viewportRef}
          className="relative touch-pan-y select-none py-1.5"
          style={{
            width: "min(288px, calc(100vw - 24px))",
            clipPath: "inset(-22px 0 -22px 0)",
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
            ref={trackRef}
            className="flex w-max transform-gpu items-center will-change-transform"
          >
            {Array.from({ length: REPEAT_COUNT }, (_, repeatIndex) =>
              pageSets.map((set, setIndex) => (
                <div
                  key={`${repeatIndex}-${setIndex}`}
                  className="grid shrink-0 grid-cols-5 items-center gap-1 px-1.5"
                  style={{
                    width: "min(288px, calc(100vw - 24px))",
                  }}
                >
                  {set.map((item) => (
                    <BubbleNavItem
                      key={`${repeatIndex}-${setIndex}-${item.id}`}
                      id={item.id}
                      label={item.label}
                      selected={activeSection === item.id}
                      reducedMotion={reducedMotion}
                      onSelect={selectSection}
                    />
                  ))}
                </div>
              )),
            )}
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
