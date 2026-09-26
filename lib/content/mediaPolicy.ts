export type PublishedMediaPolicy = {
  maxItemsPerMint: number;
  maxImageBytes: number;
  maxVideoBytes: number;
  maxRequestBytes: number;
  maxImageDimension: number;
};

export type MediaStorageEntitlement = {
  source: "launch_free" | "server_entitlement";
  published: PublishedMediaPolicy;
  originalArchiveBytes: number;
  retainOriginalUploads: boolean;
};

/**
 * Launch limits are shared by the browser preparation path and the server,
 * where they are authoritatively enforced. A future paid entitlement must be
 * returned by the server and must still provide finite limits.
 */
export const launchPublishedMediaPolicy: PublishedMediaPolicy = {
  maxItemsPerMint: 6,
  maxImageBytes: 12 * 1024 * 1024,
  maxVideoBytes: 100 * 1024 * 1024,
  maxRequestBytes: 150 * 1024 * 1024,
  maxImageDimension: 2048,
};

export const launchFreeMediaEntitlement: MediaStorageEntitlement = {
  source: "launch_free",
  published: launchPublishedMediaPolicy,
  originalArchiveBytes: 0,
  retainOriginalUploads: false,
};

/** Photo preparation quality is an opt-in preference, independent of storage limits. */
export function getPhotoUploadQuality(highQualityUploads = false) {
  return highQualityUploads
    ? { maxDimension: 3840, compressionQuality: 0.94 }
    : { maxDimension: launchPublishedMediaPolicy.maxImageDimension, compressionQuality: 0.86 };
}

/** Fit the longest edge without cropping, stretching, or enlarging small sources. */
export function fitUploadDimensions(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
