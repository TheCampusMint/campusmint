import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { mintMediaFormats, validateMintUploadFiles, type MintUploadObject } from "./mintUploadPolicy.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ticketLifetimeMs = 2 * 60 * 60 * 1000;
type UploadManifest = { version: 1; userId: string; requestId: string; expiresAt: number; files: MintUploadObject[] };

function signature(payload: string, secret: string) {
  // Domain separation keeps this capability distinct from any other use of the server secret.
  return createHmac("sha256", secret).update(`campusmint:media-upload:v1:${payload}`).digest();
}

/** This module is imported by the server route only. The secret never enters the returned manifest. */
export function createMintUploadTicket(userId: string, requestId: string, selected: unknown, secret: string, now = Date.now()) {
  if (!secret || !uuidPattern.test(userId) || !uuidPattern.test(requestId)) throw new Error("Invalid upload session.");
  const attemptId = randomUUID();
  const files = validateMintUploadFiles(selected).map((file, sortOrder) => ({
    ...file,
    sortOrder,
    storagePath: `${userId}/${requestId}/${attemptId}/${sortOrder}-${randomUUID()}.${mintMediaFormats.get(file.mimeType)!.extension}`,
  }));
  const manifest: UploadManifest = { version: 1, userId, requestId, expiresAt: now + ticketLifetimeMs, files };
  const payload = Buffer.from(JSON.stringify(manifest)).toString("base64url");
  return { ticket: `${payload}.${signature(payload, secret).toString("base64url")}`, files };
}

export function verifyMintUploadTicket(ticket: unknown, userId: string, requestId: string, secret: string, now = Date.now()): UploadManifest {
  const invalid = () => new Error("The media upload session expired or is invalid. Retry publishing to upload again.");
  if (!secret || typeof ticket !== "string" || ticket.length > 16_000) throw invalid();
  const [payload, encodedSignature, extra] = ticket.split(".");
  if (!payload || !encodedSignature || extra !== undefined) throw invalid();
  const receivedSignature = Buffer.from(encodedSignature, "base64url");
  const expectedSignature = signature(payload, secret);
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) throw invalid();
  let manifest: UploadManifest;
  try { manifest = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as UploadManifest; } catch { throw invalid(); }
  if (manifest.version !== 1 || manifest.userId !== userId || manifest.requestId !== requestId || !Number.isFinite(manifest.expiresAt) || manifest.expiresAt <= now) throw invalid();
  validateMintUploadFiles(manifest.files);
  const paths = new Set<string>();
  for (const [index, file] of manifest.files.entries()) {
    const parts = file.storagePath?.split("/");
    const extension = mintMediaFormats.get(file.mimeType)!.extension;
    if (parts?.length !== 4 || parts[0] !== userId || parts[1] !== requestId || !uuidPattern.test(parts[2]) || file.sortOrder !== index || paths.has(file.storagePath)) throw invalid();
    const basename = parts[3];
    if (!basename.startsWith(`${index}-`) || !basename.endsWith(`.${extension}`) || !uuidPattern.test(basename.slice(`${index}-`.length, -extension.length - 1))) throw invalid();
    paths.add(file.storagePath);
  }
  return manifest;
}
