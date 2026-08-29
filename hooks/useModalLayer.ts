"use client";

import { useEffect, useRef, type RefObject } from "react";

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const layerStack: symbol[] = [];
let bodyOverflowBeforeLayers = "";

/** Shared keyboard, focus, and scroll behavior for modal interface layers. */
export function useModalLayer(
  containerRef: RefObject<HTMLElement | null>,
  onRequestClose: () => void,
) {
  const onRequestCloseRef = useRef(onRequestClose);

  useEffect(() => {
    onRequestCloseRef.current = onRequestClose;
  }, [onRequestClose]);

  useEffect(() => {
    const layer = Symbol("campus-mint-layer");
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (layerStack.length === 0) {
      bodyOverflowBeforeLayers = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    layerStack.push(layer);

    const focusFrame = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      const preferred = container?.querySelector<HTMLElement>(
        "[data-initial-focus]",
      );
      const first = container?.querySelector<HTMLElement>(focusableSelector);
      (preferred ?? first ?? container)?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (layerStack.at(-1) !== layer) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onRequestCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;
      const controls = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((control) => !control.hasAttribute("hidden"));

      if (controls.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = controls[0];
      const last = controls[controls.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);

      const index = layerStack.lastIndexOf(layer);
      if (index >= 0) layerStack.splice(index, 1);

      if (layerStack.length === 0) {
        document.body.style.overflow = bodyOverflowBeforeLayers;
      }

      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [containerRef]);
}
