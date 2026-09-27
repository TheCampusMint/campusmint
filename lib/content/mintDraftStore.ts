import type { LocalMintMediaSelection } from "./localMintMedia";
import type { MintDraft } from "./mintDrafts";

type StoredDraft = {
  key: string;
  userId: string;
  draft: MintDraft;
  media: LocalMintMediaSelection[];
};

// IndexedDB preserves File objects without base64 expansion or localStorage quotas.
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("campusmint-drafts", 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("drafts", { keyPath: "key" });
      store.createIndex("userId", "userId");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Close other Campus Mint tabs and try saving again."));
  });
}

async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", mode);
    const request = operation(tx.objectStore("drafts"));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error ?? new Error("Your draft could not be saved on this device.")); };
  });
}

export async function listStoredMintDrafts(userId: string): Promise<MintDraft[]> {
  const rows = await transaction<StoredDraft[]>("readonly", (store) => store.index("userId").getAll(userId));
  return rows.map((row) => row.draft).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function storeMintDraft(draft: MintDraft, media: readonly LocalMintMediaSelection[]) {
  await transaction("readwrite", (store) => store.put({
    key: `${draft.userId}:${draft.id}`, userId: draft.userId, draft,
    media: media.map((item) => ({ ...item, media: { ...item.media, url: null, thumbnailUrl: null } })),
  } satisfies StoredDraft));
}

export async function deleteStoredMintDraft(userId: string, draftId: string) {
  await transaction("readwrite", (store) => store.delete(`${userId}:${draftId}`));
}

export async function restoreMintDraftMedia(userId: string, draftId: string) {
  const row = await transaction<StoredDraft | undefined>("readonly", (store) => store.get(`${userId}:${draftId}`));
  if (!row || row.userId !== userId) return [];
  return row.media.map((item) => ({ ...item, media: { ...item.media, url: URL.createObjectURL(item.file) } }));
}
