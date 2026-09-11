import type { MusicSearchResult } from "../../lib/content/music.ts";

/** Fictional development catalog. Provider labels test normalization only. */
export const developmentMusicTracks: MusicSearchResult[] = [
  {
    id: "spotify:dev-campus-dawn", provider: "spotify",
    providerTrackId: "dev-campus-dawn", trackId: "dev-campus-dawn",
    trackTitle: "Campus Dawn (Development Instrumental)", artist: "North Quad Sessions",
    album: "Study Hours", artworkUrl: null,
    previewUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
    externalUrl: null, providerUrl: null, durationMs: 148000, isDevelopmentFixture: true,
  },
  {
    id: "apple_music:dev-library-lights", provider: "apple_music",
    providerTrackId: "dev-library-lights", trackId: "dev-library-lights",
    trackTitle: "Library Lights After Midnight", artist: "The Fictional Finals",
    album: "Quiet Floors", artworkUrl: null, previewUrl: null,
    externalUrl: null, providerUrl: null, durationMs: 201000, isDevelopmentFixture: true,
  },
  {
    id: "spotify:dev-kyle-field-walk", provider: "spotify",
    providerTrackId: "dev-kyle-field-walk", trackId: "dev-kyle-field-walk",
    trackTitle: "The Extremely Long Walk Across Campus Before an Eight AM",
    artist: "Bus Route Zero", album: "Development Commute", artworkUrl: null,
    previewUrl: null, externalUrl: null, providerUrl: null, durationMs: 184000,
    isDevelopmentFixture: true,
  },
  {
    id: "apple_music:dev-open-mic", provider: "apple_music",
    providerTrackId: "dev-open-mic", trackId: "dev-open-mic",
    trackTitle: "Open Mic Polaroid", artist: "Courtyard Echo",
    album: "Friday at Seven", artworkUrl: null, previewUrl: null,
    externalUrl: null, providerUrl: null, durationMs: 176000, isDevelopmentFixture: true,
  },
];
