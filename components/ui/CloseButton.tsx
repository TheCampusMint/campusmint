"use client";

import type { ButtonHTMLAttributes } from "react";

export function CloseIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true" className={className}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

type CloseButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type"> & {
  label?: string;
  tone?: "surface" | "inverse" | "minimal";
};

export function CloseButton({ label = "Close", tone = "surface", className = "", ...props }: CloseButtonProps) {
  const toneClass = tone === "inverse"
    ? "text-white [filter:drop-shadow(0_1px_2px_rgb(0_0_0/.65))]"
    : tone === "minimal"
      ? "bg-transparent text-current"
      : "bg-transparent text-[var(--app-text-secondary,#64748b)]";
  return (
    <button {...props} type="button" aria-label={props["aria-label"] ?? label} title={props.title ?? label} className={`cm-icon-control interactive-pop inline-flex shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)] ${toneClass} ${className}`}>
      <CloseIcon />
    </button>
  );
}
