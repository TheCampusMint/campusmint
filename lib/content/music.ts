import type { MusicMetadata, MusicProvider } from "../../types/content.ts";

export type MusicCatalogMode = "development" | "provider";
export type MusicSearchResult = MusicMetadata & {
  id: string;
  provider: "spotify" | "apple_music";
  isDevelopmentFixture: boolean;
};
export type MusicCatalogAdapter = {
  mode: MusicCatalogMode;
  search(query: string, signal?: AbortSignal): Promise<MusicSearchResult[]>;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase();
}

export function normalizeMusicMetadata(
  value: Partial<MusicMetadata> | null | undefined,
): MusicMetadata | null {
  if (!value) return null;
  const trackTitle = (value.trackTitle ?? "").trim();
  const artist = (value.artist ?? "").trim();
  const trackId = (value.trackId ?? value.providerTrackId ?? value.id ?? "").trim();
  if (!trackTitle || !artist || !trackId) return null;
  const externalUrl = value.externalUrl ?? value.providerUrl ?? null;
  return {
    id: value.id ?? `${value.provider ?? "development"}:${trackId}`,
    provider: value.provider ?? "development",
    providerTrackId: value.providerTrackId ?? trackId,
    providerUrl: externalUrl,
    externalUrl,
    trackId,
    trackTitle,
    artist,
    album: value.album?.trim() || null,
    artworkUrl: value.artworkUrl ?? null,
    previewUrl: value.previewUrl ?? null,
    durationMs: value.durationMs ?? null,
  };
}

export function migrateLegacyMusicMetadata(value: Partial<MusicMetadata> | null | undefined) {
  return normalizeMusicMetadata(value);
}

export function searchDevelopmentMusic(tracks: readonly MusicSearchResult[], query: string) {
  const needle = normalize(query);
  if (!needle) return [...tracks];
  return tracks.filter((track) =>
    [track.trackTitle, track.artist, track.album]
      .map(normalize)
      .some((field) => field.includes(needle)),
  );
}

export function createDevelopmentMusicAdapter(
  tracks: readonly MusicSearchResult[],
): MusicCatalogAdapter {
  return {
    mode: "development",
    async search(query, signal) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return searchDevelopmentMusic(tracks, query);
    },
  };
}

export function canPreviewTrack(track: MusicMetadata) {
  return Boolean(track.previewUrl);
}

export function getMusicExternalUrl(track: MusicMetadata) {
  return track.externalUrl ?? track.providerUrl ?? null;
}

/** Compatibility helper for old stored URL-first attachments. */
export function createLinkedMusicMetadata(input: {
  provider: Extract<MusicProvider, "spotify" | "apple_music">;
  providerUrl: string;
  trackTitle: string;
  artist: string;
}): MusicMetadata | null {
  const raw = input.providerUrl.trim();
  if (!raw || !input.trackTitle.trim() || !input.artist.trim()) return null;
  try {
    const url = new URL(raw);
    const valid =
      (input.provider === "spotify" && url.hostname === "open.spotify.com") ||
      (input.provider === "apple_music" && url.hostname === "music.apple.com");
    if (!valid) return null;
    const providerTrackId =
      url.pathname.split("/").filter(Boolean).at(-1) ?? url.pathname;
    return normalizeMusicMetadata({
      id: `${input.provider}:${url.pathname}`,
      provider: input.provider,
      providerTrackId,
      trackId: providerTrackId,
      trackTitle: input.trackTitle,
      artist: input.artist,
      artworkUrl: null,
      previewUrl: null,
      externalUrl: url.toString(),
    });
  } catch {
    return null;
  }
}
