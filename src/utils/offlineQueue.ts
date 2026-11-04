import { getApiSession } from './sessionState';

export type QueuedOperation = { id: string; method: 'post' | 'put'; url: string; data: unknown; label: string; ts: number; error?: string };
const PREFIX = 'xss_offline_queue_v2:';
const keyFor = (userId?: string, schoolId?: string) => userId && schoolId ? PREFIX + encodeURIComponent(userId) + ':' + encodeURIComponent(schoolId) : null;
const key = () => { const s = getApiSession(); return keyFor(s.userId, s.schoolId); };
const load = (storageKey = key()): QueuedOperation[] => {
  if (!storageKey) return [];
  try { const value = JSON.parse(localStorage.getItem(storageKey) || '[]'); return Array.isArray(value) ? value.filter(op => op && typeof op.id === 'string' && ['post', 'put'].includes(op.method) && typeof op.url === 'string') : []; }
  catch { return []; }
};
const persist = (storageKey: string, operations: QueuedOperation[]) => {
  localStorage.setItem(storageKey, JSON.stringify(operations));
  window.dispatchEvent(new Event('xss-queue-changed'));
};
export const queuedCount = () => load().length;
export const queuedError = () => load().find(op => op.error)?.error;
export const enqueue = (operation: { method: 'post' | 'put'; url: string; data: unknown; label: string }) => {
  const storageKey = key();
  if (!storageKey) throw new Error('Sign in and select a school before saving offline.');
  // Only overwrite/upsert endpoints can safely replay an ambiguous network result.
  if (!(operation.method === 'post' && operation.url === '/attendance/batch') && !(operation.method === 'put' && operation.url === '/assessments')) throw new Error('This operation requires an online connection.');
  persist(storageKey, [...load(storageKey), { ...operation, id: crypto.randomUUID(), ts: Date.now() }]);
};
const running = new Set<string>();
export const flushQueue = async (): Promise<{ flushed: number; remaining: number; error?: string }> => {
  const scope = getApiSession();
  const storageKey = keyFor(scope.userId, scope.schoolId);
  if (!storageKey || running.has(storageKey)) return { flushed: 0, remaining: queuedCount() };
  running.add(storageKey);
  let flushed = 0;
  try {
    const { default: client } = await import('./api');
    for (const operation of load(storageKey)) {
      if (getApiSession().generation !== scope.generation) break;
      try {
        const result = await client.request({
          method: operation.method, url: operation.url, data: operation.data,
          headers: { 'Idempotency-Key': operation.id },
          ...{ __expectedSessionGeneration: scope.generation },
        });
        if (result.data?.ok === false) throw new Error(result.data.message || 'The server rejected this change.');
        // Remove only this ID from the current queue; preserve concurrent enqueues.
        persist(storageKey, load(storageKey).filter(op => op.id !== operation.id));
        flushed++;
      } catch (error: any) {
        const message = error.response?.data?.message || error.message || 'Could not sync this change.';
        persist(storageKey, load(storageKey).map(op => op.id === operation.id ? { ...op, error: message } : op));
        break;
      }
    }
    return { flushed, remaining: load(storageKey).length, error: load(storageKey).find(op => op.error)?.error };
  } finally { running.delete(storageKey); }
};
if (typeof window !== 'undefined') {
  const sync = () => { if (navigator.onLine && getApiSession().userId) void flushQueue(); };
  window.addEventListener('online', sync);
  window.addEventListener('xss-session-changed', () => { window.dispatchEvent(new Event('xss-queue-changed')); setTimeout(sync, 0); });
}

