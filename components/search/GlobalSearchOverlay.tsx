"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { UniversityTheme } from "@/data/universities";
import { MintLeafBackButton } from "@/components/ui/MintLeafBackButton";
import { CloseButton } from "@/components/ui/CloseButton";
import { useModalLayer } from "@/hooks/useModalLayer";
import { motion } from "@/lib/motion/interaction";

type GlobalSearchOverlayProps = {
  theme: UniversityTheme;
  historyDepth: number;
  initialScrollY: number;
  onRequestBack: () => void;
  onRequestClose: () => void;
  onScrollYChange: (scrollY: number) => void;
  children: ReactNode;
};

export function GlobalSearchOverlay({
  theme,
  historyDepth,
  initialScrollY,
  onRequestBack,
  onRequestClose,
  onScrollYChange,
  children,
}: GlobalSearchOverlayProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    if (historyDepth > 0) {
      onRequestBack();
      return;
    }

    if (closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(
      onRequestClose,
      motion.duration.fast,
    );
  }, [closing, historyDepth, onRequestBack, onRequestClose]);

  useModalLayer(scrollContainerRef, requestClose);

  useLayoutEffect(() => {
    scrollContainerRef.current?.scrollTo({
      top: Math.max(0, initialScrollY),
      behavior: "auto",
    });
  }, [initialScrollY]);

  useLayoutEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      data-search-overlay
      data-search-scroll-container
      data-search-history-depth={historyDepth}
      role="dialog"
      aria-modal="true"
      aria-label="Campus Mint Search"
      tabIndex={-1}
      onScroll={(event) => onScrollYChange(event.currentTarget.scrollTop)}
      className={`cm-search-layer fixed inset-0 z-[80] overflow-y-auto bg-[var(--app-background)] ${
        closing ? "is-closing" : ""
      }`}
      style={{
        backgroundImage:
          "radial-gradient(circle at 82% 0%, color-mix(in srgb, var(--app-accent-soft) 70%, transparent), transparent 30%)",
      }}
    >
      <header className="sticky top-0 z-20 border-b border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div>

            <h1 className="text-lg font-black text-[var(--app-text-primary)]">
              Search
            </h1>
          </div>

          {historyDepth > 0 ? (
            <MintLeafBackButton
              onClick={requestClose}
              label="Back"
              aria-label="Back one Search layer"
              style={{ outlineColor: theme.primary }}
            />
          ) : (
            <CloseButton
              onClick={requestClose}
              label="Close Search"
              className="shadow-sm"
              style={{ outlineColor: theme.primary }}
            />
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6 sm:pt-7">
        {children}
      </div>
    </div>
  );
}
