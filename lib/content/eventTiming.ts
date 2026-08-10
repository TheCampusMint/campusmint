export type EventTimingStatus =
  | "live"
  | "starting_soon"
  | "countdown"
  | "tonight"
  | "today"
  | "tomorrow"
  | "future"
  | "ended"
  | "unscheduled";

export type EventTimingResult = {
  status: EventTimingStatus;
  label: string;
  secondaryLabel: string | null;
  isUrgent: boolean;
  hoursUntilStart: number | null;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DEFAULT_ACTIVE_EVENT_WINDOW_MS = 2 * HOUR;
const EVENING_HOUR = 17;

function resolvedTimeZone(timeZone?: string | null) {
  if (!timeZone) return Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return timeZone;
  } catch {
    return null;
  }
}

function zonedParts(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(timestamp);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function localDayNumber(timestamp: number, timeZone: string) {
  const parts = zonedParts(timestamp, timeZone);
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / (24 * HOUR));
}

function timestamp(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = value instanceof Date ? value.getTime() : typeof value === "number" ? value : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function getEventTimingStatus(
  eventStartAt: string | number | Date | null | undefined,
  eventEndAt?: string | number | Date | null,
  now: string | number | Date = Date.now(),
  timeZone?: string | null,
): EventTimingResult {
  const start = timestamp(eventStartAt);
  const current = timestamp(now);
  const explicitEnd = timestamp(eventEndAt);
  if (start === null || current === null || (explicitEnd !== null && explicitEnd <= start)) {
    return { status: "unscheduled", label: "EVENT", secondaryLabel: null, isUrgent: false, hoursUntilStart: null };
  }

  const end = explicitEnd ?? start + DEFAULT_ACTIVE_EVENT_WINDOW_MS;
  if (current >= end) {
    return { status: "ended", label: "ENDED", secondaryLabel: null, isUrgent: false, hoursUntilStart: 0 };
  }
  if (current >= start) {
    return { status: "live", label: "LIVE NOW", secondaryLabel: null, isUrgent: true, hoursUntilStart: 0 };
  }

  const millisecondsUntilStart = start - current;
  const hoursUntilStart = millisecondsUntilStart / HOUR;
  if (millisecondsUntilStart <= 30 * MINUTE) {
    return { status: "starting_soon", label: "STARTING SOON", secondaryLabel: null, isUrgent: true, hoursUntilStart };
  }
  if (millisecondsUntilStart <= 3 * HOUR) {
    const roundedHours = Math.ceil(hoursUntilStart);
    return { status: "countdown", label: `${roundedHours}H`, secondaryLabel: `${roundedHours} hour${roundedHours === 1 ? "" : "s"} away`, isUrgent: true, hoursUntilStart };
  }

  const zone = resolvedTimeZone(timeZone);
  if (!zone) {
    return { status: "future", label: "EVENT", secondaryLabel: null, isUrgent: false, hoursUntilStart };
  }
  const currentDay = localDayNumber(current, zone);
  const startDay = localDayNumber(start, zone);
  if (startDay === currentDay) {
    const eventHour = zonedParts(start, zone).hour;
    return eventHour >= EVENING_HOUR
      ? { status: "tonight", label: "TONIGHT", secondaryLabel: null, isUrgent: true, hoursUntilStart }
      : { status: "today", label: "TODAY", secondaryLabel: null, isUrgent: true, hoursUntilStart };
  }
  if (startDay === currentDay + 1 && millisecondsUntilStart <= 24 * HOUR) {
    return { status: "tomorrow", label: "TOMORROW", secondaryLabel: `${Math.ceil(hoursUntilStart)} hours away`, isUrgent: true, hoursUntilStart };
  }
  return { status: "future", label: "EVENT", secondaryLabel: null, isUrgent: false, hoursUntilStart };
}

export function zonedDateTimeToIso(localDate: string, localTime: string, timeZone?: string | null) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(localTime);
  if (!dateMatch || !timeMatch) return null;
  const [, year, month, day] = dateMatch.map(Number);
  const [, hour, minute] = timeMatch.map(Number);
  const zone = resolvedTimeZone(timeZone);
  if (!zone) return null;
  const desiredUtcShape = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = desiredUtcShape;

  // Two passes account for timezone offsets that change near daylight-saving transitions.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = zonedParts(candidate, zone);
    const representedUtcShape = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    candidate += desiredUtcShape - representedUtcShape;
  }
  const resolved = zonedParts(candidate, zone);
  if (resolved.year !== year || resolved.month !== month || resolved.day !== day || resolved.hour !== hour || resolved.minute !== minute) {
    return null;
  }
  return new Date(candidate).toISOString();
}

export function formatEventDateTimeRange(
  eventStartAt: string | null | undefined,
  eventEndAt?: string | null,
  timeZone?: string | null,
) {
  const start = timestamp(eventStartAt);
  const end = timestamp(eventEndAt);
  if (start === null) return null;
  const zone = resolvedTimeZone(timeZone);
  if (!zone) return null;
  const dateLabel = new Intl.DateTimeFormat("en-US", { timeZone: zone, dateStyle: "medium" }).format(start);
  const timeFormatter = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeStyle: "short" });
  return `${dateLabel} · ${timeFormatter.format(start)}${end === null ? "" : `–${timeFormatter.format(end)}`}`;
}
