import type {
  MintPrivateAppreciation,
  MintPublicEndorsement,
} from "../../types/mint.ts";
import type {
  Follow,
  Friendship,
  UserBlock,
} from "../../types/social.ts";

export const PUBLIC_ENDORSEMENT_ACTIVE_COLOR = "#ef4444";

export type StoredMintInteractionState = {
  version: 2;
  privateAppreciations: MintPrivateAppreciation[];
  publicEndorsements: MintPublicEndorsement[];
};

type LegacyLikeRecord = Omit<MintPrivateAppreciation, "source"> & {
  source?: MintPrivateAppreciation["source"];
};

export function registerPrivateAppreciation(
  current: readonly MintPrivateAppreciation[],
  input: Omit<MintPrivateAppreciation, "id"> & { id?: string },
): { records: MintPrivateAppreciation[]; added: boolean } {
  const exists = current.some(
    (item) => item.mintId === input.mintId && item.userId === input.userId,
  );

  if (exists) return { records: [...current], added: false };

  return {
    records: [
      ...current,
      {
        ...input,
        id: input.id ?? `private-appreciation:${input.mintId}:${input.userId}`,
      },
    ],
    added: true,
  };
}

export function togglePublicEndorsement(
  current: readonly MintPublicEndorsement[],
  input: Omit<MintPublicEndorsement, "id"> & { id?: string },
): { records: MintPublicEndorsement[]; endorsed: boolean } {
  const exists = current.some(
    (item) => item.mintId === input.mintId && item.userId === input.userId,
  );

  if (exists) {
    return {
      records: current.filter(
        (item) =>
          !(item.mintId === input.mintId && item.userId === input.userId),
      ),
      endorsed: false,
    };
  }

  return {
    records: [
      ...current,
      {
        ...input,
        id: input.id ?? `public-endorsement:${input.mintId}:${input.userId}`,
      },
    ],
    endorsed: true,
  };
}

function isLegacyLikeRecord(value: unknown): value is LegacyLikeRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<LegacyLikeRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.mintId === "string" &&
    typeof record.userId === "string" &&
    typeof record.createdAt === "string"
  );
}

function isPublicEndorsement(value: unknown): value is MintPublicEndorsement {
  return isLegacyLikeRecord(value);
}

/** Privacy-safe migration: every ambiguous old Like becomes private. */
export function migrateMintInteractionState(
  value: unknown,
): StoredMintInteractionState {
  const source = value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
  const privateSource = Array.isArray(source.privateAppreciations)
    ? source.privateAppreciations
    : Array.isArray(source.likes)
      ? source.likes
      : [];
  const publicSource = Array.isArray(source.publicEndorsements)
    ? source.publicEndorsements
    : [];

  const privateAppreciations = privateSource
    .filter(isLegacyLikeRecord)
    .reduce<MintPrivateAppreciation[]>((records, item) => {
      return registerPrivateAppreciation(records, {
        ...item,
        source: item.source ?? "legacy_like",
      }).records;
    }, []);

  const publicEndorsements = publicSource
    .filter(isPublicEndorsement)
    .filter(
      (item, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.mintId === item.mintId &&
            candidate.userId === item.userId,
        ) === index,
    );

  return {
    version: 2,
    privateAppreciations,
    publicEndorsements,
  };
}

function isBlocked(
  blocks: readonly UserBlock[],
  viewerId: string,
  otherId: string,
) {
  return blocks.some(
    (block) =>
      (block.blockerId === viewerId && block.blockedId === otherId) ||
      (block.blockerId === otherId && block.blockedId === viewerId),
  );
}

function isFriend(
  friendships: readonly Friendship[],
  viewerId: string,
  otherId: string,
) {
  return friendships.some(
    (friendship) =>
      friendship.status === "friends" &&
      ((friendship.requesterId === viewerId &&
        friendship.addresseeId === otherId) ||
        (friendship.requesterId === otherId &&
          friendship.addresseeId === viewerId)),
  );
}

function followSignals(
  follows: readonly Follow[],
  viewerId: string,
  otherId: string,
) {
  const viewerFollows = follows.some(
    (follow) =>
      follow.followerId === viewerId && follow.followingId === otherId,
  );
  const followedBy = follows.some(
    (follow) =>
      follow.followerId === otherId && follow.followingId === viewerId,
  );
  return { viewerFollows, followedBy };
}

export type PublicEndorsementContext = {
  userIds: string[];
  additionalCount: number;
};

