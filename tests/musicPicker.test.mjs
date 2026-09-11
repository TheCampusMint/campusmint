import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { developmentMusicTracks } from "../data/development/music.ts";
import { canPreviewTrack, createLinkedMusicMetadata, migrateLegacyMusicMetadata, searchDevelopmentMusic } from "../lib/content/music.ts";

const createSource = readFileSync(new URL("../components/content/CreateContentFlow.tsx", import.meta.url), "utf8");
const notesSource = readFileSync(new URL("../components/messages/ProfileNotesStrip.tsx", import.meta.url), "utf8");

test("music picker replaces manual link-first fields and is shared with Notes", () => {
  assert.match(createSource, /MusicPicker/);
  assert.match(notesSource, /MusicPicker/);
  assert.doesNotMatch(createSource, /open\.spotify\.com link|Track title|Music link \(optional\)/i);
});
test("development catalog normalizes Spotify and Apple Music and searches title artist album", () => {
  assert.ok(developmentMusicTracks.some((track) => track.provider === "spotify"));
  assert.ok(developmentMusicTracks.some((track) => track.provider === "apple_music"));
  assert.equal(searchDevelopmentMusic(developmentMusicTracks, "midnight")[0].artist, "The Fictional Finals");
  assert.equal(searchDevelopmentMusic(developmentMusicTracks, "bus route")[0].provider, "spotify");
  assert.equal(searchDevelopmentMusic(developmentMusicTracks, "quiet floors")[0].provider, "apple_music");
});
test("preview requires a legitimate preview URL and selection metadata can migrate", () => {
  assert.equal(canPreviewTrack(developmentMusicTracks[0]), true);
  assert.equal(canPreviewTrack(developmentMusicTracks[1]), false);
  const legacy = createLinkedMusicMetadata({ provider: "spotify", providerUrl: "https://open.spotify.com/track/demo", trackTitle: "Demo", artist: "Artist" });
  assert.equal(migrateLegacyMusicMetadata(legacy)?.externalUrl, "https://open.spotify.com/track/demo");
});
