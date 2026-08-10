"use client";

import { useEffect, useRef, type PointerEvent } from "react";

import { BubbleNavItem } from "@/components/shell/BubbleNavItem";
import { navigationSets, type PrimarySection } from "@/components/shell/navigation";

type BottomBubbleNavProps = {
  activeSection: PrimarySection;
  activeSet: 0 | 1;
  reducedMotion: boolean;
  onSelect: (section: PrimarySection) => void;
  onSetChange: (set: 0 | 1) => void;
};

type DragState = {
  startX: number;
  lastX: number;
  lastTime: number;
  velocity: number;
  pointerId: number;
};

export function BottomBubbleNav({ activeSection, activeSet, reducedMotion, onSelect, onSetChange }: BottomBubbleNavProps) {
  const drag = useRef<DragState | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const animationFrame = useRef<number | null>(null);
  const didSwipe = useRef(false);

  function paintTrack(offset: number, settling = false) {
    if (animationFrame.current) window.cancelAnimationFrame(animationFrame.current);
    animationFrame.current = window.requestAnimationFrame(() => {
      animationFrame.current = null;
      if (!trackRef.current) return;
      trackRef.current.style.transition = reducedMotion ? "none" : settling ? "transform 480ms cubic-bezier(.18,.92,.25,1.08)" : "none";
      trackRef.current.style.transform = `translate3d(calc(${activeSet * -50}% + ${offset}px),0,0)`;
    });
  }

  function beginSwipe(event: PointerEvent<HTMLDivElement>) {
    drag.current = { startX: event.clientX, lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, pointerId: event.pointerId };
    didSwipe.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateSwipe(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const elapsed = Math.max(1, event.timeStamp - drag.current.lastTime);
    drag.current.velocity = (event.clientX - drag.current.lastX) / elapsed;
    drag.current.lastX = event.clientX;
    drag.current.lastTime = event.timeStamp;
    let offset = event.clientX - drag.current.startX;
    if ((activeSet === 0 && offset > 0) || (activeSet === 1 && offset < 0)) offset *= 0.32;
    paintTrack(Math.max(-78, Math.min(78, offset)));
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.current.startX;
    const velocity = drag.current.velocity;
    drag.current = null;
    didSwipe.current = Math.abs(distance) > 12;
    let nextSet = activeSet;
    if (activeSet === 0 && (distance < -34 || velocity < -0.32)) nextSet = 1;
    if (activeSet === 1 && (distance > 34 || velocity > 0.32)) nextSet = 0;
    if (nextSet !== activeSet) {
      onSetChange(nextSet);
      onSelect(nextSet === 0 ? "mint" : "groups");
    } else {
      paintTrack(0, true);
    }
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!trackRef.current) return;
      trackRef.current.style.transition = reducedMotion ? "none" : "transform 480ms cubic-bezier(.18,.92,.25,1.08)";
      trackRef.current.style.transform = `translate3d(${activeSet * -50}%,0,0)`;
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (animationFrame.current) window.cancelAnimationFrame(animationFrame.current);
    };
  }, [activeSet, reducedMotion]);

  return (
    <nav aria-label="Primary Campus Mint navigation" className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="bubble-nav-shell overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-[0_20px_60px_rgba(15,23,42,0.24)] backdrop-blur-xl">
        <div className="touch-pan-y select-none overflow-hidden" onPointerDown={beginSwipe} onPointerMove={updateSwipe} onPointerUp={finishSwipe} onPointerCancel={() => { drag.current = null; paintTrack(0, true); }} onClickCapture={(event) => { if (!didSwipe.current) return; event.preventDefault(); event.stopPropagation(); didSwipe.current = false; }}>
          <div ref={trackRef} className="flex w-[200%] transform-gpu will-change-transform">
            {navigationSets.map((set, setIndex) => (
              <div key={setIndex} className="grid w-1/2 shrink-0 grid-cols-5 items-end gap-1 px-1">
                {set.map((item, itemIndex) => <BubbleNavItem key={item.id} id={item.id} label={item.label} icon={item.icon} selected={activeSection === item.id} center={itemIndex === 2} reducedMotion={reducedMotion} onSelect={onSelect} />)}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1 flex justify-center gap-1.5" aria-label={`Navigation set ${activeSet + 1} of 2`}>
          {[0, 1].map((index) => <span key={index} className="h-1 rounded-full transition-all" style={{ width: index === activeSet ? 22 : 6, backgroundColor: index === activeSet ? "var(--app-accent)" : "var(--app-border)" }} />)}
        </div>
      </div>
    </nav>
  );
}
