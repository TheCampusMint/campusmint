import type { UniversityTheme } from "@/data/universities";
import { getOrganizationById } from "@/data/organizations";
import type { Event } from "@/types/event";

type EventCardProps = {
  event: Event;
  campusName: string;
  isGoing: boolean;
  theme: UniversityTheme;
  onToggleRsvp: (eventId: Event["id"]) => void;
  onOpenDetails?: () => void;
};

export function EventCard({
  event,
  campusName,
  isGoing,
  theme,
  onToggleRsvp,
  onOpenDetails,
}: EventCardProps) {
  const displayedRsvpCount = event.rsvpCount + (isGoing ? 1 : 0);
  const organization = getOrganizationById(event.organizationId);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {event.category}
        </span>
      </div>

      <h3 className="mt-4 text-xl font-bold text-slate-950">{event.title}</h3>

      {organization && <p className="mt-2 text-sm font-semibold" style={{ color: theme.primary }}>Hosted by {organization.name}</p>}

      <dl className="mt-4 grid gap-3 text-sm text-slate-600">
        <div>
          <dt className="font-semibold text-slate-800">Date & time</dt>
          <dd className="mt-0.5">
            {event.date} · {event.time}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-800">Location</dt>
          <dd className="mt-0.5">{event.location}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-6 text-slate-600">
        {event.description}
      </p>

      <p className="mt-4 text-xs font-medium text-slate-500">
        {event.audience}
      </p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <p className="text-sm font-medium text-slate-600" aria-live="polite">
          {displayedRsvpCount.toLocaleString("en-US")} going
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
            onClick={() => onToggleRsvp(event.id)}
            className="min-w-24 rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: isGoing ? theme.accent : theme.primary,
              borderColor: theme.primary,
              color: isGoing ? theme.primary : theme.secondary,
              outlineColor: theme.primary,
            }}
          >
            {isGoing ? "Going" : "RSVP"}
          </button>
        </div>
      </div>
    </article>
  );
}
