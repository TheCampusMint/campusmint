"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import {
  motion,
  resolveDirectManipulationRelease,
  resolveGestureAxis,
  type DirectManipulationDirection,
  type GestureAxis,
} from "@/lib/motion/interaction";

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  velocityX: number;
  velocityY: number;
  axis: GestureAxis;
  startedOnHandle: boolean;
};

type DirectManipulationOptions = {
  allowedDirections: readonly DirectManipulationDirection[];
  onDismiss: (direction: DirectManipulationDirection) => void;
  reducedMotion?: boolean;
  scrollRef?: RefObject<HTMLElement | null>;
  dismissScale?: number;
  dismissToOrigin?: boolean;
};

function exitOffset(direction: DirectManipulationDirection, width: number, height: number) {
  const horizontal = Math.max(width * 1.12, window.innerWidth * 1.04);
  const vertical = Math.max(height * 1.12, window.innerHeight * 1.04);
  if (direction === "left") return { x: -horizontal, y: 0 };
  if (direction === "right") return { x: horizontal, y: 0 };
  if (direction === "up") return { x: 0, y: -vertical };
  return { x: 0, y: vertical };
}

/** Pointer-driven movement for floating surfaces. Vertical dismissal from a
 * scrollable body is accepted only at its matching scroll boundary; surface
 * chrome marked `data-direct-drag-handle` may always drive either axis. */
export function useDirectManipulation({
  allowedDirections,
  onDismiss,
  reducedMotion = false,
  scrollRef,
  dismissScale = 1,
  dismissToOrigin = false,
}: DirectManipulationOptions) {
  const surfaceRef = useRef<HTMLElement>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const dismissTimerRef = useRef<number | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [settling, setSettling] = useState(false);
  const [targetScale, setTargetScale] = useState(1);

  const reset = useCallback(() => {
    sessionRef.current = null;
    setDragging(false);
    setSettling(true);
    setTargetScale(1);
    setOffset({ x: 0, y: 0 });
    window.setTimeout(() => setSettling(false), reducedMotion ? 0 : motion.duration.standard);
  }, [reducedMotion]);

  useEffect(() => () => {
    if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
  }, []);

  function begin(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest("button,input,textarea,select,a,[data-direct-drag-ignore]")) return;
    sessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocityX: 0,
      velocityY: 0,
      axis: "pending",
      startedOnHandle: Boolean(target?.closest("[data-direct-drag-handle]")),
    };
  }

  function verticalDirectionAllowed(deltaY: number, startedOnHandle: boolean) {
    if (startedOnHandle) return true;
    const scroll = scrollRef?.current;
    if (!scroll) return false;
    if (deltaY > 0) return scroll.scrollTop <= 1;
    return scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 1;
  }

  function move(event: ReactPointerEvent<HTMLElement>) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - session.startX;
    const deltaY = event.clientY - session.startY;
    if (session.axis === "pending") {
      const axis = resolveGestureAxis(deltaX, deltaY, { threshold: 8, dominance: 1.18 });
      if (axis === "pending") return;
      const direction = axis === "horizontal"
        ? deltaX < 0 ? "left" : "right"
        : deltaY < 0 ? "up" : "down";
      if (!allowedDirections.includes(direction)) {
        sessionRef.current = null;
        return;
      }
      if (axis === "vertical" && !verticalDirectionAllowed(deltaY, session.startedOnHandle)) {
        sessionRef.current = null;
        return;
      }
      session.axis = axis;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const elapsed = Math.max(1, event.timeStamp - session.lastTime);
    session.velocityX = (event.clientX - session.lastX) / elapsed;
    session.velocityY = (event.clientY - session.lastY) / elapsed;
    session.lastX = event.clientX;
    session.lastY = event.clientY;
    session.lastTime = event.timeStamp;
    event.preventDefault();
    setOffset(session.axis === "horizontal" ? { x: deltaX, y: 0 } : { x: 0, y: deltaY });
  }

  function finish(event: ReactPointerEvent<HTMLElement>) {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session || session.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const bounds = surfaceRef.current?.getBoundingClientRect();
    const release = resolveDirectManipulationRelease({
      deltaX: event.clientX - session.startX,
      deltaY: event.clientY - session.startY,
      velocityX: session.velocityX,
      velocityY: session.velocityY,
      width: bounds?.width ?? window.innerWidth,
      height: bounds?.height ?? window.innerHeight,
      allowedDirections,
    });
    if (!release.committed || !release.direction) {
      reset();
      return;
    }
    setDragging(false);
    setSettling(true);
    setTargetScale(dismissScale);
    setOffset(dismissToOrigin
      ? { x: 0, y: 0 }
      : exitOffset(release.direction, bounds?.width ?? 0, bounds?.height ?? 0));
    dismissTimerRef.current = window.setTimeout(
      () => onDismiss(release.direction!),
      reducedMotion ? 0 : motion.duration.fast,
    );
  }

  function cancel(event: ReactPointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    reset();
  }

  const distance = Math.hypot(offset.x, offset.y);
  const scale = targetScale < 1 ? targetScale : Math.max(0.96, 1 - distance / 5000);
  const style: CSSProperties = {
    transform: `translate3d(${offset.x}px,${offset.y}px,0) scale(${scale})`,
    opacity: targetScale < 1 ? 0 : Math.max(0.72, 1 - distance / 900),
    transition: dragging || reducedMotion
      ? "none"
      : `transform ${settling ? motion.duration.standard : motion.duration.fast}ms ${motion.easing.settle}, opacity ${motion.duration.fast}ms ease`,
    willChange: dragging || settling ? "transform, opacity" : "auto",
  };

  return {
    surfaceRef,
    surfaceProps: {
      onPointerDown: begin,
      onPointerMove: move,
      onPointerUp: finish,
      onPointerCancel: cancel,
    },
    style,
    progress: Math.min(1, distance / 220),
    dragging,
  };
}
