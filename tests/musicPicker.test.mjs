import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { developmentMusicTracks } from "../data/development/music.ts";
import { canPreviewTrack, createLinkedMusicMetadata, migrateLegacyMusicMetadata, searchDevelopmentMusic } from "../lib/content/music.ts";

const createSource = readFileSync(new URL("../components/content/CreateContentFlow.tsx", import.meta.url), "utf8");
const notesSource = readFileSync(new URL("../components/messages/ProfileNotesStrip.tsx", import.meta.url), "utf8");

test("music attachment controls are unavailable in posts and Notes", () => {
  assert.doesNotMatch(createSource, /MusicPicker|SelectedMusicTrack|Add Music/);
  assert.match(createSource, /music: null/);
  assert.doesNotMatch(notesSource, /MusicPicker|SelectedMusicTrack|Add Music|hasMusic/);
  assert.match(notesSource, /music: null/);
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


test("publishing discards music attachments and existing tracks have no visible controls", () => {
  const route = readFileSync(new URL("../app/api/mintz/route.ts", import.meta.url), "utf8");
  assert.match(route, /music: null/);
  assert.doesNotMatch(route, /parseMusic\(raw\.music\)/);
  for (const path of ["MintCard.tsx", "FullscreenVideoViewer.tsx"]) {
    const source = readFileSync(new URL(`../components/mintz/${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /mint\.music|MusicPicker/);
  }
});
