"use client";

import type { ReactNode } from "react";

type FloatingMintCardProps = {
  children: ReactNode;
  glowColor: string;
  reducedMotion?: boolean;
};

/**
 * Mint cards keep their normal card shadow,
 * but no colored backing, gyro tilt, or pointer-follow movement.
 */
export function FloatingMintCard({
  children,
}: FloatingMintCardProps) {
  return (
    <div className="mint-float-layer">
      {children}
    </div>
  );
}
