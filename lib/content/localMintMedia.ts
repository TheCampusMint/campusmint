import type {
  SocialContentType,
  SocialMedia,
} from "@/types/content";

export type LocalMintMediaSelection = {
  fileName: string;
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

/**
 * Converts locally selected development media to in-memory data URLs. This
 * keeps previews usable after the composer closes without pretending that an
 * upload has occurred or leaving object URLs behind to revoke later.
 */
export async function prepareLocalMintMedia(
  files: readonly File[],
): Promise<LocalMintMediaPreparation> {
  const prepared = await Promise.all(
    files.map(async (file, order) => {
      const type = getMintMediaType(file.type);
      if (!type) return { fileName: file.name, selection: null };

      try {
        const url = await readFileAsDataUrl(file);

        return {
          fileName: file.name,
          selection: {
            fileName: file.name,
            media: {
              id: `local-media-${globalThis.crypto.randomUUID()}`,
              type,
              url,
              thumbnailUrl: null,
              width: null,
              height: null,
              durationSeconds: null,
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
    rejectedFileNames: prepared.flatMap((item) =>
      item.selection ? [] : [item.fileName],
    ),
  };
}
