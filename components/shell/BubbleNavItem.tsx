"use client";

import { useEffect, useRef, type PointerEvent } from "react";

import type { PrimarySection } from "@/components/shell/navigation";

type BubbleNavItemProps = {
  id: PrimarySection;
  label: string;
  icon: string;
  selected: boolean;
  center: boolean;
  reducedMotion: boolean;
  onSelect: (section: PrimarySection) => void;
};

export function BubbleNavItem({ id, label, icon, selected, center, reducedMotion, onSelect }: BubbleNavItemProps) {
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const animationFrame = useRef<number | null>(null);

  function baseTransform() {
    return `translate3d(0, ${selected ? -4 : 0}px, 0) scale(${selected ? 1.04 : 1})`;
  }

  function moveBubble(transform: string, settling = false) {
    if (!bubbleRef.current) return;
    if (animationFrame.current) window.cancelAnimationFrame(animationFrame.current);
    animationFrame.current = window.requestAnimationFrame(() => {
      animationFrame.current = null;
      if (!bubbleRef.current) return;
      bubbleRef.current.style.transition = reducedMotion ? "none" : settling ? "transform 460ms cubic-bezier(.2,1.45,.3,1), box-shadow 360ms ease" : "transform 90ms linear, box-shadow 140ms ease";
      bubbleRef.current.style.transform = reducedMotion ? baseTransform() : transform;
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (reducedMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 5;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 4;
    moveBubble(`translate3d(${x}px, ${y + (selected ? -5 : -1)}px, 0) scale(${selected ? 1.075 : 1.045})`);
  }

  function reset() {
    moveBubble(baseTransform(), true);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!bubbleRef.current) return;
      bubbleRef.current.style.transition = reducedMotion ? "none" : "transform 460ms cubic-bezier(.2,1.45,.3,1), box-shadow 360ms ease";
      bubbleRef.current.style.transform = `translate3d(0, ${selected ? -4 : 0}px, 0) scale(${selected ? 1.04 : 1})`;
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (animationFrame.current) window.cancelAnimationFrame(animationFrame.current);
    };
  }, [reducedMotion, selected]);

  return (
    <button type="button" aria-current={selected ? "page" : undefined} aria-label={label} onClick={() => onSelect(id)} onPointerMove={handlePointerMove} onPointerDown={() => { if (!reducedMotion) moveBubble(`translate3d(0, ${selected ? -2 : 1}px, 0) scale(.95)`); }} onPointerUp={reset} onPointerCancel={reset} onPointerLeave={reset} className="group flex min-w-0 flex-col items-center gap-1 rounded-2xl py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]">
      <span ref={bubbleRef} aria-hidden="true" className={`flex transform-gpu items-center justify-center rounded-full font-black shadow-sm will-change-transform ${center ? "h-14 w-14 text-xl" : selected ? "h-12 w-12 text-lg" : "h-10 w-10 text-base"}`} style={selected || center ? { backgroundColor: "var(--app-accent)", color: "var(--app-accent-contrast)", boxShadow: "0 9px 25px color-mix(in srgb, var(--app-accent) 28%, transparent)" } : { backgroundColor: "var(--app-accent-soft)", color: "var(--app-accent)" }}>
        {icon}
      </span>
      <span className="truncate text-[10px] font-bold" style={{ color: selected ? "var(--app-text-primary)" : "var(--app-text-secondary)" }}>{label}</span>
    </button>
  );
}
