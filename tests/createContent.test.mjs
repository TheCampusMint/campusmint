import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { extractHashtagsFromCaption } from "../lib/content/hashtags.ts";
import {
  getActiveMentionQuery,
  insertMentionAtCaret,
} from "../lib/content/mentions.ts";
import { createLinkedMusicMetadata } from "../lib/content/music.ts";
import { getMintContentType } from "../lib/content/localMintMedia.ts";

const createSource = readFileSync(
  new URL("../components/content/CreateContentFlow.tsx", import.meta.url),
  "utf8",
);
const settingsSource = readFileSync(
  new URL("../components/shell/SettingsPanel.tsx", import.meta.url),
  "utf8",
);

test("Create Mint parses inline hashtags without a dedicated field", () => {
  assert.deepEqual(
    extractHashtagsFromCaption("Long run #Running #TAMU! #running"),
    ["running", "tamu"],
  );
  assert.doesNotMatch(createSource, />\s*Hashtags(?: \(optional\))?\s*</i);
});

test("Create Mint resolves and inserts inline mention queries", () => {
  assert.equal(getActiveMentionQuery("Running with @cam", 17), "cam");
  assert.equal(
    insertMentionAtCaret("Running with @cam", 17, "cameron.demo"),
    "Running with @cameron.demo ",
  );
  assert.doesNotMatch(createSource, />\s*Mentions(?: \(optional\))?\s*</i);
  assert.doesNotMatch(createSource, /Tag Users/i);
});

test("plain community posts need no media and media posts preserve their content type", () => {
  assert.equal(getMintContentType([]), "text");
  assert.equal(getMintContentType([{ type: "image" }]), "image");
  assert.equal(getMintContentType([{ type: "video" }]), "video");
  assert.equal(getMintContentType([{ type: "image" }, { type: "video" }]), "carousel");
});

test("Create Mint says Duration, preserves privacy, and retains media selection", () => {
  assert.match(createSource, />\s*Duration\s*</);
  assert.doesNotMatch(createSource, />\s*Expiration\s*</);
  assert.match(createSource, /Mint privacy/);
  assert.match(createSource, /prepareLocalMintMedia/);
  assert.match(createSource, /accept="image\/\*,video\/\*"/);
  assert.doesNotMatch(createSource, /Show like count|Hide like count/i);
  assert.doesNotMatch(settingsSource, /Hide like counts/i);
});

test("legacy Spotify and Apple Music links still migrate without remaining the composer UX", () => {
  assert.equal(
    createLinkedMusicMetadata({
      provider: "spotify",
      providerUrl: "https://open.spotify.com/track/example",
      trackTitle: "Example",
      artist: "Artist",
    })?.provider,
    "spotify",
  );
  assert.equal(
    createLinkedMusicMetadata({
      provider: "apple_music",
      providerUrl: "https://music.apple.com/us/album/example",
      trackTitle: "Example",
      artist: "Artist",
    })?.provider,
    "apple_music",
  );
  assert.equal(
    createLinkedMusicMetadata({
      provider: "spotify",
      providerUrl: "https://music.apple.com/us/album/example",
      trackTitle: "Example",
      artist: "Artist",
    }),
    null,
  );
  assert.doesNotMatch(createSource, /MusicPicker|SelectedMusicTrack|Add Music|Music \(optional\)/);
  assert.doesNotMatch(createSource, /open\.spotify\.com link|music\.apple\.com link/i);
});
