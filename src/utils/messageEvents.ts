import { AxiosError } from 'axios';
import apiClient from './api';

export type MessageEvent = { type: 'staff-message' | 'private-message'; conversationId?: string };
type MessageScope = { userId: string; schoolId?: string | null; role: string; contextSchoolId?: string | null };
type Listener = (event: MessageEvent) => void;
type Connection = { controller: AbortController; listeners: Set<Listener>; ready: boolean };
const connections = new Map<string, Connection>();

const notify = (connection: Connection, event: MessageEvent, listener?: Listener) => {
  if (connection.controller.signal.aborted) return;
  const targets = listener ? [listener] : [...connection.listeners];
  for (const target of targets) {
    if (!connection.listeners.has(target)) continue;
    try { target(event); } catch { /* One view must not interrupt the shared stream. */ }
  }
};

const invalidate = (connection: Connection, listener?: Listener) => {
  notify(connection, { type: 'staff-message' }, listener);
  notify(connection, { type: 'private-message' }, listener);
};

const retryDelay = (signal: AbortSignal) => new Promise<void>(resolve => {
  if (signal.aborted) { resolve(); return; }
  const timer = setTimeout(done, 3000);
  function done() { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); }
  signal.addEventListener('abort', done, { once: true });
});

// The Axios interceptor supplies the current Bearer token to fetch; it never enters the URL.
async function connect(connection: Connection) {
  const signal = connection.controller.signal;
  while (!signal.aborted) {
    connection.ready = false;
    try {
      await apiClient.get('/events/stream', {
        signal,
        timeout: 0,
        adapter: async request => {
          if (signal.aborted) throw new AxiosError('Event stream cancelled', AxiosError.ERR_CANCELED, request);
          const result = await fetch(apiClient.getUri(request), {
            headers: request.headers.toJSON() as Record<string, string>, signal,
          });
          if (!result.ok || !result.body) {
            throw new AxiosError(`Event stream: ${result.status}`, AxiosError.ERR_BAD_RESPONSE, request, undefined, {
              data: null, status: result.status, statusText: result.statusText, headers: {}, config: request,
            });
          }
          const reader = result.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          try {
            while (!signal.aborted) {
              const { value, done } = await reader.read();
              if (done || signal.aborted) break;
              // Normalize after appending so CRLF split between chunks is still recognized.
              buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
              let boundary: number;
              while ((boundary = buffer.indexOf('\n\n')) >= 0) {
                const frame = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);
                const lines = frame.split('\n');
                const eventType = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
                if (eventType === 'ready') {
                  connection.ready = true;
                  // Recover inserts missed during reconnect before receiving new events.
                  invalidate(connection);
                } else if (eventType === 'message') {
                  const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
                  try {
                    const event: unknown = JSON.parse(data);
                    if (!event || typeof event !== 'object' || !('type' in event)) continue;
                    if (event.type !== 'staff-message' && event.type !== 'private-message') continue;
                    const conversationId = 'conversationId' in event && typeof event.conversationId === 'string' ? event.conversationId : undefined;
                    notify(connection, { type: event.type, conversationId });
                  } catch { /* Ignore malformed frames without losing the connection. */ }
                }
              }
              if (buffer.length > 65536) throw new Error('Event stream frame too large');
            }
          } finally {
            await reader.cancel().catch(() => {});
            reader.releaseLock();
          }
          return { data: null, status: result.status, statusText: result.statusText, headers: {}, config: request };
        },
      });
    } catch (error) {
      if (error instanceof AxiosError && [401, 403].includes(error.response?.status ?? 0)) break;
      // Network failures reconnect using a freshly resolved session header.
    }
    if (!signal.aborted) await retryDelay(signal);
  }
}

export function subscribeMessageEvents(scope: MessageScope, listener: Listener) {
  const key = JSON.stringify([scope.userId, scope.schoolId, scope.role, scope.contextSchoolId]);
  let connection = connections.get(key);
  if (!connection) {
    connection = { controller: new AbortController(), listeners: new Set(), ready: false };
    connections.set(key, connection);
    connection.listeners.add(listener);
    void connect(connection);
  } else {
    connection.listeners.add(listener);
    if (connection.ready) {
      const current = connection;
      queueMicrotask(() => invalidate(current, listener));
    }
  }
  const current = connection;
  return () => {
    current.listeners.delete(listener);
    if (!current.listeners.size) {
      current.controller.abort();
      if (connections.get(key) === current) connections.delete(key);
    }
  };
}
