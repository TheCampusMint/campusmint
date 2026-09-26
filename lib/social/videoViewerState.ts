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

export type VideoViewerGesture =
  | "pending"
  | "cancel"
  | "exit"
  | "creator";

export function resolveVideoViewerGesture(input: {
  deltaX: number;
  deltaY: number;
  velocityX?: number;
  velocityY?: number;
  committed?: boolean;
}): VideoViewerGesture {
  const absX = Math.abs(input.deltaX);
  const absY = Math.abs(input.deltaY);
  const velocityX = input.velocityX ?? 0;
  const velocityY = input.velocityY ?? 0;
  const intentDistance = 12;

  if (Math.max(absX, absY) < intentDistance) return "pending";

  const horizontal = absX > absY * 1.35;
  const vertical = absY > absX * 1.35;
  if (!horizontal && !vertical) return input.committed ? "cancel" : "pending";
  if (!input.committed) return "pending";

  if (horizontal) {
    const committed = absX >= 72 || Math.abs(velocityX) >= 0.55;
    if (!committed) return "cancel";
    return input.deltaX > 0 ? "exit" : "creator";
  }

  const committed = absY >= 58 || Math.abs(velocityY) >= 0.5;
  if (!committed) return "cancel";
  return "exit";
}
