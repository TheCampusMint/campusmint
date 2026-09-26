export type NaturalMediaPresentation = {
  aspectRatio: number;
  width: string;
  naturalWidth: number | null;
  naturalHeight: number | null;
};

/** Keeps uploaded media at its own aspect ratio. Small source files retain an
 * intrinsic-width ceiling, while tall media is capped to the viewport so a
 * portrait upload does not turn the feed into a forced full-screen crop. */
export function resolveNaturalMediaPresentation(
  rawWidth: number | null | undefined,
  rawHeight: number | null | undefined,
): NaturalMediaPresentation {
  const naturalWidth = Number.isFinite(rawWidth) && (rawWidth ?? 0) > 0
    ? Math.round(rawWidth as number)
    : null;
  const naturalHeight = Number.isFinite(rawHeight) && (rawHeight ?? 0) > 0
    ? Math.round(rawHeight as number)
    : null;
  const aspectRatio = naturalWidth && naturalHeight
    ? naturalWidth / naturalHeight
    : 4 / 3;

  return {
    aspectRatio,
    width: naturalWidth && naturalWidth < 640
      ? `min(100%, ${naturalWidth}px)`
      : aspectRatio < 1
        ? `min(100%, calc(78dvh * ${aspectRatio}))`
        : "100%",
    naturalWidth,
    naturalHeight,
  };
}
