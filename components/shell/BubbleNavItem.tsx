"use client";

import { useEffect, useRef, type PointerEvent } from "react";

import type { PrimarySection } from "@/components/shell/navigation";

type BubbleNavItemProps = {
  id: PrimarySection;
  label: string;
  selected: boolean;
  reducedMotion: boolean;
  onSelect: (section: PrimarySection) => void;
};

function NavGlyph({ id }: { id: PrimarySection }) {
  if (id === "messages") {
    return (
      <svg
        viewBox="0 0 32 32"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <text
          x="16"
          y="21"
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          letterSpacing="-0.45"
          fill="currentColor"
        >
          DM
        </text>
      </svg>
    );
  }

  if (id === "search") {
    return (
      <svg viewBox="0 0 32 32" className="h-full w-full overflow-visible" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <circle cx="14" cy="14" r="9" />
        <path d="m20.5 20.5 6.5 6.5" strokeWidth="3.5" />
      </svg>
    );
  }

  if (id === "mint") {
    return (
      <svg viewBox="0 0 32 32" className="h-full w-full overflow-visible" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M25.8 5.5C17 5.8 8.6 9.9 7 18.1c-.8 4.3 2.6 7.7 6.8 6.4 7.8-2.4 10.7-10.6 12-19Z" strokeWidth="2.4" />
        <path d="M8.6 24.8c2.8-6.2 7.2-10.1 13.8-13.2" strokeWidth="2" />
        <path d="M13.4 18.7c1.9.1 3.7.5 5.2 1.2M16.7 14.5c.1-1.5-.1-2.8-.5-4" strokeWidth="1.45" opacity=".82" />
      </svg>
    );
  }

  if (id === "people") {
    return (
      <svg viewBox="0 0 32 32" className="h-full w-full overflow-visible" fill="currentColor">
        <circle cx="16" cy="10.5" r="5.1" />
        <path d="M6.8 27c.4-6.1 4-9.5 9.2-9.5s8.8 3.4 9.2 9.5H6.8Z" />
      </svg>
    );
  }

  if (id === "clubs") {
    return (
      <svg viewBox="0 0 32 32" className="h-full w-full overflow-visible">
        <text x="16" y="25" textAnchor="middle" fontSize="28" fontWeight="800" fill="currentColor">♣</text>
      </svg>
    );
  }

  if (id === "housing") {
    return (
      <svg viewBox="0 0 32 32" className="h-full w-full overflow-visible" fill="none" stroke="currentColor" strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15.5 16 5l12 10.5" />
        <path d="M7.5 13.5V27h17V13.5" />
        <path d="M13 27v-8h6v8" />
      </svg>
    );
  }

  if (id === "groups") {
    return (
      <svg viewBox="0 0 32 32" className="h-full w-full overflow-visible" fill="currentColor">
        <circle cx="11.5" cy="11" r="4.4" />
        <circle cx="21.8" cy="12.5" r="3.7" opacity=".82" />
        <path d="M3.5 27c.3-5.7 3.3-9 8-9 4.8 0 7.8 3.3 8.1 9H3.5Z" />
        <path d="M17.5 27c-.1-3.2-1.1-5.7-3-7.3 1.8-1.2 4.1-1.6 6.5-1.2 4 .7 6.4 3.6 6.6 8.5H17.5Z" opacity=".82" />
      </svg>
    );
  }

  if (id === "food") {
    return (
      <svg viewBox="0 0 32 32" className="h-full w-full overflow-visible" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 4v9M4.5 4v6c0 2.1 1.6 3.7 3.5 3.7s3.5-1.6 3.5-3.7V4M8 13v15" />
        <path d="M21 4v24M21 4c4 2 5.8 5.8 5.8 10.5H21" />
      </svg>
    );
  }

  if (id === "marketplace") {
    return (
      <svg viewBox="0 0 32 32" className="h-full w-full overflow-visible" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M20.8 8.3c-1.4-1.2-3.1-1.8-5-1.8-3.4 0-5.8 1.8-5.8 4.6 0 6.7 12.2 3 12.2 9.5 0 3-2.5 5-6.2 5-2.5 0-4.7-.8-6.3-2.4" />
        <path d="M16 3.5v25" />
      </svg>
    );
  }

  return null;
}

export function BubbleNavItem({
  id,
  label,
  selected,
  reducedMotion,
  onSelect,
}: BubbleNavItemProps) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  function restingTransform() {
    return `translate3d(0, ${selected ? -2.5 : 0}px, 10px) rotateX(0deg) rotateY(0deg) scale(${selected ? 1.09 : 1})`;
  }

  function moveIcon(transform: string, settling = false) {
    if (!iconRef.current) return;

    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      if (!iconRef.current) return;

      iconRef.current.style.transition = reducedMotion
        ? "none"
        : settling
          ? "transform 460ms cubic-bezier(.2,1.5,.3,1), filter 300ms ease"
          : "transform 80ms linear, filter 120ms ease";

      iconRef.current.style.transform = reducedMotion
        ? restingTransform()
        : transform;
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (reducedMotion) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const nx = (event.clientX - bounds.left) / bounds.width - 0.5;
    const ny = (event.clientY - bounds.top) / bounds.height - 0.5;

    const x = nx * 6.5;
    const y = ny * 5 + (selected ? -3 : 0);
    const rotateX = ny * -24;
    const rotateY = nx * 26;

    moveIcon(
      `translate3d(${x}px, ${y}px, 16px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${selected ? 1.17 : 1.11})`,
    );
  }

  function reset() {
    moveIcon(restingTransform(), true);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!iconRef.current) return;
      iconRef.current.style.transform = restingTransform();
    });

    return () => {
      window.cancelAnimationFrame(frame);

      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [selected]);

  const color = "#050505";

  const filter = selected
    ? "drop-shadow(0 6px 7px rgba(0,0,0,.22)) drop-shadow(0 2px 2px rgba(0,0,0,.12))"
    : "drop-shadow(0 4px 4px rgba(0,0,0,.14))";

  return (
    <button
      type="button"
      aria-current={selected ? "page" : undefined}
      aria-label={label}
      title={label}
      onClick={() => onSelect(id)}
      onPointerMove={handlePointerMove}
      onPointerDown={() => {
        if (!reducedMotion) {
          moveIcon(
            `translate3d(0, 1px, 5px) rotateX(8deg) scale(.91)`,
          );
        }
      }}
      onPointerUp={reset}
      onPointerCancel={reset}
      onPointerLeave={reset}
      className="relative z-10 flex h-11 w-full min-w-0 shrink-0 items-center justify-center overflow-visible rounded-xl p-0 hover:z-30 focus-visible:z-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
      style={{
        perspective: "180px",
        background: "transparent",
      }}
    >
      <span
        ref={iconRef}
        aria-hidden="true"
        className="block h-[35px] w-[35px] transform-gpu overflow-visible will-change-transform"
        style={{
          color,
          filter,
          transformStyle: "preserve-3d",
        }}
      >
        <NavGlyph id={id} />
      </span>
    </button>
  );
}
