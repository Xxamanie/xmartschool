/**
 * Offline write-queue. When a write fails because the device is offline, the
 * operation is stored in localStorage and replayed automatically on reconnect.
 * Used for the no-signal classroom case (attendance, score entry).
 */
const KEY = 'xss_offline_queue';

type Op = { id: string; method: 'post' | 'put'; url: string; data: any; label: string; ts: number };

const load = (): Op[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};
const persist = (ops: Op[]) => {
  localStorage.setItem(KEY, JSON.stringify(ops));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('xss-queue-changed'));
};

export const queuedCount = (): number => load().length;

export const enqueue = (op: { method: 'post' | 'put'; url: string; data: any; label: string }) => {
  const ops = load();
  ops.push({ ...op, id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, ts: Date.now() });
  persist(ops);
};

let flushing = false;

export const flushQueue = async (): Promise<{ flushed: number; remaining: number }> => {
  if (flushing) return { flushed: 0, remaining: queuedCount() };
  flushing = true;
  let flushed = 0;
  try {
    const { default: apiClient } = await import('./api');
    let ops = load();
    for (const op of [...ops]) {
      try {
        await (apiClient as any)[op.method](op.url, op.data);
        ops = ops.filter((o) => o.id !== op.id);
        persist(ops);
        flushed++;
      } catch (err: any) {
        if (err?.response) {
          // Server rejected it (4xx/5xx) — drop so the queue doesn't stall forever.
          ops = ops.filter((o) => o.id !== op.id);
          persist(ops);
          continue;
        }
        // Still offline / network error — stop and try again on next reconnect.
        break;
      }
    }
    return { flushed, remaining: ops.length };
  } finally {
    flushing = false;
  }
};

// Auto-flush whenever the browser comes back online.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue(); });
}
