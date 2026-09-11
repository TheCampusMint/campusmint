"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { UniversityTheme } from "@/data/universities";
import type { CampusNotificationsState } from "@/hooks/useCampusNotifications";
import { useModalLayer } from "@/hooks/useModalLayer";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { CampusNotification } from "@/types/notification";
import type { CampusMintUser } from "@/types/profile";

export function NotificationsPanel({
  notifications,
  users,
  theme,
  onOpen,
  onClose,
}: {
  notifications: CampusNotificationsState;
  users: readonly CampusMintUser[];
  theme: UniversityTheme;
  onOpen: (notification: CampusNotification) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const [renderTime] = useState(() => Date.now());
  useModalLayer(panelRef, onClose);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="cm-overlay-backdrop fixed inset-0 z-[125] flex items-end justify-center bg-slate-950/25 sm:items-start sm:justify-end sm:p-3 sm:pt-[4.35rem]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="notifications-heading" className="cm-panel-sheet flex max-h-[82dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-slate-200 bg-white shadow-2xl sm:max-h-[min(42rem,calc(100dvh-5rem))] sm:w-[24rem] sm:rounded-[2rem]">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <header className="grid shrink-0 grid-cols-[4.5rem_1fr_4.5rem] items-center border-b border-slate-100 px-3 py-3">
          <button type="button" onClick={notifications.markAllRead} disabled={notifications.unreadCount === 0} className="text-left text-[10px] font-black text-[var(--app-accent)] disabled:opacity-35">Read all</button>
          <h2 id="notifications-heading" className="text-center text-base font-black text-slate-950">Notifications</h2>
          <button type="button" onClick={onClose} data-initial-focus aria-label="Close notifications" className="ml-auto grid h-9 w-9 place-items-center rounded-full text-lg text-slate-500 hover:bg-slate-100">×</button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {notifications.notifications.length === 0 ? (
            <p className="grid min-h-40 place-items-center text-sm text-slate-400">No notifications</p>
          ) : notifications.notifications.map((notification) => {
            const actorUser = notification.actor.userId
              ? users.find((user) => user.account.id === notification.actor.userId)
              : null;
            return (
              <button key={notification.id} type="button" onClick={() => onOpen(notification)} className={`interactive-pop flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--app-accent)] ${notification.readAt ? "bg-white" : "bg-[var(--app-accent-soft)]"}`}>
                {actorUser ? (
                  <ProfileAvatar user={actorUser} size="sm" primaryColor={theme.primary} accentColor={theme.accent} />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-black" style={{ backgroundColor: theme.accent, color: theme.primary }} aria-hidden="true">
                    {notification.actor.kind === "team" ? "S" : notification.actor.kind === "organization" ? "C" : "M"}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black leading-5 text-slate-900">{notification.body}</span>
                  {notification.preview && <span className="mt-0.5 block truncate text-xs text-slate-500">{notification.preview}</span>}
                  <time dateTime={notification.createdAt} className="mt-1 block text-[10px] font-semibold text-slate-400">{formatRelativeTime(notification.createdAt, renderTime)}</time>
                </span>
                {!notification.readAt && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--app-accent)]" aria-label="Unread" />}
              </button>
            );
          })}
        </div>

        <p className="shrink-0 border-t border-slate-100 px-4 py-2 text-center text-[9px] font-semibold uppercase tracking-[.12em] text-slate-400">Development notifications · stored on this device</p>
      </section>
    </div>,
    document.body,
  );
}
