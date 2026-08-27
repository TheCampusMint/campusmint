"use client";

import type { ButtonHTMLAttributes } from "react";

type MintBackLeafIconProps = {
  className?: string;
};

export function MintBackLeafIcon({
  className = "h-6 w-6",
}: MintBackLeafIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={`${className} overflow-visible`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transform: "rotate(-135deg)",
        transformOrigin: "center",
      }}
    >
      <path
        d="M25.8 5.5C17 5.8 8.6 9.9 7 18.1c-.8 4.3 2.6 7.7 6.8 6.4 7.8-2.4 10.7-10.6 12-19Z"
        strokeWidth="2.4"
      />
      <path
        d="M8.6 24.8c2.8-6.2 7.2-10.1 13.8-13.2"
        strokeWidth="2"
      />
      <path
        d="M13.4 18.7c1.9.1 3.7.5 5.2 1.2M16.7 14.5c.1-1.5-.1-2.8-.5-4"
        strokeWidth="1.45"
        opacity=".82"
      />
    </svg>
  );
}

type MintLeafBackButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "type"
> & {
  label?: string;
  showLabel?: boolean;
  tone?: "surface" | "inverse" | "minimal";
};

export function MintLeafBackButton({
  label = "Back",
  showLabel = false,
  tone = "surface",
  className = "",
  ...props
}: MintLeafBackButtonProps) {
  const toneClass =
    tone === "inverse"
      ? "border-white/25 bg-slate-950/65 text-white shadow-lg backdrop-blur-xl"
      : tone === "minimal"
        ? "border-transparent bg-transparent text-current"
        : "border-slate-200 bg-white text-slate-800 shadow-sm";

  return (
    <button
      {...props}
      type="button"
      aria-label={props["aria-label"] ?? label}
      title={props.title ?? label}
      className={`interactive-pop inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border font-black focus-visible:outline-2 focus-visible:outline-offset-2 ${
        showLabel ? "px-3.5 text-xs" : "w-10 p-0"
      } ${toneClass} ${className}`}
    >
      <MintBackLeafIcon />
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
}
