"use client";

import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type PointerEvent,
} from "react";

type TactileButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    reducedMotion?: boolean;
    selected?: boolean;
  };

export function TactileButton({
  reducedMotion = false,
  selected = false,
  className = "",
  children,
  onPointerMove,
  onPointerEnter,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  ...props
}: TactileButtonProps) {
  const buttonRef =
    useRef<HTMLButtonElement>(null);

  const animationFrameRef =
    useRef<number | null>(null);

  const stableBoundsRef =
    useRef<DOMRect | null>(null);

  function restingTransform() {
    return `translate3d(0, ${
      selected ? -2.5 : 0
    }px, 10px) rotateX(0deg) rotateY(0deg) scale(${
      selected ? 1.025 : 1
    })`;
  }

  function moveButton(
    transform: string,
    settling = false,
  ) {
    if (!buttonRef.current) return;

    if (animationFrameRef.current) {
      window.cancelAnimationFrame(
        animationFrameRef.current,
      );
    }

    animationFrameRef.current =
      window.requestAnimationFrame(() => {
        animationFrameRef.current = null;

        if (!buttonRef.current) return;

        buttonRef.current.style.transition =
          reducedMotion
            ? "none"
            : settling
              ? "transform 460ms cubic-bezier(.2,1.5,.3,1), filter 300ms ease"
              : "transform 80ms linear, filter 120ms ease";

        buttonRef.current.style.transform =
          reducedMotion
            ? restingTransform()
            : transform;
      });
  }

  function handlePointerMove(
    event: PointerEvent<HTMLButtonElement>,
  ) {
    onPointerMove?.(event);

    if (
      reducedMotion ||
      event.currentTarget.disabled
    ) {
      return;
    }

    const bounds =
      stableBoundsRef.current ??
      event.currentTarget.getBoundingClientRect();

    const nx =
      (event.clientX - bounds.left) /
        bounds.width -
      0.5;

    const ny =
      (event.clientY - bounds.top) /
        bounds.height -
      0.5;

    const x = nx * 6.5;
    const y =
      ny * 5 + (selected ? -3 : 0);

    const rotateX = ny * -24;
    const rotateY = nx * 26;

    moveButton(
      `translate3d(${x}px, ${y}px, 16px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${
        selected ? 1.045 : 1.025
      })`,
    );
  }

  function reset() {
    moveButton(
      restingTransform(),
      true,
    );
  }

  useEffect(() => {
    const frame =
      window.requestAnimationFrame(() => {
        if (!buttonRef.current) return;

        buttonRef.current.style.transform =
          restingTransform();
      });

    return () => {
      window.cancelAnimationFrame(frame);

      if (animationFrameRef.current) {
        window.cancelAnimationFrame(
          animationFrameRef.current,
        );
      }
    };
  }, [selected, reducedMotion]);

  return (
    <button
      ref={buttonRef}
      {...props}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);

        stableBoundsRef.current =
          event.currentTarget.getBoundingClientRect();
      }}
      onPointerMove={handlePointerMove}
      onPointerDown={(event) => {
        onPointerDown?.(event);

        stableBoundsRef.current =
          event.currentTarget.getBoundingClientRect();

        if (
          !reducedMotion &&
          !event.currentTarget.disabled
        ) {
          if (event.pointerType !== "mouse") {
            try {
              event.currentTarget.setPointerCapture(
                event.pointerId,
              );
            } catch {}
          }

          moveButton(
            "translate3d(0, 1px, 5px) rotateX(8deg) scale(.965)",
          );
        }
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);

        try {
          if (
            event.currentTarget.hasPointerCapture(
              event.pointerId,
            )
          ) {
            event.currentTarget.releasePointerCapture(
              event.pointerId,
            );
          }
        } catch {}

        reset();
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        reset();
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        stableBoundsRef.current = null;
        reset();
      }}
      className={`transform-gpu will-change-transform ${className}`}
      style={{
        ...props.style,
        perspective: "180px",
        transformStyle: "preserve-3d",
        touchAction: "pan-y",
      }}
    >
      {children}
    </button>
  );
}
