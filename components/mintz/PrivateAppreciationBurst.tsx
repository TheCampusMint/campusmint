"use client";

import { useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export type ScreenPoint = { clientX: number; clientY: number };

export function PrivateAppreciationBurst({
  point,
  sequence,
  reducedMotion,
  onComplete,
}: {
  point: ScreenPoint | null;
  sequence: number;
  reducedMotion: boolean;
  onComplete: () => void;
}) {
  useEffect(() => {
    if (!point) return;
    const timer = window.setTimeout(onComplete, reducedMotion ? 260 : 560);
    return () => window.clearTimeout(timer);
  }, [onComplete, point, reducedMotion, sequence]);

  if (!point || typeof document === "undefined") return null;

  return createPortal(
    <span
      key={sequence}
      aria-hidden="true"
      className={
        reducedMotion
          ? "cm-private-appreciation-confirm"
          : "cm-private-appreciation-burst"
      }
      style={
        {
          left: point.clientX,
          top: point.clientY,
        } as CSSProperties
      }
    >
      ♥
    </span>,
    document.body,
  );
}
