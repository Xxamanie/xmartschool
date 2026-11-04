import { EventEmitter } from 'node:events';
import type { Request, Response as ExpressResponse } from 'express';
import { AxiosHeaders, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { messageStreamHandler } from '../src/routes/modules/eventStream';
import { publishMessageEvent } from '../src/services/eventBus';
import { UserRole } from '../src/types';
import apiClient from '../../src/utils/api';
import { subscribeMessageEvents } from '../../src/utils/messageEvents';

jest.mock('../../src/utils/api', () => ({ __esModule: true, default: { get: jest.fn(), getUri: jest.fn() } }));

class StreamResponse extends EventEmitter {
  writableEnded = false;
  destroyed = false;
  setHeader = jest.fn();
  flushHeaders = jest.fn();
  write = jest.fn((_frame: string) => true);
  status = jest.fn((_status: number) => this);
  json = jest.fn((_data: unknown) => this);
  end = jest.fn(() => { this.writableEnded = true; this.emit('finish'); return this; });
}

const responses: StreamResponse[] = [];
const unsubscribeAll: Array<() => void> = [];
let fetchMock: jest.SpiedFunction<typeof fetch>;

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  jest.mocked(apiClient.getUri).mockReturnValue('https://school.test/api/events/stream');
  jest.mocked(apiClient.get).mockImplementation(async <T, R, D>(_url: string, config?: AxiosRequestConfig<D>): Promise<R> => {
    if (typeof config?.adapter !== 'function') throw new Error('Streaming adapter required');
    return await config.adapter({ ...config, url: '/events/stream', headers: new AxiosHeaders({ Authorization: 'Bearer session-token' }) } as InternalAxiosRequestConfig) as R;
  });
  fetchMock = jest.spyOn(globalThis, 'fetch');
});

afterEach(async () => {
  unsubscribeAll.splice(0).forEach(unsubscribe => unsubscribe());
  responses.splice(0).forEach(response => response.emit('close'));
  await flush();
  fetchMock.mockRestore();
  jest.clearAllTimers();
  jest.useRealTimers();
});

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

const openServerStream = (role: UserRole, userId = 'teacher', schoolId: string | undefined = 'school') => {
  const response = new StreamResponse();
  responses.push(response);
  messageStreamHandler({ auth: { userId, schoolId, role, provider: 'legacy-session' } } as Request, response as unknown as ExpressResponse, () => {});
  return response;
};

const nextClientStream = () => {
  let writer!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { writer = controller; } });
  let closed = false;
  const close = () => { if (!closed) { closed = true; writer.close(); } };
  fetchMock.mockImplementationOnce(async (_url, options) => {
    options?.signal?.addEventListener('abort', close, { once: true });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  });
  return { send: (frame: string) => writer.enqueue(new TextEncoder().encode(frame)), close };
};

