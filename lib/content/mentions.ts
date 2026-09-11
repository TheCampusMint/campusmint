import { normalizeUsername } from "../social/usernames.ts";
import type { ContentMention } from "../../types/content.ts";
import type { CampusMintUser } from "../../types/profile.ts";

export function extractMentionsFromCaption(
  caption: string,
  users: readonly CampusMintUser[],
): ContentMention[] {
  const usernames = Array.from(
    new Set(
      Array.from(caption.matchAll(/(?:^|\s)@([a-z0-9._]+)/gi))
        .map((match) => normalizeUsername(match[1]))
        .filter(Boolean),
    ),
  );

  return usernames.flatMap((username) => {
    const user = users.find(
      (candidate) => candidate.profile.usernameNormalized === username,
    );
    return user ? [{ userId: user.account.id, username }] : [];
  });
}

export function getActiveMentionQuery(caption: string, caret: number) {
  const beforeCaret = caption.slice(0, caret);
  const match = beforeCaret.match(/(?:^|\s)@([a-z0-9._]*)$/i);
  return match ? normalizeUsername(match[1]) : null;
}

export function insertMentionAtCaret(
  caption: string,
  caret: number,
  username: string,
) {
  const beforeCaret = caption.slice(0, caret);
  const match = beforeCaret.match(/(?:^|\s)@[a-z0-9._]*$/i);
  if (!match || match.index === undefined) return caption;
  const leadingSpace = match[0].startsWith(" ") ? " " : "";
  return `${caption.slice(0, match.index)}${leadingSpace}@${username} ${caption.slice(caret)}`;
}
