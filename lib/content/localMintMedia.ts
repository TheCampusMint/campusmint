import type {
  SocialContentType,
  SocialMedia,
} from "@/types/content";
import { fitUploadDimensions, getPhotoUploadQuality, launchPublishedMediaPolicy } from "./mediaPolicy.ts";

export type LocalMintMediaSelection = {
  fileName: string;
  file: File;
  media: SocialMedia;
};

export type LocalMintMediaPreparation = {
  accepted: LocalMintMediaSelection[];
  rejectedFileNames: string[];
};

export function getMintMediaType(
  mimeType: string,
): SocialMedia["type"] | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

export const MAX_MINT_MEDIA_ITEMS = launchPublishedMediaPolicy.maxItemsPerMint;
export const MAX_MINT_IMAGE_BYTES = launchPublishedMediaPolicy.maxImageBytes;
export const MAX_MINT_VIDEO_BYTES = launchPublishedMediaPolicy.maxVideoBytes;
export const MAX_MINT_IMAGE_DIMENSION = launchPublishedMediaPolicy.maxImageDimension;

const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const supportedVideoTypes = new Set(["video/mp4", "video/webm"]);

function validFileSize(file: File, type: SocialMedia["type"]) {
  const maximum = type === "image" ? MAX_MINT_IMAGE_BYTES : MAX_MINT_VIDEO_BYTES;
  return file.size > 0 && file.size <= maximum;
}

async function optimizeImage(file: File, highQualityUploads: boolean) {
  if (!supportedImageTypes.has(file.type) || typeof createImageBitmap !== "function") {
    return { file, width: null, height: null };
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const original = { file, width: bitmap.width, height: bitmap.height };
  const quality = getPhotoUploadQuality(highQualityUploads);
  const { width, height } = fitUploadDimensions(bitmap.width, bitmap.height, quality.maxDimension);
  const resized = width !== bitmap.width || height !== bitmap.height;
  if (!resized && file.type === "image/webp") {
    bitmap.close();
    return { file, width, height };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return original;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality.compressionQuality));
  // Fallback metadata must describe the file we actually keep.
  if (!blob || (!resized && blob.size >= file.size)) return original;
  const optimizedName = file.name.replace(/\.[^.]+$/, "") || "mint-photo";
  return {
    file: new File([blob], `${optimizedName}.webp`, { type: "image/webp", lastModified: file.lastModified }),
    width,
    height,
  };
}

export function getMintContentType(
  media: readonly Pick<SocialMedia, "type">[],
): SocialContentType {
  if (media.length === 0) return "text";
  if (media.length > 1) return "carousel";
  return media[0]?.type ?? "text";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error(`Could not preview ${file.name}.`));
    });

    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error(`Could not preview ${file.name}.`));
    });

    reader.readAsDataURL(file);
  });
}

function readVideoMetadata(file: File) {
  return new Promise<{ width: number | null; height: number | null; durationSeconds: number | null }>((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const finish = (value: { width: number | null; height: number | null; durationSeconds: number | null }) => {
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };
    video.preload = "metadata";
    video.addEventListener("loadedmetadata", () => finish({
      width: video.videoWidth > 0 ? video.videoWidth : null,
      height: video.videoHeight > 0 ? video.videoHeight : null,
      durationSeconds: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null,
    }), { once: true });
    video.addEventListener("error", () => finish({ width: null, height: null, durationSeconds: null }), { once: true });
    video.src = objectUrl;
  });
}

/**
 * Validates and prepares selected media for both an in-memory preview and the
 * later authenticated upload. The preview is not treated as publish success.
 */
export async function prepareLocalMintMedia(
  files: readonly File[],
  highQualityUploads = false,
): Promise<LocalMintMediaPreparation> {
  const prepared = await Promise.all(
    files.slice(0, MAX_MINT_MEDIA_ITEMS).map(async (file, order) => {
      const type = getMintMediaType(file.type);
      const supported = type === "image"
        ? supportedImageTypes.has(file.type)
        : type === "video"
          ? supportedVideoTypes.has(file.type)
          : false;
      if (!type || !supported || !validFileSize(file, type)) {
        return { fileName: file.name, selection: null };
      }

      try {
        const videoMetadata = type === "video"
          ? await readVideoMetadata(file)
          : { width: null, height: null, durationSeconds: null };
        const optimized = type === "image"
          ? await optimizeImage(file, highQualityUploads)
          : { file, width: videoMetadata.width, height: videoMetadata.height };
        if (!validFileSize(optimized.file, type)) return { fileName: file.name, selection: null };
        const url = await readFileAsDataUrl(optimized.file);

        return {
          fileName: file.name,
          selection: {
            fileName: file.name,
            file: optimized.file,
            media: {
              id: `local-media-${globalThis.crypto.randomUUID()}`,
              type,
              url,
              thumbnailUrl: null,
              width: optimized.width,
              height: optimized.height,
              durationSeconds: videoMetadata.durationSeconds,
              order,
              isDevelopmentPlaceholder: false,
            },
          } satisfies LocalMintMediaSelection,
        };
      } catch {
        return { fileName: file.name, selection: null };
      }
    }),
  );

  const accepted = prepared.flatMap((item) =>
    item.selection ? [item.selection] : [],
  );

  return {
    accepted: accepted.map((item, order) => ({
      ...item,
      media: { ...item.media, order },
    })),
    rejectedFileNames: [
      ...prepared.flatMap((item) => item.selection ? [] : [item.fileName]),
      ...files.slice(MAX_MINT_MEDIA_ITEMS).map((file) => file.name),
    ],
  };
}
