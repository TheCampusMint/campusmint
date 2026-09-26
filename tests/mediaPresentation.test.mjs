import assert from "node:assert/strict";
import test from "node:test";

import { resolveNaturalMediaPresentation } from "../lib/content/mediaPresentation.ts";

test("portrait, landscape, and tiny media preserve their natural presentation", () => {
  const portrait = resolveNaturalMediaPresentation(1080, 1920);
  assert.equal(portrait.aspectRatio, 1080 / 1920);
  assert.match(portrait.width, /78dvh/);

  const landscape = resolveNaturalMediaPresentation(1920, 1080);
  assert.equal(landscape.aspectRatio, 1920 / 1080);
  assert.equal(landscape.width, "100%");

  const tiny = resolveNaturalMediaPresentation(320, 240);
  assert.equal(tiny.width, "min(100%, 320px)");
  assert.equal(tiny.aspectRatio, 4 / 3);
});

test("unknown media dimensions use a stable non-cropping fallback", () => {
  assert.deepEqual(resolveNaturalMediaPresentation(null, undefined), {
    aspectRatio: 4 / 3,
    width: "100%",
    naturalWidth: null,
    naturalHeight: null,
  });
});
