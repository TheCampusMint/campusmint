import type { ReactNode } from "react";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { UniversityTheme } from "@/data/universities";
import type { CampusMintUser } from "@/types/profile";

type TopUtilityBarProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  developerControls?: ReactNode;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
};

export function TopUtilityBar({ viewer, theme, developerControls, onOpenSettings, onOpenProfile }: TopUtilityBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/50 bg-white/78 backdrop-blur-xl">
      <div className="relative mx-auto flex min-h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <button type="button" onClick={onOpenSettings} className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: theme.primary }}>
          <span aria-hidden="true" className="text-lg">⚙</span><span className="hidden sm:inline">Settings</span>
        </button>

        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Campus Mint</p>
          <p className="max-w-36 truncate text-sm font-black" style={{ color: theme.primary }}>{theme.shortName}</p>
        </div>

        <button type="button" aria-label="Open my profile" onClick={onOpenProfile} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: theme.primary }}>
          <ProfileAvatar user={viewer} size="sm" primaryColor={theme.primary} accentColor={theme.accent} />
        </button>
      </div>
      {developerControls && (
        <details className="group mx-auto max-w-5xl px-4 pb-2 sm:px-6">
          <summary className="ml-auto w-fit cursor-pointer list-none rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">Dev controls</summary>
          <div className="mt-2 flex flex-wrap justify-end gap-2 rounded-2xl border border-white/20 p-3 shadow-sm" style={{ backgroundColor: theme.primary }}>{developerControls}</div>
        </details>
      )}
    </header>
  );
}
