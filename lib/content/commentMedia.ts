import type { CommentAttachment } from "../../types/mint.ts";

export const COMMENT_VIDEO_MAX_SECONDS = 10;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error(`Could not read ${file.name}.`));
    });
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error(`Could not read ${file.name}.`)),
    );
    reader.readAsDataURL(file);
  });
}

function readVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    video.preload = "metadata";
    video.addEventListener("loadedmetadata", () => {
      const duration = video.duration;
      cleanup();
      if (Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error("Could not read video duration."));
    });
    video.addEventListener("error", () => {
      cleanup();
      reject(new Error("Could not read video duration."));
    });
    video.src = objectUrl;
  });
}

export async function prepareLocalCommentAttachment(
  file: File,
): Promise<CommentAttachment> {
  if (file.type.startsWith("video/")) {
    const durationSeconds = await readVideoDuration(file);
    const validation = validateCommentAttachment({
      type: "video",
      url: "https://local.invalid/pending-video",
      thumbnailUrl: null,
      durationSeconds,
    });
    if (!validation.valid) throw new Error(validation.error);
    return {
      type: "video",
      url: await readFileAsDataUrl(file),
      thumbnailUrl: null,
      durationSeconds,
    };
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image, GIF, or video file.");
  }

  return {
    type: file.type === "image/gif" ? "gif" : "image",
    url: await readFileAsDataUrl(file),
    alt: file.name,
  };
}

export function validateCommentAttachment(attachment: CommentAttachment | null) {
  if (!attachment) return { valid: true, error: null } as const;
  if (
    attachment.type === "video" &&
    (attachment.durationSeconds <= 0 ||
      attachment.durationSeconds > COMMENT_VIDEO_MAX_SECONDS)
  ) {
    return {
      valid: false,
      error: `Comment videos must be ${COMMENT_VIDEO_MAX_SECONDS} seconds or shorter.`,
    } as const;
  }

  if (attachment.type !== "sticker") {
    try {
      const url = new URL(attachment.url);
      const safeDataUrl =
        url.protocol === "data:" &&
        ((attachment.type === "video" && attachment.url.startsWith("data:video/")) ||
          ((attachment.type === "image" || attachment.type === "gif") &&
            attachment.url.startsWith("data:image/")));
      if (url.protocol !== "http:" && url.protocol !== "https:" && !safeDataUrl) {
        throw new Error("unsupported protocol");
      }
    } catch {
      return { valid: false, error: "Enter a valid attachment URL." } as const;
    }
  }

  return { valid: true, error: null } as const;
}

export function isEmojiOnlyComment(value: string) {
  const text = value.trim();
  return Boolean(
    text &&
      /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\u200D|\s)+$/u.test(
        text,
      ),
  );
}
