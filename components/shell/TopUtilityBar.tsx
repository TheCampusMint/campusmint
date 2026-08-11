import type { ReactNode } from "react";

import { MintLeafIcon } from "@/components/icons/MintLeafIcon";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { UniversityTheme } from "@/data/universities";
import type { CampusMintUser } from "@/types/profile";

type TopUtilityBarProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  developerControls?: ReactNode;
  hidden?: boolean;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
};

export function TopUtilityBar({
  viewer,
  theme,
  developerControls,
  hidden = false,
  onOpenSettings,
  onOpenProfile,
}: TopUtilityBarProps) {
  return (
    <header
      aria-hidden={hidden}
      className={
        `sticky top-0 z-40 overflow-hidden border-b bg-white/78 backdrop-blur-xl ` +
        `transition-[max-height,transform,opacity,border-color] duration-[460ms] ease-[cubic-bezier(.22,1,.36,1)] ` +
        (
          hidden
            ? "pointer-events-none max-h-0 -translate-y-full border-transparent opacity-0"
            : "max-h-96 translate-y-0 border-slate-200 opacity-100"
        )
      }
    >
      <div className="relative mx-auto flex min-h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Settings"
          className="relative flex h-11 w-11 items-center justify-center overflow-visible rounded-full p-0 text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            outlineColor: "var(--app-accent)",
            background: "transparent",
            perspective: "180px",
          }}
        >
          <span className="flex h-7 w-7 items-center justify-center [&>svg]:h-7 [&>svg]:w-7">
            <MintLeafIcon />
          </span>
        </button>

        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            Campus Mint
          </p>

          <p
            className="max-w-36 truncate text-sm font-black"
            style={{
              color: "var(--app-accent)",
            }}
          >
            {theme.shortName}
          </p>
        </div>

        <button
          type="button"
          aria-label="Open my profile"
          onClick={onOpenProfile}
          className="relative overflow-visible rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            outlineColor: theme.primary,
          }}
        >
          <ProfileAvatar
            user={viewer}
            size="sm"
            primaryColor={theme.primary}
            accentColor={theme.accent}
          />
        </button>
      </div>

      {developerControls && (
        <details className="group mx-auto max-w-5xl px-4 pb-2 sm:px-6">
          <summary className="ml-auto w-fit cursor-pointer list-none rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
            Dev controls
          </summary>

          <div
            className="mt-2 flex flex-wrap justify-end gap-2 rounded-2xl border border-white/20 p-3 shadow-sm"
            style={{
              backgroundColor:
                theme.primary,
            }}
          >
            {developerControls}
          </div>
        </details>
      )}
    </header>
  );
}
