import type { ReactNode } from "react";

import { MintLeafIcon } from "@/components/icons/MintLeafIcon";
import { BellIcon, SearchIcon } from "@/components/icons/CampusIcons";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { UniversityTheme } from "@/data/universities";
import type { CampusMintUser } from "@/types/profile";
import type { FloatingSurfaceOrigin } from "@/lib/motion/interaction";

type TopUtilityBarProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  developerControls?: ReactNode;
  developerControlsOpen?: boolean;
  onToggleDeveloperControls?: () => void;
  campusPreviewLabel?: string;
  onExitCampusPreview?: () => void;
  hidden?: boolean;
  compact?: boolean;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: (origin: FloatingSurfaceOrigin) => void;
  onOpenProfile: () => void;
  unreadNotificationCount?: number;
};

export function TopUtilityBar({
  viewer,
  theme,
  developerControls,
  developerControlsOpen = false,
  onToggleDeveloperControls,
  campusPreviewLabel,
  onExitCampusPreview,
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
        `sticky top-0 z-40 overflow-hidden backdrop-blur-xl ` +
        `transition-[max-height,transform,opacity,background-color] duration-[300ms] ease-[cubic-bezier(.16,1,.3,1)] ` +
        (
          hidden
            ? "pointer-events-none max-h-0 -translate-y-full opacity-0"
            : "max-h-96 translate-y-0 opacity-100"
        )
      }
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 86%, transparent) 0%, color-mix(in srgb, var(--app-surface) 68%, transparent) 72%, color-mix(in srgb, var(--app-background) 54%, transparent) 100%)",
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
            className="interactive-pop flex h-10 w-10 items-center justify-center border-0 bg-transparent p-0 text-[var(--app-accent)] shadow-none focus-visible:outline-2 focus-visible:outline-offset-2"
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
            onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              onOpenNotifications({
                x: bounds.left + bounds.width / 2,
                y: bounds.top + bounds.height / 2,
                bottom: bounds.bottom,
              });
            }}
            className="cm-icon-control interactive-pop relative flex items-center justify-center border-0 bg-transparent text-[var(--app-accent)] shadow-none focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: "var(--app-accent)" }}
          >
            <span className="h-[19px] w-[19px]" aria-hidden="true"><BellIcon /></span>
            {unreadNotificationCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--app-personal)] px-1 text-[8px] font-black leading-none text-[var(--app-personal-contrast)]" aria-label={`${unreadNotificationCount} unread notifications`}>
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </span>
            )}
          </button>
        </div>

        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center">
          <p
            className={`cm-eyebrow hidden overflow-hidden text-[var(--app-text-secondary)] transition-[max-height,opacity,transform] duration-200 min-[430px]:block ${
              compact
                ? "max-h-0 -translate-y-1 opacity-0"
                : "max-h-4 translate-y-0 opacity-100"
            }`}
          >
            The Campus Mint
          </p>

          <p
            className={`${developerControls ? "max-w-20" : "max-w-28"} truncate text-xs font-black min-[430px]:max-w-36 min-[430px]:text-sm`}
            style={{
              color: "var(--app-accent)",
            }}
          >
            {theme.shortName}
          </p>
        </div>

        <div className="flex items-center gap-1" data-header-group="profile-search">
          {developerControls && <button
            type="button"
            aria-label="Dev campus preview"
            aria-expanded={developerControlsOpen}
            aria-controls="campus-preview-controls"
            onClick={onToggleDeveloperControls}
            className="min-h-10 rounded-full px-2 text-xs font-bold text-[var(--app-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
          >Dev</button>}
          <button
            type="button"
            aria-label="Open Search"
            title="Search"
            onClick={onOpenSearch}
            className="cm-icon-control interactive-pop flex items-center justify-center border-0 bg-transparent text-[var(--app-accent)] shadow-none focus-visible:outline-2 focus-visible:outline-offset-2"
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
              outlineColor: "var(--app-accent)",
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

      {developerControls && developerControlsOpen && (
        <div id="campus-preview-controls" className="mx-auto max-w-5xl px-4 pb-3 sm:px-6">
          <div className="flex flex-wrap items-end justify-end gap-3 rounded-2xl bg-[var(--app-surface)] p-3">
            {developerControls}
          </div>

        </div>
      )}
      {campusPreviewLabel && <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pb-3 pt-1 text-xs sm:px-6" role="status">
        <span className="min-w-0 text-[var(--app-text-secondary)]"><strong className="text-[var(--app-accent)]">Testing {campusPreviewLabel}</strong> · Read only</span>
        <button type="button" onClick={onExitCampusPreview} className="shrink-0 rounded-full px-2 py-1 font-bold text-[var(--app-accent)] focus-visible:outline-2 focus-visible:outline-offset-2">Exit test</button>
      </div>}
    </header>
  );
}
