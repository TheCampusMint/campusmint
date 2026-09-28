"use client";

import { useCampusPreview } from "@/components/developer/CampusPreviewContext";
import type { UniversityTheme } from "@/data/universities";
import { CalendarIcon, ClockIcon, LocationIcon } from "@/components/icons/CampusIcons";
import type { Event } from "@/types/event";

type EventCardProps = {
  event: Event;
  campusName: string;
  isGoing: boolean;
  theme: UniversityTheme;
  onToggleRsvp: (eventId: Event["id"]) => void;
  onOpenDetails?: () => void;
  currentTime?: number;
};

export function EventCard({
  event,
  campusName,
  isGoing,
  theme,
  onToggleRsvp,
  onOpenDetails,
  currentTime,
}: EventCardProps) {
  const readOnly = useCampusPreview();
  const displayedRsvpCount = event.rsvpCount + (isGoing ? 1 : 0);
  const ended = (typeof currentTime === "number" && new Date(event.eventEndAt ?? event.eventStartAt).getTime() <= currentTime) || event.status === "cancelled";
  const happeningNow = !ended && typeof currentTime === "number" && new Date(event.eventStartAt).getTime() <= currentTime;

  return (
    <article className="cm-interactive-card flex h-full flex-col rounded-2xl bg-[var(--app-surface)] p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            backgroundColor: theme.accent,
            color: theme.primary,
          }}
        >
          {campusName}
        </span>
        <span className="rounded-full bg-[var(--app-discovery-soft)] px-3 py-1 text-xs font-semibold text-[var(--app-discovery)]">
          {event.category}
        </span>
        {happeningNow && <span className="rounded-full bg-[var(--app-urgent-soft)] px-3 py-1 text-xs font-semibold text-[var(--app-urgent)]">Happening now</span>}
      </div>

      <h3 className="mt-4 text-xl font-bold text-slate-950">{event.title}</h3>

      {event.organizer && <p className="mt-2 text-sm font-semibold" style={{ color: theme.primary }}>Hosted by {event.organizer}</p>}

      <dl className="mt-4 grid gap-3 text-sm text-slate-600">
        <div>
          <dt className="flex items-center gap-1.5 font-semibold text-slate-800"><ClockIcon className="h-4 w-4"/>Date &amp; time</dt>
          <dd className="mt-0.5">
            {event.date} · {event.time}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 font-semibold text-slate-800"><LocationIcon className="h-4 w-4"/>Location</dt>
          <dd className="mt-0.5">{event.location}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-6 text-slate-600">
        {event.description}
      </p>

      <p className="mt-4 text-xs font-medium text-slate-500">
        {event.audience}
      </p>

      {event.source && <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><CalendarIcon className="h-3.5 w-3.5"/><span>{event.authorBrandId ? `${event.sourceTrust === "verified_brand" ? "Verified Brand" : "Brand source"}: ${event.organizer ?? event.source.sourceTitle}` : event.systemGenerated ? `Sourced by Campus Mint from ${event.source.sourceTitle}` : event.source.sourceTitle}</span><a href={event.source.sourceUrl} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-2">Official page</a>{typeof event.distanceFromCampusMiles === "number" && <span>· {event.distanceFromCampusMiles.toFixed(1)} mi from campus</span>}</div>}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <p className="text-sm font-medium text-slate-600" aria-live="polite">
          {displayedRsvpCount.toLocaleString("en-US")} attending
        </p>
        <div className="flex items-center gap-2">
          {onOpenDetails && (
            <button
              type="button"
              onClick={onOpenDetails}
              className="rounded-xl border px-3.5 py-2 text-sm font-semibold"
              style={{ borderColor: theme.primary, color: theme.primary }}
            >
              Details
            </button>
          )}
          <button
            type="button"
            aria-pressed={isGoing}
            disabled={ended || readOnly}
            onClick={() => onToggleRsvp(event.id)}
            className="min-w-24 rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: isGoing ? "var(--app-personal-soft)" : "var(--app-personal)",
              color: isGoing ? "var(--app-personal)" : "var(--app-personal-contrast)",
              outlineColor: theme.primary,
            }}
          >
            {ended ? "Event ended" : isGoing ? "Attending ✓" : "Attend"}
          </button>
        </div>
      </div>
    </article>
  );
}
