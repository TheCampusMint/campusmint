/** Bound the actual stream, not just the caller-controlled Content-Length. */
export async function readBodyBytes(request: Request, maxBytes = 64 * 1024) {
  const announced = request.headers.get("content-length");
  if (announced && (!/^\d+$/.test(announced) || Number(announced) > maxBytes)) {
    throw new Error("Request too large.");
  }
  if (!request.body) throw new Error("Missing body.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Request too large.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export async function readJsonBody(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) throw new Error("Expected JSON.");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await readBodyBytes(request, maxBytes)));
}

export async function readSmallFormData(request: Request) {
  if (!/^multipart\/form-data\s*;/i.test(request.headers.get("content-type") ?? "")) throw new Error("Expected multipart data.");
  const bytes = await readBodyBytes(request, 4 * 1024 * 1024);
  return new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type")! }, body: bytes }).formData();
}

export async function readJsonObject(request: Request, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  const body = await readJsonBody(request, maxBytes);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected an object.");
  return body as Record<string, unknown>;
}
