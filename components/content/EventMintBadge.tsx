import { getEventTimingStatus } from "@/lib/content/eventTiming";

type EventMintBadgeProps = {
  eventStartAt: string | null;
  eventEndAt?: string | null;
  currentTime: number;
  timeZone?: string | null;
  contextLabel?: string;
};

/** Event identity and urgency are separate so EVENT always keeps its semantic green treatment. */
export function EventMintBadge({ eventStartAt, eventEndAt, currentTime, timeZone, contextLabel = "Event" }: EventMintBadgeProps) {
  const timing = getEventTimingStatus(eventStartAt, eventEndAt, currentTime, timeZone);
  const showTimingLabel = timing.label !== "EVENT";
  const timingClasses = timing.isUrgent
    ? "border-rose-500 bg-rose-500 text-white shadow-[0_7px_20px_rgba(244,63,94,0.25)]"
    : timing.status === "ended"
      ? "border-slate-300 bg-slate-100 text-slate-600"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div className="inline-flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em]" data-event-status={timing.status} aria-label={`${contextLabel} ${showTimingLabel ? timing.label : ""}`.trim()} title={timing.secondaryLabel ?? undefined}>
      <span className="rounded-full border border-emerald-500 bg-emerald-500 px-3 py-1.5 text-white shadow-[0_7px_20px_rgba(16,185,129,0.22)]">{contextLabel}</span>
      {showTimingLabel && <span className={`rounded-full border px-3 py-1.5 ${timingClasses}`}>{timing.label}</span>}
    </div>
  );
}
