"use client";

import type { ReactNode } from "react";

type FloatingMintCardProps = {
  children: ReactNode;
  glowColor: string;
  reducedMotion?: boolean;
};

/** Maintains the feed's motion wrapper without ornamental card depth. */
export function FloatingMintCard({
  children,
}: FloatingMintCardProps) {
  return (
    <div className="mint-float-layer">
      {children}
    </div>
  );
}
