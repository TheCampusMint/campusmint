import assert from "node:assert/strict";
import test from "node:test";
import { defaultAppPreferences } from "../hooks/useAppPreferences.ts";
import { fitUploadDimensions, getPhotoUploadQuality } from "../lib/content/mediaPolicy.ts";
import { prepareLocalMintMedia } from "../lib/content/localMintMedia.ts";

test("higher upload quality is off by default and only opt-in changes photo quality", () => {
  assert.equal(defaultAppPreferences.content.highQualityUploads, false);
  assert.deepEqual(getPhotoUploadQuality(), { maxDimension: 2048, compressionQuality: 0.86 });
  assert.deepEqual(getPhotoUploadQuality(true), { maxDimension: 3840, compressionQuality: 0.94 });
});

test("both qualities preserve landscape, portrait, square, and panoramic shapes without enlarging", () => {
  for (const highQuality of [false, true]) {
    const { maxDimension } = getPhotoUploadQuality(highQuality);
    for (const [width, height] of [[7680, 4320], [4320, 7680], [5000, 5000], [12000, 1000], [320, 240]]) {
      const result = fitUploadDimensions(width, height, maxDimension);
      assert.ok(result.width <= width && result.height <= height);
      assert.ok(Math.max(result.width, result.height) <= maxDimension);
      // Rounding to whole pixels can change the ratio by at most one target pixel.
      assert.ok(Math.abs(result.height - result.width * height / width) <= 1);
    }
  }
  assert.deepEqual(fitUploadDimensions(7680, 4320, 3840), { width: 3840, height: 2160 });
  assert.deepEqual(fitUploadDimensions(4320, 7680, 3840), { width: 2160, height: 3840 });
  assert.deepEqual(fitUploadDimensions(320, 240, 3840), { width: 320, height: 240 });
});

function mockBrowser(t, { width = 7680, height = 4320, failEncode = false, outputSize = 4 } = {}) {
  let encoded;
  t.mock.method(globalThis, "createImageBitmap", async () => ({ width, height, close() {} }));
  t.mock.method(globalThis.document, "createElement", () => {
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ drawImage() {} }),
      toBlob(callback, mimeType, quality) {
        encoded = { width: canvas.width, height: canvas.height, quality };
        callback(failEncode ? null : new Blob([new Uint8Array(outputSize)], { type: mimeType }));
      },
    };
    return canvas;
  });
  return () => encoded;
}

// Browser API fakes exercise the complete image preparation path without publishing.
globalThis.createImageBitmap = async () => {};
globalThis.document = { createElement() {} };
globalThis.FileReader = class {
  addEventListener(type, fn) { if (type === "load") this.onLoad = fn; }
  readAsDataURL() { this.result = "data:image/webp;base64,AA=="; this.onLoad(); }
};

for (const highQuality of [false, true]) {
  test(`photo preparation encodes the actual chosen size, high quality=${highQuality}`, async (t) => {
    const encoded = mockBrowser(t);
    const file = new File([new Uint8Array(16)], "landscape.jpg", { type: "image/jpeg" });
    const result = await prepareLocalMintMedia([file], highQuality);
    const expected = highQuality ? { width: 3840, height: 2160, quality: 0.94 } : { width: 2048, height: 1152, quality: 0.86 };
    assert.deepEqual(encoded(), expected);
    assert.equal(result.accepted[0].media.width, expected.width);
    assert.equal(result.accepted[0].media.height, expected.height);
    assert.equal(result.accepted[0].file.type, "image/webp");
  });
}

test("failed image encoding retains original bytes with original dimensions", async (t) => {
  mockBrowser(t, { failEncode: true });
  const file = new File(["original"], "photo.jpg", { type: "image/jpeg" });
  const { accepted } = await prepareLocalMintMedia([file]);
  assert.equal(accepted[0].file, file);
  assert.equal(accepted[0].media.width, 7680);
  assert.equal(accepted[0].media.height, 4320);
});

test("required resizing wins even when a tiny source file encodes larger", async (t) => {
  mockBrowser(t, { outputSize: 32 });
  const file = new File(["small"], "photo.jpg", { type: "image/jpeg" });
  const { accepted } = await prepareLocalMintMedia([file]);
  assert.notEqual(accepted[0].file, file);
  assert.equal(accepted[0].media.width, 2048);
});

test("4K videos retain their bytes and dimensions in both preference modes", async (t) => {
  t.mock.method(globalThis.document, "createElement", () => {
    let loaded;
    return {
      videoWidth: 3840, videoHeight: 2160, duration: 3,
      addEventListener(type, fn) { if (type === "loadedmetadata") loaded = fn; },
      set src(value) { void value; loaded(); },
    };
  });
  const file = new File(["video"], "video.mp4", { type: "video/mp4" });
  for (const enabled of [false, true]) {
    const { accepted } = await prepareLocalMintMedia([file], enabled);
    assert.equal(accepted[0].file, file);
    assert.equal(accepted[0].media.width, 3840);
    assert.equal(accepted[0].media.height, 2160);
  }
});
