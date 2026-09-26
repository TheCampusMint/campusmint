import type { Mint } from "@/types/mint";
import type { CampusMintUser } from "@/types/profile";

export type PersistedMintAuthor = CampusMintUser;

export type MintPublishSuccess = {
  ok: true;
  mint: Mint;
  author: PersistedMintAuthor;
  deduplicated: boolean;
};

export type MintPublishFailure = {
  ok: false;
  message: string;
  retryable: boolean;
};

export type MintPublishResponse = MintPublishSuccess | MintPublishFailure;

export type MintFeedResponse =
  | {
      ok: true;
      mintz: Mint[];
      authors: PersistedMintAuthor[];
    }
  | {
      ok: false;
      message: string;
    };
