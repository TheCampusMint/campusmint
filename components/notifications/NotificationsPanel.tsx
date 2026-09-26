"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { CloseButton } from "@/components/ui/CloseButton";
import type { UniversityTheme } from "@/data/universities";
import type { CampusNotificationsState } from "@/hooks/useCampusNotifications";
import { useDirectManipulation } from "@/hooks/useDirectManipulation";
import { useModalLayer } from "@/hooks/useModalLayer";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { motion, type FloatingSurfaceOrigin } from "@/lib/motion/interaction";
import type { CampusNotification } from "@/types/notification";
import type { CampusMintUser } from "@/types/profile";

export function NotificationsPanel({
  notifications,
  users,
  theme,
  origin,
  reducedMotion,
  onOpen,
  onClose,
}: {
  notifications: CampusNotificationsState;
  users: readonly CampusMintUser[];
  theme: UniversityTheme;
  origin: FloatingSurfaceOrigin | null;
  reducedMotion: boolean;
  onOpen: (notification: CampusNotification) => void;
  onClose: () => void;
}) {
  const [renderTime] = useState(() => Date.now());
  const [returning, setReturning] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestClose = useCallback(() => {
    if (returning) return;
    setReturning(true);
    closeTimerRef.current = window.setTimeout(onClose, reducedMotion ? 0 : motion.duration.fast);
  }, [onClose, reducedMotion, returning]);
  const {
    surfaceRef,
    surfaceProps,
    style: directManipulationStyle,
    progress: directManipulationProgress,
  } = useDirectManipulation({
    allowedDirections: ["left", "right", "up", "down"],
    onDismiss: onClose,
    reducedMotion,
    scrollRef,
    dismissScale: 0.08,
    dismissToOrigin: true,
  });
  useModalLayer(surfaceRef, requestClose);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  const placement = useMemo(() => {
    if (typeof window === "undefined") return { left: 12, top: 64, width: 384 };
    const width = Math.min(384, window.innerWidth - 24);
    const preferredLeft = (origin?.x ?? 36) - 32;
    return {
      width,
      left: Math.max(12, Math.min(window.innerWidth - width - 12, preferredLeft)),
      top: Math.max(56, (origin?.bottom ?? 52) + 6),
    };
  }, [origin]);
  const originX = Math.max(0, Math.min(placement.width, (origin?.x ?? placement.left) - placement.left));

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[125] bg-slate-950/[.08]"
      role="presentation"
      style={{ opacity: Math.max(0, 1 - directManipulationProgress * 0.72) }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section
        ref={surfaceRef}
        {...surfaceProps}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-heading"
        data-notification-surface
        data-reduced-motion={reducedMotion ? "true" : "false"}
        className={`cm-notification-surface fixed flex max-h-[calc(100dvh-4.75rem)] flex-col overflow-hidden rounded-[1.7rem] bg-[var(--app-surface)] ${returning ? "is-returning" : ""}`}
        style={{
          ...directManipulationStyle,
          left: placement.left,
          top: placement.top,
          width: placement.width,
          color: "var(--app-text-primary)",
          backgroundColor: "var(--app-surface)",
          transformOrigin: `${originX}px 0px`,
          "--notification-origin-x": `${originX}px`,
        } as CSSProperties}
      >
        <header data-direct-drag-handle className="flex shrink-0 touch-none items-center justify-between px-4 pb-2 pt-4">
          <div>
            <p className="cm-eyebrow text-[var(--app-accent)]">Campus activity</p>
            <h2 id="notifications-heading" className="mt-0.5 text-lg font-black text-[var(--app-text-primary)]">Notifications</h2>
          </div>
          <CloseButton onClick={requestClose} data-initial-focus label="Close notifications" tone="minimal" />
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {notifications.notifications.length === 0 ? (
            <p className="grid min-h-40 place-items-center text-sm text-[var(--app-text-secondary)]">No notifications</p>
          ) : notifications.notifications.map((notification) => {
            const actorUser = notification.actor.userId
              ? users.find((user) => user.account.id === notification.actor.userId)
              : null;
            return (
              <button key={notification.id} type="button" onClick={() => onOpen(notification)} className={`interactive-pop flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--app-accent)] ${notification.readAt ? "bg-transparent" : "bg-[var(--app-accent-soft)]"}`}>
                {actorUser ? (
                  <ProfileAvatar user={actorUser} size="sm" primaryColor={theme.primary} accentColor={theme.accent} />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-black" style={{ backgroundColor: theme.accent, color: theme.primary }} aria-hidden="true">
                    {notification.actor.kind === "team" ? "S" : notification.actor.kind === "organization" ? "C" : "M"}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black leading-5 text-[var(--app-text-primary)]">{notification.body}</span>
                  {notification.preview && <span className="mt-0.5 block truncate text-xs text-[var(--app-text-secondary)]">{notification.preview}</span>}
                  <time dateTime={notification.createdAt} className="mt-1 block text-[10px] font-semibold text-[var(--app-text-secondary)]">{formatRelativeTime(notification.createdAt, renderTime)}</time>
                </span>
                {!notification.readAt && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--app-accent)]" aria-label="Unread" />}
              </button>
            );
          })}
        </div>

        <p className="shrink-0 px-4 py-2 text-center text-[9px] font-semibold uppercase tracking-[.12em] text-[var(--app-text-secondary)]">Stored on this device</p>
      </section>
    </div>,
    document.body,
  );
}
