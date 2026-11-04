/**
 * Offline write outbox. When the device is offline, mutations are stored in
 * IndexedDB and replayed (in order) once connectivity returns. Reads continue to
 * work via the service worker's API cache, so the app stays usable offline.
 */
const DB_NAME = 'xmarthotel-offline';
const STORE = 'outbox';
const DB_VERSION = 1;

export class OfflineQueuedError extends Error {
  constructor() {
    super('queued-offline');
    this.name = 'OfflineQueuedError';
  }
}

export interface QueuedRequest {
  id?: number;
  method: 'post' | 'patch';
  url: string;
  body: unknown;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(req: QueuedRequest): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(req);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function allQueued(): Promise<QueuedRequest[]> {
  const db = await openDb();
  const items = await new Promise<QueuedRequest[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).getAll();
    r.onsuccess = () => resolve(r.result as QueuedRequest[]);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return items;
}

export async function removeQueued(id: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function queuedCount(): Promise<number> {
  try {
    return (await allQueued()).length;
  } catch {
    return 0;
  }
}
