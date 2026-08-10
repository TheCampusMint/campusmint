"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

type FloatingMintCardProps = {
  children: ReactNode;
  glowColor: string;
  reducedMotion?: boolean;
};

type CardTransform = { rotateX: number; rotateY: number; shiftX: number; shiftY: number; scale: number };

const restingTransform: CardTransform = { rotateX: 0, rotateY: 0, shiftX: 0, shiftY: 0, scale: 1 };

export function FloatingMintCard({ children, glowColor, reducedMotion = false }: FloatingMintCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const queuedTransform = useRef<CardTransform>(restingTransform);
  const animationFrame = useRef<number | null>(null);
  const [systemMotionAllowed, setSystemMotionAllowed] = useState(false);
  const motionAllowed = systemMotionAllowed && !reducedMotion;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const update = () => setSystemMotionAllowed(query.matches);
    update();
    query.addEventListener("change", update);
    return () => {
      query.removeEventListener("change", update);
      if (animationFrame.current) window.cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  function interactiveTarget(event: PointerEvent<HTMLDivElement>) {
    return (event.target as HTMLElement).closest("button, input, textarea, select, a, [data-mint-carousel]");
  }

  function paintTransform(transform: CardTransform, settling = false) {
    queuedTransform.current = transform;
    if (animationFrame.current) return;
    animationFrame.current = window.requestAnimationFrame(() => {
      animationFrame.current = null;
      if (!cardRef.current) return;
      cardRef.current.style.transition = settling
        ? "transform 560ms cubic-bezier(.2,1.35,.32,1), filter 420ms ease"
        : "transform 90ms linear, filter 160ms ease";
      cardRef.current.style.transform = `translate3d(${queuedTransform.current.shiftX}px, ${queuedTransform.current.shiftY}px, 0) rotateX(${queuedTransform.current.rotateX}deg) rotateY(${queuedTransform.current.rotateY}deg) scale(${queuedTransform.current.scale})`;
      const active = queuedTransform.current.rotateX !== 0 || queuedTransform.current.rotateY !== 0;
      cardRef.current.style.filter = `drop-shadow(${active ? queuedTransform.current.shiftX * -0.35 : 0}px ${active ? 22 : 15}px ${active ? 30 : 25}px color-mix(in srgb, ${glowColor} ${active ? 19 : 12}%, transparent))`;
    });
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
      paintTransform({ rotateX: y * -3.1, rotateY: x * 3.6, shiftX: x * 2.6, shiftY: y * 2.3, scale: 1.006 });
      return;
    }
    if (!touchStart.current || touchStart.current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - touchStart.current.x;
    const deltaY = event.clientY - touchStart.current.y;
    paintTransform({
      rotateX: Math.max(-1.4, Math.min(1.4, deltaY / -48)),
      rotateY: Math.max(-1.4, Math.min(1.4, deltaX / 48)),
      shiftX: Math.max(-2.5, Math.min(2.5, deltaX / 26)),
      shiftY: Math.max(-2.5, Math.min(2.5, deltaY / 26)),
      scale: 1.003,
    });
  }

  function reset() {
    touchStart.current = null;
    paintTransform(restingTransform, true);
  }

  useEffect(() => {
    if (!motionAllowed && cardRef.current) {
      cardRef.current.style.transition = "none";
      cardRef.current.style.transform = "translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1)";
      cardRef.current.style.filter = `drop-shadow(0 15px 25px color-mix(in srgb, ${glowColor} 12%, transparent))`;
    }
  }, [glowColor, motionAllowed]);

  return (
    <div className="mint-perspective" data-floating-mint-card>
      <div ref={cardRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={reset} onPointerCancel={reset} onPointerLeave={reset} className="mint-float-layer touch-pan-y" style={{ filter: `drop-shadow(0 15px 25px color-mix(in srgb, ${glowColor} 12%, transparent))` }}>
        {children}
      </div>
    </div>
  );
}
