export function normalizeHashtag(value: string) {
  return value.trim().replace(/^#+/, "").toLocaleLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function parseHashtags(input: string) {
  return Array.from(new Set(
    input.split(/[\s,]+/).map(normalizeHashtag).filter(Boolean),
  ));
}

export function extractHashtagsFromCaption(caption: string) {
  return Array.from(
    new Set(
      Array.from(caption.matchAll(/(?:^|\s)#([a-z0-9_]+)/gi))
        .map((match) => normalizeHashtag(match[1]))
        .filter(Boolean),
    ),
  );
}
