import { launchPublishedMediaPolicy } from "./mediaPolicy.ts";

export const mintMediaFormats = new Map([
  ["image/jpeg", { type: "image" as const, extension: "jpg", maximum: launchPublishedMediaPolicy.maxImageBytes }],
  ["image/png", { type: "image" as const, extension: "png", maximum: launchPublishedMediaPolicy.maxImageBytes }],
  ["image/webp", { type: "image" as const, extension: "webp", maximum: launchPublishedMediaPolicy.maxImageBytes }],
  ["video/mp4", { type: "video" as const, extension: "mp4", maximum: launchPublishedMediaPolicy.maxVideoBytes }],
  ["video/webm", { type: "video" as const, extension: "webm", maximum: launchPublishedMediaPolicy.maxVideoBytes }],
]);

export type MintUploadFile = { mimeType: string; byteSize: number };
export type MintUploadObject = MintUploadFile & { storagePath: string; sortOrder: number };

/** Validate declared sizes before granting upload access; Storage is checked again before publication. */
export function validateMintUploadFiles(value: unknown): MintUploadFile[] {
  if (!Array.isArray(value) || value.length > launchPublishedMediaPolicy.maxItemsPerMint) {
    throw new Error(`Choose no more than ${launchPublishedMediaPolicy.maxItemsPerMint} media items.`);
  }
  let totalBytes = 0;
  const files = value.map((item): MintUploadFile => {
    const file = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const accepted = typeof file.mimeType === "string" ? mintMediaFormats.get(file.mimeType) : null;
    if (!accepted) throw new Error("A selected file uses an unsupported format.");
    if (typeof file.byteSize !== "number" || !Number.isSafeInteger(file.byteSize) || file.byteSize < 1 || file.byteSize > accepted.maximum) {
      throw new Error(`A selected file exceeds the ${accepted.type === "image" ? "12 MB image" : "100 MB video"} limit.`);
    }
    totalBytes += file.byteSize;
    return { mimeType: file.mimeType as string, byteSize: file.byteSize };
  });
  if (totalBytes > launchPublishedMediaPolicy.maxRequestBytes) throw new Error("The selected media exceeds the 150 MB total upload limit.");
  return files;
}

/** Reject renamed non-media files without downloading full videos into the application server. */
export function matchesMintMediaSignature(bytes: Uint8Array, mimeType: string) {
  const at = (offset: number, expected: number[]) => expected.every((byte, index) => bytes[offset + index] === byte);
  const text = (offset: number, value: string) => at(offset, Array.from(value, (character) => character.charCodeAt(0)));
  switch (mimeType) {
    case "image/jpeg": return at(0, [0xff, 0xd8, 0xff]);
    case "image/png": return at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp": return text(0, "RIFF") && text(8, "WEBP");
    case "video/mp4": return bytes.length >= 12 && text(4, "ftyp");
    case "video/webm": return at(0, [0x1a, 0x45, 0xdf, 0xa3]) && new TextDecoder().decode(bytes).includes("webm");
    default: return false;
  }
}

export function validateMintStoredObject(
  expected: MintUploadObject,
  actual: { size?: number; contentType?: string; name: string; bucketId: string },
  prefix: Uint8Array,
) {
  if (actual.bucketId !== "mint-media" || actual.name !== expected.storagePath || actual.size !== expected.byteSize || actual.contentType !== expected.mimeType) {
    throw new Error("The uploaded media does not match the selected file. Select it again and retry.");
  }
  validateMintUploadFiles([expected]);
  if (!matchesMintMediaSignature(prefix, expected.mimeType)) throw new Error("A selected file does not contain a supported photo or video.");
}
