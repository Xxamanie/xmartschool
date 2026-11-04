import request from 'supertest';
import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import app from '../src/server';
import { prisma } from '../src/lib/prisma';
import { env } from '../src/config/env';
import { createSessionToken } from '../src/utils/session';
import { UserRole } from '../src/types';

jest.mock('../src/lib/prisma', () => ({ prisma: {
  schoolClass: { findUnique: jest.fn() },
  subject: { findFirst: jest.fn() },
  user: { findFirst: jest.fn() },
  teacherAssignment: { findFirst: jest.fn() },
  student: { findUnique: jest.fn() },
  liveClass: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  liveClassParticipant: { upsert: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  liveClassMessage: { create: jest.fn(), findMany: jest.fn() },
  liveClassRecording: { create: jest.fn(), update: jest.fn() },
} }));

const liveClass = {
  id: 'live', subjectId: 'subject', teacherId: 'teacher', schoolClassId: 'class',
  scheduledTime: new Date('2026-10-06T09:30:00.000Z'), status: 'scheduled',
  meetingLink: 'https://school.whereby.com/room',
  hostMeetingLink: 'https://school.whereby.com/room?roomKey=host-secret', videoProvider: 'whereby',
  schoolClass: { schoolId: 'school' },
};
const payload = {
  subjectId: 'subject', teacherId: 'teacher', schoolClassId: 'class',
  scheduledTime: '2026-10-06T09:30:00.000Z', meetingLink: '',
};
const auth = (role: UserRole, id = role === UserRole.STUDENT ? 'student' : role === UserRole.TEACHER ? 'teacher' : 'admin') =>
  `Bearer ${createSessionToken({ id, name: 'Test', role, schoolId: 'school' })}`;

beforeEach(() => {
  jest.resetAllMocks();
  env.wherebyApiKey = '';
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected provider request'));
  jest.mocked(prisma.schoolClass.findUnique).mockResolvedValue({ schoolId: 'school' } as never);
  jest.mocked(prisma.subject.findFirst).mockResolvedValue({ id: 'subject' } as never);
  jest.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'teacher' } as never);
  jest.mocked(prisma.teacherAssignment.findFirst).mockResolvedValue({ id: 'assignment' } as never);
  jest.mocked(prisma.student.findUnique).mockResolvedValue({ schoolId: 'school', schoolClassId: 'class' } as never);
  jest.mocked(prisma.liveClass.findUnique).mockResolvedValue(liveClass as never);
  jest.mocked(prisma.liveClass.findMany).mockResolvedValue([liveClass] as never);
  jest.mocked(prisma.liveClass.create).mockImplementation(args => Promise.resolve<unknown>({ ...liveClass, ...args.data }) as never);
});

afterEach(() => {
  env.wherebyApiKey = '';
  jest.restoreAllMocks();
});

test.each(['', undefined])('blank or omitted meeting link reaches Whereby creation (%s)', async meetingLink => {
  env.wherebyApiKey = 'test-provider-key';
  jest.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({
    roomUrl: liveClass.meetingLink, hostRoomUrl: liveClass.hostMeetingLink,
  }), { status: 200 }));
  const response = await request(app).post('/api/live-classes')
    .set('Authorization', auth(UserRole.ADMIN)).send({ ...payload, meetingLink });
  expect(response.body.ok).toBe(true);
  expect(globalThis.fetch).toHaveBeenCalledWith('https://api.whereby.dev/v1/meetings', expect.objectContaining({ method: 'POST' }));
  expect(response.body.data.meetingLink).toBe(liveClass.meetingLink);
  expect(response.body.data.hostMeetingLink).toBe(liveClass.hostMeetingLink);
  expect(prisma.liveClass.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ scheduledTime: new Date(payload.scheduledTime), videoProvider: 'whereby' }),
  }));
});

test.each(['missing-key', 'provider-unavailable'])('blank link falls back to Jitsi when %s', async mode => {
  if (mode === 'provider-unavailable') {
    env.wherebyApiKey = 'test-provider-key';
    jest.mocked(globalThis.fetch).mockResolvedValue(new Response('Unavailable', { status: 503 }));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  }
  const response = await request(app).post('/api/live-classes').set('Authorization', auth(UserRole.ADMIN)).send(payload);
  expect(response.body.ok).toBe(true);
  expect(response.body.data.meetingLink).toMatch(/^https:\/\/meet\.jit\.si\/xmartschool-/);
  expect(response.body.data.videoProvider).toBe('jitsi');
  expect(response.body.data.hostMeetingLink).toBeUndefined();
});

