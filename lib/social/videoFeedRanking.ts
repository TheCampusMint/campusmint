import {
  getMintFeed,
  type MintFeedState,
} from "@/lib/social/mintFeeds";
import { rankVisibleVideoMintz } from "@/lib/social/videoRankingCore";
import type { Mint } from "@/types/mint";

/**
 * Deterministic development ranking for the video-only viewer.
 * Visibility is resolved by the existing Discover feed first, so ranking can
 * never promote content the viewer is not already permitted to see.
 */
export function rankVideoMintz(
  mints: Mint[],
  state: MintFeedState,
) {
  return rankVisibleVideoMintz(
    getMintFeed(mints, "discover", state),
    state,
  );
}
