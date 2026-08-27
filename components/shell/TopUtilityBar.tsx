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
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
};

export function TopUtilityBar({
  viewer,
  theme,
  developerControls,
  hidden = false,
  onOpenSettings,
  onOpenSearch,
  onOpenNotifications,
  onOpenProfile,
}: TopUtilityBarProps) {
  return (
    <header
      aria-hidden={hidden}
      className={
        `sticky top-0 z-40 overflow-hidden border-b backdrop-blur-xl ` +
        `transition-[max-height,transform,opacity,border-color,background-color,box-shadow] duration-[460ms] ease-[cubic-bezier(.22,1,.36,1)] ` +
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
      <div className="relative mx-auto flex min-h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
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

        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center">
          <p className="cm-eyebrow text-slate-400">
            The Campus Mint
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

        <div className="flex items-center gap-2">
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
            <svg
              viewBox="0 0 32 32"
              className="h-[18px] w-[18px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="14" cy="14" r="7.2" />
              <path d="m19.3 19.3 6.1 6.1" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Open notifications"
            title="Notifications"
            onClick={onOpenNotifications}
            className="cm-icon-control interactive-pop flex items-center justify-center border border-slate-200 bg-white text-slate-700 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              outlineColor: "var(--app-accent)",
            }}
          >
            <svg
              viewBox="0 0 32 32"
              className="h-[19px] w-[19px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 13.5c0-4.2 2.7-7 7-7s7 2.8 7 7v5.2l2.2 3.3H6.8L9 18.7v-5.2Z" />
              <path d="M13.2 25c.7 1.2 1.6 1.8 2.8 1.8s2.1-.6 2.8-1.8" />
            </svg>
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
