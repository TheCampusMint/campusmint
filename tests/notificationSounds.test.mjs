import assert from "node:assert/strict";
import test from "node:test";

import {
  getNotificationSoundIdentity,
  getNotificationSoundProfile,
  notificationSoundIdentities,
  playNotificationSound,
} from "../lib/notifications/notificationSounds.ts";

test("notification event-to-sound mapping is deterministic", () => {
  assert.equal(
    getNotificationSoundIdentity("urgent_event_reminder"),
    "urgent_event",
  );
  assert.equal(
    getNotificationSoundIdentity("direct_message_received"),
    "direct_message",
  );
  assert.equal(
    getNotificationSoundIdentity("standard_notification"),
    "standard",
  );

  for (const identity of notificationSoundIdentities) {
    assert.equal(
      getNotificationSoundProfile(identity),
      getNotificationSoundProfile(identity),
    );
  }
});

test("Direct Mint sound schedules three sequential descending notes", () => {
  const tones = getNotificationSoundProfile("direct_message").tones;

  assert.equal(tones.length, 3);
  assert.ok(tones[0].startsAtSeconds < tones[1].startsAtSeconds);
  assert.ok(tones[1].startsAtSeconds < tones[2].startsAtSeconds);
  assert.ok(tones[0].frequencyHz > tones[1].frequencyHz);
  assert.ok(tones[1].frequencyHz > tones[2].frequencyHz);
  assert.ok(
    tones[2].startsAtSeconds + tones[2].durationSeconds <= 1,
  );
});

test("Direct Mint notes descend in gain as well as pitch", () => {
  const tones = getNotificationSoundProfile("direct_message").tones;

  assert.ok(tones[0].gain > tones[1].gain);
  assert.ok(tones[1].gain > tones[2].gain);
});

test("standard notification is a single rounded boop profile", () => {
  const profile = getNotificationSoundProfile("standard");

  assert.equal(profile.label, "Boop");
  assert.equal(profile.tones.length, 1);
  assert.equal(profile.tones[0].oscillator, "sine");
  assert.ok(
    profile.tones[0].endFrequencyHz < profile.tones[0].frequencyHz,
  );
});

test("urgent event notification is a short bling with a quiet shimmer", () => {
  const profile = getNotificationSoundProfile("urgent_event");

  assert.equal(profile.label, "Bling");
  assert.equal(profile.tones.length, 2);
  assert.equal(
    profile.tones[1].frequencyHz,
    profile.tones[0].frequencyHz * 2,
  );
  assert.ok(profile.tones[1].gain < profile.tones[0].gain);
  assert.ok(
    profile.tones.every((tone) => tone.durationSeconds < 0.3),
  );
});

test("sound helper is SSR-safe and does not require AudioContext on import", async () => {
  assert.equal(typeof globalThis.window, "undefined");
  assert.equal(
    await playNotificationSound("standard"),
    "unavailable",
  );
  assert.equal(
    await playNotificationSound("standard", { enabled: false }),
    "disabled",
  );
});
