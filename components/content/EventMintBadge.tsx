import { getEventTimingStatus } from "@/lib/content/eventTiming";

type EventMintBadgeProps = {
  eventStartAt: string | null;
  eventEndAt?: string | null;
  currentTime: number;
  timeZone?: string | null;
  contextLabel?: string;
};

/** Event styling is intentionally isolated so the redesign can replace it in one place. */
export function EventMintBadge({ eventStartAt, eventEndAt, currentTime, timeZone, contextLabel = "Event" }: EventMintBadgeProps) {
  const timing = getEventTimingStatus(eventStartAt, eventEndAt, currentTime, timeZone);
  const stateClasses = timing.isUrgent
    ? "bg-emerald-600 text-white"
    : timing.status === "ended"
      ? "border border-slate-300 bg-slate-100 text-slate-600"
      : "border border-slate-300 bg-white text-slate-700";
  const showTimingLabel = timing.label !== "EVENT";

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wide ${stateClasses}`} data-event-status={timing.status} aria-label={`${contextLabel} ${showTimingLabel ? timing.label : ""}`.trim()} title={timing.secondaryLabel ?? undefined}>
      <span>{contextLabel}</span>{showTimingLabel && <><span aria-hidden="true">•</span><span>{timing.label}</span></>}
    </div>
  );
}
