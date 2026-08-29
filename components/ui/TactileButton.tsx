"use client";

import type { ButtonHTMLAttributes } from "react";

type TactileButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    reducedMotion?: boolean;
    selected?: boolean;
  };

export function TactileButton({
  reducedMotion = false,
  selected = false,
  className = "",
  style,
  children,
  ...props
}: TactileButtonProps) {
  return (
    <button
      {...props}
      data-tactile-button
      data-selected={selected ? "true" : "false"}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      className={`cm-pressable ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}