export function getPublicEndorsementContext(input: {
  mintId: string;
  viewerId: string;
  endorsements: readonly MintPublicEndorsement[];
  friendships: readonly Friendship[];
  follows: readonly Follow[];
  blocks: readonly UserBlock[];
  eligibleUserIds: readonly string[];
  limit?: number;
}): PublicEndorsementContext {
  const eligible = new Set(input.eligibleUserIds);
  const scored = input.endorsements
    .filter(
      (item) =>
        item.mintId === input.mintId &&
        item.userId !== input.viewerId &&
        eligible.has(item.userId) &&
        !isBlocked(input.blocks, input.viewerId, item.userId),
    )
    .flatMap((item) => {
      const friend = isFriend(
        input.friendships,
        input.viewerId,
        item.userId,
      );
      const { viewerFollows, followedBy } = followSignals(
        input.follows,
        input.viewerId,
        item.userId,
      );
      if (!friend && !viewerFollows && !followedBy) return [];
      return [{
        ...item,
        relationScore:
          (friend ? 400 : 0) +
          (viewerFollows && followedBy ? 250 : 0) +
          (viewerFollows ? 120 : 0) +
          (followedBy ? 60 : 0),
      }];
    })
    .sort(
      (first, second) =>
        second.relationScore - first.relationScore ||
        new Date(first.createdAt).getTime() -
          new Date(second.createdAt).getTime() ||
        first.userId.localeCompare(second.userId),
    );
  const limit = Math.max(1, input.limit ?? 3);

  return {
    userIds: scored.slice(0, limit).map((item) => item.userId),
    additionalCount: Math.max(0, scored.length - limit),
  };
}

export function getCreatorAppreciationMetrics(input: {
  mintId: string;
  authorId: string;
  viewerId: string;
  privateAppreciations: readonly MintPrivateAppreciation[];
  publicEndorsements: readonly MintPublicEndorsement[];
  legacyAggregate?: number;
  viewCount: number;
  commentCount: number;
}) {
  if (input.authorId !== input.viewerId) return null;

  const knownPeople = new Set([
    ...input.privateAppreciations
      .filter((item) => item.mintId === input.mintId)
      .map((item) => item.userId),
    ...input.publicEndorsements
      .filter((item) => item.mintId === input.mintId)
      .map((item) => item.userId),
  ]);

  return {
    appreciationCount: Math.max(
      knownPeople.size,
      Math.max(0, input.legacyAggregate ?? 0),
    ),
    viewCount: Math.max(0, input.viewCount),
    commentCount: Math.max(0, input.commentCount),
  };
}

export function formatCompactCount(value: number) {
  const count = Math.max(0, Math.round(value));
  if (count < 1_000) return String(count);
  if (count < 1_000_000) {
    const compact = count / 1_000;
    return `${compact >= 10 ? Math.round(compact) : compact.toFixed(1).replace(/\.0$/, "")}K`;
  }
  const compact = count / 1_000_000;
  return `${compact >= 10 ? Math.round(compact) : compact.toFixed(1).replace(/\.0$/, "")}M`;
}

export type PublicMintMetric = {
  kind: "views" | "comments" | "attending" | "members";
  count: number;
  label: string;
};

export function resolvePublicMintMetrics(input: {
  viewCount: number;
  commentCount: number;
  attendingCount?: number | null;
  memberCount?: number | null;
}) {
  const metrics: PublicMintMetric[] = [
    {
      kind: "views",
      count: Math.max(0, input.viewCount),
      label: `${formatCompactCount(input.viewCount)} views`,
    },
    {
      kind: "comments",
      count: Math.max(0, input.commentCount),
      label: `${formatCompactCount(input.commentCount)} comments`,
    },
  ];

  if (typeof input.attendingCount === "number") {
    metrics.push({
      kind: "attending",
      count: Math.max(0, input.attendingCount),
      label: `${formatCompactCount(input.attendingCount)} attending`,
    });
  }
  if (typeof input.memberCount === "number") {
    metrics.push({
      kind: "members",
      count: Math.max(0, input.memberCount),
      label: `${formatCompactCount(input.memberCount)} members`,
    });
  }

  return metrics;
}

/** Ordinary-viewer presentation deliberately has no Like-total field. */
export function resolveViewerMintPresentation(input: {
  viewCount: number;
  commentCount: number;
  attendingCount?: number | null;
  memberCount?: number | null;
  publiclyEndorsed: boolean;
  friendEndorserIds: readonly string[];
}) {
  return {
    metrics: resolvePublicMintMetrics(input),
    publiclyEndorsed: input.publiclyEndorsed,
    friendEndorserIds: [...input.friendEndorserIds],
  };
}
