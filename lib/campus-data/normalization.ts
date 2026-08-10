export function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[<>\u0000-\u001f\u007f]/g, " ")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function sanitizeSubmission(value: string, maximumLength = 120) {
  return value
    .normalize("NFKC")
    .replace(/[<>\u0000-\u001f\u007f]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximumLength);
}

export function normalizeSubmissionDisplay(value: string) {
  const sanitized = sanitizeSubmission(value);
  if (/^[a-z]{2,6}\s*-?\s*\d/i.test(sanitized)) {
    return sanitized.replace(/^[a-z]{2,6}/i, (prefix) => prefix.toLocaleUpperCase());
  }
  if (sanitized === sanitized.toLocaleLowerCase() || sanitized === sanitized.toLocaleUpperCase()) {
    return sanitized.toLocaleLowerCase().replace(/\b[a-z]/g, (letter) => letter.toLocaleUpperCase());
  }
  return sanitized;
}

export function searchScore(query: string, values: string[]) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 1;

  return values.reduce((best, value) => {
    const normalizedValue = normalizeSearchText(value);
    if (normalizedValue === normalizedQuery) return Math.max(best, 100);
    if (normalizedValue.startsWith(normalizedQuery)) return Math.max(best, 80);
    if (normalizedValue.includes(normalizedQuery)) return Math.max(best, 60);
    const queryTerms = normalizedQuery.split(" ");
    const matches = queryTerms.filter((term) => normalizedValue.includes(term)).length;
    return Math.max(best, matches === queryTerms.length ? 40 + matches : 0);
  }, 0);
}
