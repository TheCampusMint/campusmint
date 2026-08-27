import type { Mint } from "../../types/mint.ts";

export type EditableMintPatch = Partial<
  Pick<Mint, "caption" | "likesVisible" | "commentsEnabled">
>;

export function applyEditableMintPatch(
  mint: Mint,
  patch: EditableMintPatch,
  updatedAt: string,
): Mint | null {
  const next: EditableMintPatch = {};

  if (typeof patch.caption === "string") {
    next.caption = patch.caption;
  }

  if (typeof patch.likesVisible === "boolean") {
    next.likesVisible = patch.likesVisible;
  }

  if (typeof patch.commentsEnabled === "boolean") {
    next.commentsEnabled = patch.commentsEnabled;
  }

  if (Object.keys(next).length === 0) return null;

  return {
    ...mint,
    ...next,
    updatedAt,
  };
}
