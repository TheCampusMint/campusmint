import type { MintPublishResponse } from "@/types/mintPersistence";

type SignedUpload = { storagePath: string; token: string; sortOrder: number };
type PreparedResponse = { ok: true; upload: { ticket: string; files: SignedUpload[] } };
type UploadFile = (destination: SignedUpload, file: File) => Promise<{ error: { message: string } | null }>;

/** Only metadata goes through the app host; media bytes go straight to private Supabase Storage. */
export async function publishMint(
  payload: Record<string, unknown>,
  files: readonly File[],
  uploadFile: UploadFile,
  request: typeof fetch = fetch,
): Promise<MintPublishResponse> {
  const send = async (body: unknown) => {
    const response = await request("/api/mintz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => null) as PreparedResponse | MintPublishResponse | null;
    if (!response.ok || !result?.ok) {
      return result && !result.ok ? result : { ok: false as const, message: "We couldn't publish your Mint. Your draft is still here—try again.", retryable: true };
    }
    return result;
  };

  let uploadTicket: string | undefined;
  if (files.length > 0) {
    const prepared = await send({
      action: "prepare",
      payload,
      files: files.map((file) => ({ mimeType: file.type, byteSize: file.size })),
    });
    // A successful retry may already have a published Mint; never upload duplicate copies.
    if (!prepared.ok || !("upload" in prepared)) return prepared;
    if (prepared.upload.files.length !== files.length) throw new Error("The upload session is incomplete. Retry publishing.");
    uploadTicket = prepared.upload.ticket;
    for (const [index, file] of files.entries()) {
      const destination = prepared.upload.files[index];
      if (destination.sortOrder !== index) throw new Error("The upload session is invalid. Retry publishing.");
      const { error } = await uploadFile(destination, file);
      if (error) return { ok: false, message: `We couldn't upload ${file.name || "your media"}. Your draft is still here—try again.`, retryable: true };
    }
  }
  const result = await send({ action: "publish", payload, uploadTicket });
  if (result.ok && "upload" in result) throw new Error("Publishing did not finish. Retry publishing.");
  return result;
}