describe('message event stream authorization and cleanup', () => {
  test('staff events reach school staff and private events reach only same-school participants', () => {
    const teacher = openServerStream(UserRole.TEACHER);
    const otherSchool = openServerStream(UserRole.TEACHER, 'teacher', 'other-school');
    const student = openServerStream(UserRole.STUDENT, 'student');
    const unrelatedAdmin = openServerStream(UserRole.ADMIN, 'admin');
    publishMessageEvent({ type: 'staff-message', schoolId: 'school' });
    expect(teacher.write).toHaveBeenCalledTimes(2);
    expect(unrelatedAdmin.write).toHaveBeenCalledTimes(2);
    expect(student.write).toHaveBeenCalledTimes(1);
    expect(otherSchool.write).toHaveBeenCalledTimes(1);
    publishMessageEvent({ type: 'private-message', schoolId: 'school', userIds: ['teacher', 'student'], conversationId: 'conversation' });
    expect(teacher.write).toHaveBeenCalledTimes(3);
    expect(student.write).toHaveBeenCalledTimes(2);
    expect(otherSchool.write).toHaveBeenCalledTimes(1);
    expect(unrelatedAdmin.write).toHaveBeenCalledTimes(2);
    expect(student.write).toHaveBeenLastCalledWith('event: message\ndata: {"type":"private-message","conversationId":"conversation"}\n\n');
  });

  test('missing authentication is rejected before streaming', () => {
    const response = new StreamResponse();
    messageStreamHandler({} as Request, response as unknown as ExpressResponse, () => {});
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.flushHeaders).not.toHaveBeenCalled();
  });

  test('disconnect clears heartbeat and session timers; slow consumers close cleanly', () => {
    const response = openServerStream(UserRole.TEACHER);
    expect(jest.getTimerCount()).toBe(2);
    response.emit('close');
    expect(jest.getTimerCount()).toBe(0);
    publishMessageEvent({ type: 'staff-message', schoolId: 'school' });
    expect(response.write).toHaveBeenCalledTimes(1);
    const slow = openServerStream(UserRole.TEACHER);
    slow.write.mockReturnValue(false);
    publishMessageEvent({ type: 'staff-message', schoolId: 'school' });
    expect(slow.end).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('shared authenticated client event stream', () => {
  const scope = { userId: 'teacher', schoolId: 'school', role: 'TEACHER' };

  test('shares a connection, uses Bearer headers, and parses CRLF split between chunks', async () => {
    const stream = nextClientStream();
    const first = jest.fn();
    const second = jest.fn();
    const stopFirst = subscribeMessageEvents(scope, first);
    const stopSecond = subscribeMessageEvents(scope, second);
    unsubscribeAll.push(stopFirst, stopSecond);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://school.test/api/events/stream', expect.objectContaining({ headers: { Authorization: 'Bearer session-token' } }));
    stream.send('event: ready\r');
    stream.send('\ndata: {}\r\n\r');
    stream.send('\n');
    await flush();
    expect(first).toHaveBeenCalledWith({ type: 'staff-message' });
    expect(second).toHaveBeenCalledWith({ type: 'private-message' });
    stream.send('event: message\ndata: invalid-json\n\nevent: message\ndata: {"type":"private-message","conversationId":"thread"}\n\n');
    await flush();
    expect(first).toHaveBeenLastCalledWith({ type: 'private-message', conversationId: 'thread' });
    stopFirst();
    expect((fetchMock.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(false);
    stopSecond();
    expect((fetchMock.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
  });

  test('reconnection invalidates inboxes and a late subscriber reloads immediately', async () => {
    const firstStream = nextClientStream();
    const listener = jest.fn();
    unsubscribeAll.push(subscribeMessageEvents(scope, listener));
    await flush();
    firstStream.send('event: ready\ndata: {}\n\n');
    await flush();
    const lateListener = jest.fn();
    unsubscribeAll.push(subscribeMessageEvents(scope, lateListener));
    await flush();
    expect(lateListener).toHaveBeenCalledTimes(2);
    firstStream.close();
    await flush();
    const reconnected = nextClientStream();
    await jest.advanceTimersByTimeAsync(3000);
    reconnected.send('event: ready\ndata: {}\n\n');
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledTimes(4);
    expect(lateListener).toHaveBeenCalledTimes(4);
  });

  test('old StrictMode cleanup cannot abort a remounted subscription or deliver old events', async () => {
    nextClientStream();
    const oldListener = jest.fn();
    const stopOld = subscribeMessageEvents(scope, oldListener);
    await flush();
    stopOld();
    const currentStream = nextClientStream();
    const currentListener = jest.fn();
    const stopCurrent = subscribeMessageEvents(scope, currentListener);
    unsubscribeAll.push(stopCurrent);
    stopOld();
    await flush();
    currentStream.send('event: ready\ndata: {}\n\n');
    await flush();
    expect(oldListener).not.toHaveBeenCalled();
    expect(currentListener).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1][1]?.signal as AbortSignal).aborted).toBe(false);
  });

  test('switching schools creates an isolated stream and 401 responses do not retry', async () => {
    const oldStream = nextClientStream();
    const oldListener = jest.fn();
    unsubscribeAll.push(subscribeMessageEvents(scope, oldListener));
    await flush();
    const newStream = nextClientStream();
    const newListener = jest.fn();
    unsubscribeAll.push(subscribeMessageEvents({ ...scope, schoolId: 'other-school' }, newListener));
    await flush();
    oldStream.send('event: message\ndata: {"type":"private-message","conversationId":"old"}\n\n');
    newStream.send('event: message\ndata: {"type":"private-message","conversationId":"new"}\n\n');
    await flush();
    expect(oldListener).toHaveBeenCalledWith({ type: 'private-message', conversationId: 'old' });
    expect(newListener).toHaveBeenCalledTimes(1);
    expect(newListener).toHaveBeenCalledWith({ type: 'private-message', conversationId: 'new' });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    unsubscribeAll.push(subscribeMessageEvents({ ...scope, userId: 'expired' }, jest.fn()));
    await flush();
    await jest.advanceTimersByTimeAsync(10000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
