/** Whitespace and invisible formatting alone never advance the composer. */
export function hasComposerText(value: string) {
  return /[^\s\u200B-\u200D\u2060\uFEFF]/u.test(value);
}

export function composerProgress(hasContent: boolean, privacyChosen: boolean, durationChosen: boolean) {
  return !hasContent ? 0 : !privacyChosen ? 1 : !durationChosen ? 2 : 3;
}
