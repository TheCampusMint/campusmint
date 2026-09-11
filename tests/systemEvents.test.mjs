import assert from "node:assert/strict";
import test from "node:test";
import { developmentSystemEventCandidates } from "../data/development/systemEvents.ts";
import { sampleEvents } from "../data/events.ts";
import { applySystemEventUpdate, buildEventPosterData, ingestSystemEvent, isUpcomingDiscoverableEvent } from "../lib/events/systemEventIngestion.ts";
import { distanceMiles, isEventInsideCampusRadius } from "../lib/events/geography.ts";
import { parseBrandEventSubmission } from "../lib/events/brandEventSubmission.ts";
import { universities } from "../data/universities.ts";
import { accountTypes, isValidBrandEmail, normalizeSafeBrandWebsite } from "../lib/auth/accountTypes.ts";

const localPublicEvent = {
  ...developmentSystemEventCandidates[0],
  id: "local-business-event",
  title: "Local business pop-up",
  location: "Century Square",
  latitude: 30.6254,
  longitude: -96.3391,
  organizer: "Local Business",
  sourceTrust: "verified_source",
  source: { ...developmentSystemEventCandidates[0].source, sourceType: "trusted_public", sourceUrl: "https://example.org/events/pop-up" },
};

test("source-backed event publishes with provenance and factual poster fallback", () => {
  const result = ingestSystemEvent({ candidate: developmentSystemEventCandidates[0], existingEvents: [], currentTime: Date.parse("2026-09-10T12:00:00-05:00"), id: "system" });
  assert.equal(result.status, "published");
  assert.equal(result.event.systemGenerated, true);
  assert.equal(result.event.mediaStrategy, "generated_poster");
  assert.equal(result.event.source.sourceUrl, "https://events.tamu.edu/");
  assert.deepEqual(buildEventPosterData({ ...result.event, organizer: null }), { brand: "Campus Mint", title: result.event.title, when: `${result.event.date} · ${result.event.time}`, location: result.event.location, campus: result.event.campus, organizer: null });
});
test("equivalent organic event suppresses a system duplicate", () => {
  const candidate = developmentSystemEventCandidates[1];
  const existingOrganic = { ...candidate, id: "organic", systemGenerated: false };
  const result = ingestSystemEvent({ candidate, existingEvents: [existingOrganic], currentTime: Date.parse("2026-08-20T00:00:00Z"), id: "duplicate" });
  assert.equal(result.status, "duplicate");
  assert.equal(result.preferredOrganic, true);
});
test("canceled and past events stop discovery without losing update history", () => {
  const updated = applySystemEventUpdate(sampleEvents.at(-1), { status: "cancelled" });
  assert.equal(isUpcomingDiscoverableEvent(updated, Date.parse("2026-09-10T00:00:00Z")), false);
});

test("real local public happenings qualify inside the configured campus radius without a university organizer", () => {
  assert.equal(isEventInsideCampusRadius(localPublicEvent, universities.tamu), true);
  const result = ingestSystemEvent({ candidate: localPublicEvent, existingEvents: [], currentTime: Date.parse("2026-09-10T00:00:00Z"), id: "local" });
  assert.equal(result.status, "published");
  assert.equal(result.event.organizer, "Local Business");
});

test("an event outside TAMU's configured radius is excluded", () => {
  const outside = { ...localPublicEvent, latitude: 30.2672, longitude: -97.7431 };
  assert.equal(distanceMiles({ latitude: universities.tamu.campusLatitude, longitude: universities.tamu.campusLongitude }, outside) > 10, true);
  assert.equal(ingestSystemEvent({ candidate: outside, existingEvents: [], currentTime: Date.parse("2026-09-10T00:00:00Z"), id: "outside" }).status, "rejected");
});

test("unknown local coordinates fail closed for non-university sources", () => {
  const unknown = { ...localPublicEvent, latitude: null, longitude: null };
  const result = ingestSystemEvent({ candidate: unknown, existingEvents: [], currentTime: Date.parse("2026-09-10T00:00:00Z"), id: "unknown" });
  assert.deepEqual(result, { status: "rejected", reason: "unknown_location" });
});

test("each campus uses its own center and radius", () => {
  const austin = { ...localPublicEvent, campus: "texas", latitude: universities.texas.campusLatitude, longitude: universities.texas.campusLongitude };
  assert.equal(isEventInsideCampusRadius(austin, universities.texas), true);
  assert.equal(isEventInsideCampusRadius(austin, universities.tamu), false);
});

test("an authenticated Brand event is eligible but does not claim independent verification", () => {
  const brandEvent = { ...localPublicEvent, sourceTrust: "authenticated_organizer", authorBrandId: "brand-1", source: { ...localPublicEvent.source, sourceType: "brand", sourceTitle: "Local Business" } };
  const result = ingestSystemEvent({ candidate: brandEvent, existingEvents: [], currentTime: Date.parse("2026-09-10T00:00:00Z"), id: "brand-event" });
  assert.equal(result.status, "published");
  assert.equal(result.event.sourceTrust, "authenticated_organizer");
});

test("the same authenticated Brand event suppresses a system-ingested duplicate", () => {
  const existingBrand = { ...localPublicEvent, id: "brand-first", authorBrandId: "brand-1", systemGenerated: false, source: { ...localPublicEvent.source, sourceType: "brand" } };
  const result = ingestSystemEvent({ candidate: localPublicEvent, existingEvents: [existingBrand], currentTime: Date.parse("2026-09-10T00:00:00Z"), id: "system-second" });
  assert.equal(result.status, "duplicate");
  assert.equal(result.preferredAuthenticatedBrand, true);
});

test("Student, Brand, and Campus Mint system accounts remain distinct", () => {
  assert.deepEqual(accountTypes, ["student", "brand", "system"]);
  assert.equal(isValidBrandEmail("events@localbusiness.com"), true);
  assert.equal(isValidBrandEmail("smallbrand@gmail.com"), true);
});

test("Brand website validation allows web URLs and rejects executable protocols", () => {
  assert.equal(normalizeSafeBrandWebsite("brand.example").startsWith("https://"), true);
  assert.equal(normalizeSafeBrandWebsite("javascript:alert(1)"), null);
  assert.equal(normalizeSafeBrandWebsite("data:text/html,hello"), null);
});

test("Brand event submission requires a real time, location, and coordinates", () => {
  const valid = parseBrandEventSubmission({ title: "Free tote giveaway", description: "Free totes while supplies last.", campusId: "tamu", category: "Social", startsAt: "2099-09-18T19:00:00-05:00", endsAt: "2099-09-18T21:00:00-05:00", location: "MSC Plaza", latitude: 30.6123, longitude: -96.3414 });
  assert.equal(valid.ok, true);
  const invalid = parseBrandEventSubmission({ title: "Ordinary post" });
  assert.equal(invalid.ok, false);
});
