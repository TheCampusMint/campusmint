"use client";

import Image from "next/image";
import { useState } from "react";

import type { UniversityTheme } from "@/data/universities";
import type { SportsTeamIdentity } from "@/data/sports";

export function TeamMark({ team, theme, size = "md" }: { team: SportsTeamIdentity; theme: UniversityTheme; size?: "sm" | "md" | "lg" }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const logoAvailable = Boolean(team.logoUrl && failedUrl !== team.logoUrl);
  const dimensions = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const colors = team.colors ?? { primary: theme.primary, secondary: theme.secondary };

  return (
    <span
      className={`relative flex ${dimensions} shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 text-[10px] font-black shadow-inner`}
      style={{ backgroundColor: logoAvailable ? "rgba(255,255,255,.96)" : colors.primary, color: colors.secondary }}
      data-team-mark={logoAvailable ? "logo" : "abbreviation"}
      aria-hidden="true"
    >
      {logoAvailable && team.logoUrl ? (
        <Image src={team.logoUrl} alt="" fill sizes={size === "lg" ? "64px" : size === "sm" ? "36px" : "44px"} className="object-contain p-1.5" onError={() => setFailedUrl(team.logoUrl ?? null)} />
      ) : team.abbreviation}
    </span>
  );
}
