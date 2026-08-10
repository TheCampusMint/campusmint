import assert from "node:assert/strict";
import test from "node:test";

import { getEventTimingStatus, zonedDateTimeToIso } from "../lib/content/eventTiming.ts";

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

test("45 minutes away rounds up to 1H", () => {
  const result = getEventTimingStatus("2026-08-10T15:45:00-05:00", null, "2026-08-10T15:00:00-05:00", timeZone);
  assert.equal(result.status, "countdown");
  assert.equal(result.label, "1H");
});

test("2 hours 20 minutes away rounds up to 3H", () => {
  const result = getEventTimingStatus("2026-08-10T17:20:00-05:00", null, "2026-08-10T15:00:00-05:00", timeZone);
  assert.equal(result.status, "countdown");
  assert.equal(result.label, "3H");
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
