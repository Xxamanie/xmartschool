import axios from 'axios';
import { enqueue, allQueued, removeQueued, OfflineQueuedError } from './offline';

const TOKEN_KEY = 'xmarthotel.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({ baseURL: '/api' });

// Attach JWT to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, drop the token so the app falls back to login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) tokenStore.clear();
    return Promise.reject(err);
  },
);

/** ApiResponse envelope: { ok, data, message }. */
export type ApiResponse<T> = { ok: boolean; data: T; message?: string };

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
const isNetworkError = (err: unknown) => axios.isAxiosError(err) && !err.response;

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  // Reads still resolve offline via the service worker's API cache.
  const { data } = await api.get<ApiResponse<T>>(url, { params });
  return data.data;
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  if (isOffline()) {
    await enqueue({ method: 'post', url, body, createdAt: Date.now() });
    throw new OfflineQueuedError();
  }
  try {
    const { data } = await api.post<ApiResponse<T>>(url, body);
    return data.data;
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueue({ method: 'post', url, body, createdAt: Date.now() });
      throw new OfflineQueuedError();
    }
    throw err;
  }
}

export async function patch<T>(url: string, body?: unknown): Promise<T> {
  if (isOffline()) {
    await enqueue({ method: 'patch', url, body, createdAt: Date.now() });
    throw new OfflineQueuedError();
  }
  try {
    const { data } = await api.patch<ApiResponse<T>>(url, body);
    return data.data;
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueue({ method: 'patch', url, body, createdAt: Date.now() });
      throw new OfflineQueuedError();
    }
    throw err;
  }
}

/** Replay queued offline mutations in order. Stops if still offline. */
export async function replayOutbox(): Promise<number> {
  const items = await allQueued();
  let done = 0;
  for (const it of items) {
    try {
      await api.request({ method: it.method, url: it.url, data: it.body });
      if (it.id != null) await removeQueued(it.id);
      done++;
    } catch (e) {
      if (isNetworkError(e)) break; // still offline — try again later
      if (it.id != null) await removeQueued(it.id); // server rejected — drop, don't loop forever
    }
  }
  return done;
}

/** Pull a human-readable message out of an error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof OfflineQueuedError) return 'Saved offline — it will sync when you reconnect.';
  if (axios.isAxiosError(err)) return err.response?.data?.message ?? err.message ?? fallback;
  return fallback;
}