test('explicit meeting URL is preserved and skips provider creation', async () => {
  env.wherebyApiKey = 'test-provider-key';
  const meetingLink = 'https://school.whereby.com/custom-room?displayName=Class';
  const response = await request(app).post('/api/live-classes')
    .set('Authorization', auth(UserRole.ADMIN)).send({ ...payload, meetingLink });
  expect(response.body.data.meetingLink).toBe(meetingLink);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('a manual Whereby host URL keeps its room key out of the participant URL', async () => {
  const response = await request(app).post('/api/live-classes').set('Authorization', auth(UserRole.ADMIN))
    .send({ ...payload, meetingLink: liveClass.hostMeetingLink });
  expect(response.body.ok).toBe(true);
  expect(response.body.data.meetingLink).toBe(liveClass.meetingLink);
  expect(response.body.data.hostMeetingLink).toBe(liveClass.hostMeetingLink);
});

test.each(['class', 'subject', 'teacher'])('cannot create a live class with a foreign-school %s reference', async reference => {
  env.wherebyApiKey = 'test-provider-key';
  if (reference === 'class') jest.mocked(prisma.schoolClass.findUnique).mockResolvedValue({ schoolId: 'other-school' } as never);
  if (reference === 'subject') jest.mocked(prisma.subject.findFirst).mockResolvedValue(null);
  if (reference === 'teacher') jest.mocked(prisma.user.findFirst).mockResolvedValue(null);
  const response = await request(app).post('/api/live-classes').set('Authorization', auth(UserRole.ADMIN)).send(payload);
  expect(response.body.ok).toBe(false);
  expect(prisma.liveClass.create).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('a teacher needs the subject/class assignment before scheduling', async () => {
  jest.mocked(prisma.teacherAssignment.findFirst).mockResolvedValue(null);
  const response = await request(app).post('/api/live-classes').set('Authorization', auth(UserRole.TEACHER)).send(payload);
  expect(response.body.ok).toBe(false);
  expect(prisma.liveClass.create).not.toHaveBeenCalled();
  expect(prisma.teacherAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: { teacherId: 'teacher', schoolClassId: 'class', subjectId: 'subject' },
  }));
});

test('student listing is limited to their school/class and never returns host credentials', async () => {
  const response = await request(app).get('/api/live-classes').set('Authorization', auth(UserRole.STUDENT));
  expect(response.body.data[0].meetingLink).toBe(liveClass.meetingLink);
  expect(response.body.data[0].hostMeetingLink).toBeUndefined();
  expect(prisma.liveClass.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { schoolClass: { schoolId: 'school' }, schoolClassId: 'class' },
  }));
});

test('a student without an assigned class sees no school-wide room listing', async () => {
  jest.mocked(prisma.student.findUnique).mockResolvedValue({ schoolId: 'school', schoolClassId: null } as never);
  const response = await request(app).get('/api/live-classes').set('Authorization', auth(UserRole.STUDENT));
  expect(response.body.data).toEqual([]);
  expect(prisma.liveClass.findMany).not.toHaveBeenCalled();
});

test.each([UserRole.ADMIN, UserRole.TEACHER])('%s can receive host credentials for their authorized rooms', async role => {
  const response = await request(app).get('/api/live-classes').set('Authorization', auth(role));
  expect(response.body.data[0].hostMeetingLink).toBe(liveClass.hostMeetingLink);
  expect(prisma.liveClass.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ schoolClass: { schoolId: 'school' } }),
  }));
});

test.each([
  { method: 'post', suffix: 'join', body: {} },
  { method: 'post', suffix: 'leave', body: {} },
  { method: 'post', suffix: 'participant-status', body: { cameraOn: true, microphoneOn: true } },
  { method: 'post', suffix: 'raise-hand', body: { raised: true } },
  { method: 'post', suffix: 'messages', body: { message: 'Hello' } },
  { method: 'get', suffix: 'messages', body: {} },
  { method: 'get', suffix: 'participants', body: {} },
  { method: 'post', suffix: 'recording/start', body: { recordingUrl: 'https://recordings.example.com/lesson' } },
  { method: 'post', suffix: 'recording/stop', body: { duration: 30 } },
])('school admin cannot access another school room via $suffix ($method)', async ({ method, suffix, body }) => {
  jest.mocked(prisma.liveClass.findUnique).mockResolvedValue({ ...liveClass, schoolClass: { schoolId: 'other-school' } } as never);
  const client = request(app);
  const response = await (method === 'get' ? client.get(`/api/live-classes/live/${suffix}`) : client.post(`/api/live-classes/live/${suffix}`))
    .set('Authorization', auth(UserRole.ADMIN)).send(body);
  expect(response.body.ok).toBe(false);
  expect(prisma.liveClassParticipant.upsert).not.toHaveBeenCalled();
  expect(prisma.liveClassParticipant.update).not.toHaveBeenCalled();
  expect(prisma.liveClassParticipant.findMany).not.toHaveBeenCalled();
  expect(prisma.liveClassMessage.create).not.toHaveBeenCalled();
  expect(prisma.liveClassMessage.findMany).not.toHaveBeenCalled();
  expect(prisma.liveClassRecording.create).not.toHaveBeenCalled();
  expect(prisma.liveClassRecording.update).not.toHaveBeenCalled();
  expect(prisma.liveClass.update).not.toHaveBeenCalled();
});

test('a teacher cannot record a room hosted by another teacher', async () => {
  const response = await request(app).post('/api/live-classes/live/recording/start')
    .set('Authorization', auth(UserRole.TEACHER, 'other-teacher')).send({ recordingUrl: 'https://recordings.example.com/lesson' });
  expect(response.body.ok).toBe(false);
  expect(prisma.liveClassRecording.create).not.toHaveBeenCalled();
});

test('an admin cannot override their tenant with a query parameter', async () => {
  await request(app).get('/api/live-classes?schoolId=other-school').set('Authorization', auth(UserRole.ADMIN)).expect(403);
  expect(prisma.liveClass.findMany).not.toHaveBeenCalled();
});
