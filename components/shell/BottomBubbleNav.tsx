"use client";

import { useRef, useState, type PointerEvent } from "react";

import { navigationSets, type PrimarySection } from "@/components/shell/navigation";
import type { UniversityTheme } from "@/data/universities";

type BottomBubbleNavProps = {
  activeSection: PrimarySection;
  activeSet: 0 | 1;
  theme: UniversityTheme;
  onSelect: (section: PrimarySection) => void;
  onSetChange: (set: 0 | 1) => void;
};

export function BottomBubbleNav({ activeSection, activeSet, theme, onSelect, onSetChange }: BottomBubbleNavProps) {
  const dragStart = useRef<{ x: number; pointerId: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  function beginSwipe(event: PointerEvent<HTMLDivElement>) {
    dragStart.current = { x: event.clientX, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateSwipe(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart.current || dragStart.current.pointerId !== event.pointerId) return;
    setDragOffset(Math.max(-52, Math.min(52, event.clientX - dragStart.current.x)));
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart.current || dragStart.current.pointerId !== event.pointerId) return;
    const distance = event.clientX - dragStart.current.x;
    dragStart.current = null;
    setDragOffset(0);
    if (Math.abs(distance) < 38) return;
    const nextSet = activeSet === 0 ? 1 : 0;
    onSetChange(nextSet);
    onSelect(nextSet === 0 ? "mint" : "groups");
  }

  return (
    <nav
      aria-label="Primary Campus Mint navigation"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="bubble-nav-shell overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.24)] backdrop-blur-xl">
        <div
          className="touch-pan-y select-none overflow-hidden"
          onPointerDown={beginSwipe}
          onPointerMove={updateSwipe}
          onPointerUp={finishSwipe}
          onPointerCancel={() => { dragStart.current = null; setDragOffset(0); }}
        >
          <div
            className="flex w-[200%] transition-transform duration-500 ease-[cubic-bezier(.22,.9,.28,1)] motion-reduce:transition-none"
            style={{ transform: `translateX(calc(${activeSet * -50}% + ${dragOffset}px))` }}
          >
            {navigationSets.map((set, setIndex) => (
              <div key={setIndex} className="grid w-1/2 shrink-0 grid-cols-5 items-end gap-1 px-1">
                {set.map((item, itemIndex) => {
                  const selected = activeSection === item.id;
                  const center = itemIndex === 2;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={selected ? "page" : undefined}
                      aria-label={item.label}
                      onClick={() => onSelect(item.id)}
                      className="group flex min-w-0 flex-col items-center gap-1 rounded-2xl py-1 focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ outlineColor: theme.primary }}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex items-center justify-center rounded-full font-black shadow-sm transition duration-300 group-active:scale-95 motion-reduce:transition-none ${center ? "h-14 w-14 text-xl" : selected ? "h-12 w-12 text-lg" : "h-10 w-10 text-base"}`}
                        style={selected || center
                          ? { backgroundColor: theme.primary, color: theme.secondary, boxShadow: `0 8px 24px color-mix(in srgb, ${theme.primary} 30%, transparent)` }
                          : { backgroundColor: theme.accent, color: theme.primary }}
                      >
                        {item.icon}
                      </span>
                      <span className={`truncate text-[10px] font-bold ${selected ? "text-slate-950" : "text-slate-500"}`}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1 flex justify-center gap-1.5" aria-label={`Navigation set ${activeSet + 1} of 2`}>
          {[0, 1].map((index) => (
            <span key={index} className="h-1 rounded-full transition-all" style={{ width: index === activeSet ? 22 : 6, backgroundColor: index === activeSet ? theme.primary : "#cbd5e1" }} />
          ))}
        </div>
      </div>
    </nav>
  );
}

