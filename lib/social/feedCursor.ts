import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type FeedPosition = { createdAt: string; id: string };
const valid = (value: FeedPosition) => typeof value?.createdAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value.createdAt)
  && Number.isFinite(Date.parse(value.createdAt)) && typeof value.id === "string" && /^[0-9a-f-]{36}$/i.test(value.id);
function key(secret: string) {
  if (!secret) throw new Error("Feed cursor configuration missing");
  return createHash("sha256").update("campusmint:feed-cursor:v1\0").update(secret).digest();
}
// A scan may end on a private row. Encrypt its position so pagination reveals
// neither that row's ID nor timestamp. The cursor grants no content access.
export function encodeFeedCursor(position: FeedPosition, scope: string, secret: string, now = Date.now()) {
  if (!valid(position)) throw new Error("Invalid feed position");
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(scope));
  const bytes = Buffer.concat([cipher.update(JSON.stringify({ ...position, expires: now + 24 * 60 * 60 * 1000 })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64url");
}
export function decodeFeedCursor(token: string, scope: string, secret: string, now = Date.now()): FeedPosition {
  if (!/^[A-Za-z0-9_-]{40,600}$/.test(token)) throw new Error("Invalid feed cursor");
  const data = Buffer.from(token, "base64url"), decipher = createDecipheriv("aes-256-gcm", key(secret), data.subarray(0,12));
  decipher.setAAD(Buffer.from(scope)); decipher.setAuthTag(data.subarray(12,28));
  const value = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString());
  if (!valid(value) || !Number.isFinite(value.expires) || value.expires <= now) throw new Error("Expired feed cursor");
  return { createdAt: value.createdAt, id: value.id };
}
