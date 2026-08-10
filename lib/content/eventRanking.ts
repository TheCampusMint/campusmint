export type EventWindow = {
  eventStartAt: string | null | undefined;
  eventEndAt?: string | null;
};

type RankedEventWindow = {
  phase: 0 | 1 | 2 | 3;
  usefulEnd: number;
  start: number;
};

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function rankingWindow(event: EventWindow, currentTime: number): RankedEventWindow {
  const start = timestamp(event.eventStartAt);
  const end = timestamp(event.eventEndAt);
  if (end !== null && end <= currentTime) {
    return { phase: 3, usefulEnd: end, start: start ?? Number.POSITIVE_INFINITY };
  }
  if (start !== null && start <= currentTime) {
    return { phase: 0, usefulEnd: end ?? Number.POSITIVE_INFINITY, start };
  }
  if (start !== null) {
    return { phase: 1, usefulEnd: end ?? start, start };
  }
  return { phase: 2, usefulEnd: Number.POSITIVE_INFINITY, start: Number.POSITIVE_INFINITY };
}

export function isEventContentEnded(event: EventWindow, currentTime = Date.now()) {
  return rankingWindow(event, currentTime).phase === 3;
}

export function compareEventsByUrgency(first: EventWindow, second: EventWindow, currentTime = Date.now()) {
  const firstRank = rankingWindow(first, currentTime);
  const secondRank = rankingWindow(second, currentTime);
  return firstRank.phase - secondRank.phase
    || firstRank.usefulEnd - secondRank.usefulEnd
    || firstRank.start - secondRank.start;
}

export function rankEventContent<T extends EventWindow>(events: readonly T[], currentTime = Date.now()) {
  return events
    .filter((event) => !isEventContentEnded(event, currentTime))
    .sort((first, second) => compareEventsByUrgency(first, second, currentTime));
}

/** Keeps non-event positions intact while urgency-sorting only the event slots. */
export function rankEventContentInMixedFeed<T>(
  items: readonly T[],
  getEventWindow: (item: T) => EventWindow | null,
  currentTime = Date.now(),
) {
  const activeItems = items.filter((item) => {
    const eventWindow = getEventWindow(item);
    return !eventWindow || !isEventContentEnded(eventWindow, currentTime);
  });
  const rankedEvents = activeItems
    .flatMap((item) => {
      const eventWindow = getEventWindow(item);
      return eventWindow ? [{ item, eventWindow }] : [];
    })
    .sort((first, second) => compareEventsByUrgency(first.eventWindow, second.eventWindow, currentTime));
  let eventIndex = 0;
  return activeItems.map((item) => getEventWindow(item) ? rankedEvents[eventIndex++].item : item);
}
