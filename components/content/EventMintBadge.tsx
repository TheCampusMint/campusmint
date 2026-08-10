import { getEventTimingStatus } from "@/lib/content/eventTiming";

type EventMintBadgeProps = {
  eventStartAt: string | null;
  eventEndAt?: string | null;
  currentTime: number;
  timeZone?: string | null;
  contextLabel?: string;
};

const eventBadgeStyles = {
  backgroundColor: "#ecfdf5",
  borderColor: "#10b981",
  color: "#047857",
  boxShadow: "0 7px 20px rgba(16, 185, 129, 0.16)",
};

const eventTimeBadgeStyles = {
  backgroundColor: "#fff1f2",
  borderColor: "#f43f5e",
  color: "#be123c",
  boxShadow: "0 7px 20px rgba(244, 63, 94, 0.14)",
};

/** Event identity and urgency are separate so EVENT always keeps its semantic green treatment. */
export function EventMintBadge({ eventStartAt, eventEndAt, currentTime, timeZone, contextLabel = "Event" }: EventMintBadgeProps) {
  const timing = getEventTimingStatus(eventStartAt, eventEndAt, currentTime, timeZone);
  const showTimingLabel = timing.label !== "EVENT";
  const badgeClassName = "inline-flex rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em]";

  return (
    <div className="inline-flex items-center gap-2" data-event-status={timing.status} aria-label={`${contextLabel} ${showTimingLabel ? timing.label : ""}`.trim()} title={timing.secondaryLabel ?? undefined}>
      <span className={badgeClassName} style={eventBadgeStyles}>{contextLabel}</span>
      {showTimingLabel && <span className={badgeClassName} style={eventTimeBadgeStyles}>{timing.label}</span>}
    </div>
  );
}
