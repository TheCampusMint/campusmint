import assert from "node:assert/strict";
import test from "node:test";

import { getEventTimingStatus, zonedDateTimeToIso } from "../lib/content/eventTiming.ts";
import { rankEventContent, rankEventContentInMixedFeed } from "../lib/content/eventRanking.ts";

const timeZone = "America/Chicago";

test("currently live", () => {
  const result = getEventTimingStatus("2026-08-10T14:30:00-05:00", "2026-08-10T16:00:00-05:00", "2026-08-10T15:00:00-05:00", timeZone);
  assert.equal(result.status, "live");
  assert.equal(result.label, "LIVE NOW");
  assert.equal(result.isUrgent, true);
});

test("10 minutes away", () => {
  const result = getEventTimingStatus("2026-08-10T15:10:00-05:00", null, "2026-08-10T15:00:00-05:00", timeZone);
  assert.equal(result.status, "starting_soon");
  assert.equal(result.label, "STARTING SOON");
});

test("45 minutes away rounds up to IN 1H", () => {
  const result = getEventTimingStatus("2026-08-10T15:45:00-05:00", null, "2026-08-10T15:00:00-05:00", timeZone);
  assert.equal(result.status, "countdown");
  assert.equal(result.label, "IN 1H");
});

test("2 hours 20 minutes away rounds up to IN 3H", () => {
  const result = getEventTimingStatus("2026-08-10T17:20:00-05:00", null, "2026-08-10T15:00:00-05:00", timeZone);
  assert.equal(result.status, "countdown");
  assert.equal(result.label, "IN 3H");
});

test("30 minutes away has a precise countdown", () => {
  const result = getEventTimingStatus("2026-08-10T15:30:00-05:00", null, "2026-08-10T15:00:00-05:00", timeZone);
  assert.equal(result.status, "countdown");
  assert.equal(result.label, "IN 30M");
});

test("an active event nearing its end is ending soon", () => {
  const result = getEventTimingStatus("2026-08-10T14:00:00-05:00", "2026-08-10T15:20:00-05:00", "2026-08-10T15:00:00-05:00", timeZone);
  assert.equal(result.status, "ending_soon");
  assert.equal(result.label, "ENDING SOON");
});

test("later this afternoon", () => {
  const result = getEventTimingStatus("2026-08-10T14:00:00-05:00", null, "2026-08-10T10:00:00-05:00", timeZone);
  assert.equal(result.status, "today");
  assert.equal(result.label, "TODAY");
});

test("tonight uses the event timezone evening threshold", () => {
  const result = getEventTimingStatus("2026-08-10T18:00:00-05:00", null, "2026-08-10T13:00:00-05:00", timeZone);
  assert.equal(result.status, "tonight");
  assert.equal(result.label, "TONIGHT");
});

test("tomorrow but less than 24 hours away", () => {
  const result = getEventTimingStatus("2026-08-11T10:00:00-05:00", null, "2026-08-10T15:00:00-05:00", timeZone);
  assert.equal(result.status, "tomorrow");
  assert.equal(result.label, "TOMORROW");
});

test("more than 24 hours away is not urgent", () => {
  const result = getEventTimingStatus("2026-08-12T16:00:00-05:00", null, "2026-08-10T15:00:00-05:00", timeZone);
  assert.equal(result.status, "future");
  assert.equal(result.label, "EVENT");
  assert.equal(result.isUrgent, false);
});

test("already ended", () => {
  const result = getEventTimingStatus("2026-08-10T13:00:00-05:00", "2026-08-10T14:00:00-05:00", "2026-08-10T15:00:00-05:00", timeZone);
  assert.equal(result.status, "ended");
  assert.equal(result.label, "ENDED");
  assert.equal(result.isUrgent, false);
});

test("an event without an end uses the reasonable two-hour active window", () => {
  const result = getEventTimingStatus("2026-08-10T14:00:00-05:00", null, "2026-08-10T15:00:00-05:00", timeZone);
  assert.equal(result.status, "live");
  assert.equal(result.label, "LIVE NOW");
});

test("local event input converts with daylight-saving-aware IANA offsets", () => {
  assert.equal(zonedDateTimeToIso("2026-07-01", "18:00", timeZone), "2026-07-01T23:00:00.000Z");
  assert.equal(zonedDateTimeToIso("2026-12-01", "18:00", timeZone), "2026-12-02T00:00:00.000Z");
});

test("invalid timezones do not create an urgent label or fake timestamp", () => {
  const result = getEventTimingStatus("2026-08-10T18:00:00Z", null, "2026-08-10T10:00:00Z", "Not/A_Timezone");
  assert.equal(result.status, "future");
  assert.equal(result.isUrgent, false);
  assert.equal(zonedDateTimeToIso("2026-08-10", "18:00", "Not/A_Timezone"), null);
});

test("event ranking orders live windows by the earliest ending time before tomorrow", () => {
  const now = new Date("2026-08-10T15:00:00Z").getTime();
  const ranked = rankEventContent([
    { id: "tomorrow", eventStartAt: "2026-08-11T14:00:00Z", eventEndAt: "2026-08-11T16:00:00Z" },
    { id: "ends-1900", eventStartAt: "2026-08-10T12:00:00Z", eventEndAt: "2026-08-10T19:00:00Z" },
    { id: "ends-1530", eventStartAt: "2026-08-10T14:00:00Z", eventEndAt: "2026-08-10T15:30:00Z" },
    { id: "ends-1615", eventStartAt: "2026-08-10T14:30:00Z", eventEndAt: "2026-08-10T16:15:00Z" },
  ], now);
  assert.deepEqual(ranked.map((event) => event.id), ["ends-1530", "ends-1615", "ends-1900", "tomorrow"]);
});

test("upcoming events without an end fall back to their start and ended events are removed", () => {
  const now = new Date("2026-08-10T15:00:00Z").getTime();
  const ranked = rankEventContent([
    { id: "ended", eventStartAt: "2026-08-10T12:00:00Z", eventEndAt: "2026-08-10T14:00:00Z" },
    { id: "no-end", eventStartAt: "2026-08-10T17:00:00Z" },
    { id: "with-end", eventStartAt: "2026-08-10T15:30:00Z", eventEndAt: "2026-08-10T16:30:00Z" },
  ], now);
  assert.deepEqual(ranked.map((event) => event.id), ["with-end", "no-end"]);
});

test("mixed feeds keep personal and club slots fixed while ranking event slots", () => {
  const now = new Date("2026-08-10T15:00:00Z").getTime();
  const items = [
    { id: "personal", kind: "personal", eventStartAt: null, eventEndAt: null },
    { id: "event-tomorrow", kind: "event", eventStartAt: "2026-08-11T15:00:00Z", eventEndAt: "2026-08-11T17:00:00Z" },
    { id: "club", kind: "club", eventStartAt: null, eventEndAt: null },
    { id: "event-soon", kind: "event", eventStartAt: "2026-08-10T14:00:00Z", eventEndAt: "2026-08-10T15:30:00Z" },
  ];
  const ranked = rankEventContentInMixedFeed(items, (item) => item.kind === "event" ? item : null, now);
  assert.deepEqual(ranked.map((item) => item.id), ["personal", "event-soon", "club", "event-tomorrow"]);
});
