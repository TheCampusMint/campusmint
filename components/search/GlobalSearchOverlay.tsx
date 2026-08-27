"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

import type { UniversityTheme } from "@/data/universities";
import { MintLeafBackButton } from "@/components/ui/MintLeafBackButton";

type GlobalSearchOverlayProps = {
  theme: UniversityTheme;
  historyDepth: number;
  initialScrollY: number;
  onRequestClose: () => void;
  onScrollYChange: (scrollY: number) => void;
  children: ReactNode;
};

export function GlobalSearchOverlay({
  theme,
  historyDepth,
  initialScrollY,
  onRequestClose,
  onScrollYChange,
  children,
}: GlobalSearchOverlayProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    scrollContainerRef.current?.scrollTo({
      top: Math.max(0, initialScrollY),
      behavior: "auto",
    });
  }, [initialScrollY]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onRequestClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onRequestClose]);

  return (
    <div
      ref={scrollContainerRef}
      data-search-overlay
      data-search-scroll-container
      role="dialog"
      aria-modal="true"
      aria-label="Campus Mint Search"
      onScroll={(event) => onScrollYChange(event.currentTarget.scrollTop)}
      className="fixed inset-0 z-[80] overflow-y-auto bg-[var(--app-background)]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 82% 0%, color-mix(in srgb, var(--app-accent-soft) 70%, transparent), transparent 30%)",
      }}
    >
      <header className="sticky top-0 z-20 border-b border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div>
            <p
              className="text-[9px] font-black uppercase tracking-[0.2em]"
              style={{ color: theme.primary }}
            >
              The Campus Mint
            </p>
            <h1 className="text-lg font-black text-[var(--app-text-primary)]">
              Search
            </h1>
          </div>

          {historyDepth > 0 ? (
            <MintLeafBackButton
              onClick={onRequestClose}
              label="Back"
              aria-label="Back one Search layer"
              style={{ outlineColor: theme.primary }}
            />
          ) : (
            <button
              type="button"
              onClick={onRequestClose}
              aria-label="Close Search"
              title="Close"
              className="cm-icon-control interactive-pop flex items-center justify-center border border-[var(--app-border)] bg-[var(--app-surface-elevated)] text-xl text-[var(--app-text-primary)] shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ outlineColor: theme.primary }}
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6 sm:pt-7">
        {children}
      </div>
    </div>
  );
}
