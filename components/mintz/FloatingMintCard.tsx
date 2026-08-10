"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

type FloatingMintCardProps = {
  children: ReactNode;
  glowColor: string;
};

type CardTransform = { rotateX: number; rotateY: number; shiftX: number; shiftY: number };

const restingTransform: CardTransform = { rotateX: 0, rotateY: 0, shiftX: 0, shiftY: 0 };

export function FloatingMintCard({ children, glowColor }: FloatingMintCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [transform, setTransform] = useState<CardTransform>(restingTransform);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const update = () => setMotionAllowed(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  function interactiveTarget(event: PointerEvent<HTMLDivElement>) {
    return (event.target as HTMLElement).closest("button, input, textarea, a, [data-mint-carousel]");
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!motionAllowed || event.pointerType !== "touch" || interactiveTarget(event)) return;
    touchStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!motionAllowed || !cardRef.current) return;
    if (event.pointerType === "mouse") {
      const bounds = cardRef.current.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      setTransform({ rotateX: y * -2.2, rotateY: x * 2.6, shiftX: x * 1.5, shiftY: y * 1.5 });
      return;
    }
    if (!touchStart.current || touchStart.current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - touchStart.current.x;
    const deltaY = event.clientY - touchStart.current.y;
    setTransform({
      rotateX: Math.max(-1.1, Math.min(1.1, deltaY / -55)),
      rotateY: Math.max(-1.1, Math.min(1.1, deltaX / 55)),
      shiftX: Math.max(-2, Math.min(2, deltaX / 30)),
      shiftY: Math.max(-2, Math.min(2, deltaY / 30)),
    });
  }

  function reset() {
    touchStart.current = null;
    setTransform(restingTransform);
  }

  return (
    <div className="mint-perspective" data-floating-mint-card>
      <div
        ref={cardRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={reset}
        onPointerCancel={reset}
        onPointerLeave={reset}
        className="mint-float-layer touch-pan-y transition-transform duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none"
        style={{
          transform: `translate3d(${transform.shiftX}px, ${transform.shiftY}px, 0) rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg)`,
          filter: transform.rotateX || transform.rotateY ? `drop-shadow(0 22px 28px color-mix(in srgb, ${glowColor} 18%, transparent))` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

