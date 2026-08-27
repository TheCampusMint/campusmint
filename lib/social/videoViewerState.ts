export type MintVideoViewerState = {
  mintId: string;
  mediaId: string;
  feedScrollY: number;
  orderedMintIds: string[];
};

export function createMintVideoViewerState(input: {
  mintId: string;
  mediaId: string;
  feedScrollY: number;
  orderedMintIds: readonly string[];
}): MintVideoViewerState {
  const orderedMintIds = Array.from(new Set(input.orderedMintIds));

  if (!orderedMintIds.includes(input.mintId)) {
    orderedMintIds.unshift(input.mintId);
  }

  return {
    mintId: input.mintId,
    mediaId: input.mediaId,
    feedScrollY:
      Number.isFinite(input.feedScrollY) && input.feedScrollY > 0
        ? input.feedScrollY
        : 0,
    orderedMintIds,
  };
}

export function getMintVideoViewerReturnScrollY(
  state: MintVideoViewerState | null,
  fallbackScrollY = 0,
) {
  if (state) return state.feedScrollY;

  return Number.isFinite(fallbackScrollY) && fallbackScrollY > 0
    ? fallbackScrollY
    : 0;
}
