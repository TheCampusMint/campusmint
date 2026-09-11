import type { ReactNode } from "react";

import { MintLeafIcon } from "@/components/icons/MintLeafIcon";
import { BellIcon, SearchIcon } from "@/components/icons/CampusIcons";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { UniversityTheme } from "@/data/universities";
import type { CampusMintUser } from "@/types/profile";

type TopUtilityBarProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  developerControls?: ReactNode;
  hidden?: boolean;
  compact?: boolean;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  unreadNotificationCount?: number;
};

export function TopUtilityBar({
  viewer,
  theme,
  developerControls,
  hidden = false,
  compact = false,
  onOpenSettings,
  onOpenSearch,
  onOpenNotifications,
  onOpenProfile,
  unreadNotificationCount = 0,
}: TopUtilityBarProps) {
  return (
    <header
      aria-hidden={hidden}
      className={
        `sticky top-0 z-40 overflow-hidden border-b backdrop-blur-xl ` +
        `transition-[max-height,transform,opacity,border-color,background-color,box-shadow] duration-[300ms] ease-[cubic-bezier(.16,1,.3,1)] ` +
        (
          hidden
            ? "pointer-events-none max-h-0 -translate-y-full border-transparent opacity-0"
            : "max-h-96 translate-y-0 opacity-100"
        )
      }
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 86%, transparent) 0%, color-mix(in srgb, var(--app-surface) 68%, transparent) 72%, color-mix(in srgb, var(--app-background) 54%, transparent) 100%)",
        borderColor: hidden
          ? "transparent"
          : "color-mix(in srgb, var(--app-border) 48%, transparent)",
        boxShadow: hidden
          ? "none"
          : "0 12px 28px -28px color-mix(in srgb, var(--app-accent) 28%, transparent)",
        WebkitBackdropFilter: "blur(18px) saturate(1.22)",
      }}
    >
      <div
        className={`relative mx-auto flex max-w-5xl items-center justify-between px-4 transition-[min-height] duration-200 sm:px-6 ${
          compact ? "min-h-12" : "min-h-14"
        }`}
      >
        <div className="flex items-center gap-1" data-header-group="settings-notifications">
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            title="Settings"
            className="interactive-pop flex h-10 w-10 items-center justify-center border-0 bg-transparent p-0 text-slate-700 shadow-none focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              outlineColor: "var(--app-accent)",
              background: "transparent",
              perspective: "180px",
            }}
          >
            <span className="flex h-6 w-6 items-center justify-center [&>svg]:h-6 [&>svg]:w-6">
              <MintLeafIcon />
            </span>
          </button>

          <button
            type="button"
            aria-label="Open notifications"
            title="Notifications"
            onClick={onOpenNotifications}
            className="cm-icon-control interactive-pop relative flex items-center justify-center border border-slate-200 bg-white text-slate-700 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: "var(--app-accent)" }}
          >
            <span className="h-[19px] w-[19px]" aria-hidden="true"><BellIcon /></span>
            {unreadNotificationCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[8px] font-black leading-none text-white" aria-label={`${unreadNotificationCount} unread notifications`}>
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </span>
            )}
          </button>
        </div>

        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center">
          <p
            className={`cm-eyebrow hidden overflow-hidden text-slate-400 transition-[max-height,opacity,transform] duration-200 min-[430px]:block ${
              compact
                ? "max-h-0 -translate-y-1 opacity-0"
                : "max-h-4 translate-y-0 opacity-100"
            }`}
          >
            The Campus Mint
          </p>

          <p
            className="max-w-28 truncate text-xs font-black min-[430px]:max-w-36 min-[430px]:text-sm"
            style={{
              color: "var(--app-accent)",
            }}
          >
            {theme.shortName}
          </p>
        </div>

        <div className="flex items-center gap-1" data-header-group="profile-search">
          <button
            type="button"
            aria-label="Open Search"
            title="Search"
            onClick={onOpenSearch}
            className="cm-icon-control interactive-pop flex items-center justify-center border border-slate-200 bg-white text-slate-700 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              outlineColor: "var(--app-accent)",
            }}
          >
            <span className="h-[18px] w-[18px]" aria-hidden="true"><SearchIcon /></span>
          </button>

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
      </div>

      {developerControls && (
        <details className="group mx-auto max-w-5xl px-4 pb-2 sm:px-6">
          <summary className="cm-eyebrow ml-auto w-fit cursor-pointer list-none rounded-full bg-slate-950 px-3 py-1 text-white">
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
