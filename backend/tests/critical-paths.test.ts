import request from 'supertest';
import { jest, test, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import app from '../src/server';
import { prisma } from '../src/lib/prisma';
import { appService } from '../src/services/appService';
import { createSessionToken } from '../src/utils/session';
import { UserRole } from '../src/types';

jest.mock('../src/lib/prisma', () => ({ prisma: {
  user: { findFirst: jest.fn() },
  student: { findMany: jest.fn(), findUnique: jest.fn() },
  subject: { count: jest.fn() },
  classMaster: { findFirst: jest.fn(), findMany: jest.fn() },
  schoolClass: { findFirst: jest.fn() },
  teacherAssignment: { findMany: jest.fn() },
  assessment: { findMany: jest.fn(), create: jest.fn(), upsert: jest.fn() },
  studentFeeLedgerItem: { findUnique: jest.fn() },
  studentFeePayment: { findUnique: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(), $queryRaw: jest.fn(),
} }));

const token = (role: UserRole) => createSessionToken({ id: 'teacher', name: 'Test', role, schoolId: 'school' });
const auth = (role: UserRole) => `Bearer ${token(role)}`;
const score = { studentId: 'student', subjectId: 'subject', term: 'First', ca1: 10, ca2: 10, ca3: 10, exam: 50 };
const mock = <T extends (...args: never[]) => unknown>(fn: T) => fn as jest.MockedFunction<T>;

beforeEach(() => {
  jest.resetAllMocks();
  mock(prisma.classMaster.findFirst).mockResolvedValue(null);
  mock(prisma.classMaster.findMany).mockResolvedValue([]);
  mock(prisma.teacherAssignment.findMany).mockResolvedValue([]);
  mock(prisma.assessment.findMany).mockResolvedValue([]);
});

test('login accepts a valid password and rejects an invalid password', async () => {
  mock(prisma.user.findFirst).mockResolvedValue({ id: 'teacher', name: 'Test', email: 'teacher@example.com', password: await bcrypt.hash('valid-password', 4), role: 'TEACHER', schoolId: 'school', groupId: null, avatar: null, gender: null, phone: null, bio: null });
  const valid = await request(app).post('/api/auth/login').send({ email: 'teacher@example.com', password: 'valid-password' });
  expect(valid.body.ok).toBe(true);
  expect(valid.body.data.authToken).toEqual(expect.any(String));
  const invalid = await request(app).post('/api/auth/login').send({ email: 'teacher@example.com', password: 'wrong' });
  expect(invalid.body.ok).toBe(false);
  expect(invalid.body.data.authToken).toBeUndefined();
});

test('seeded demo accounts accept their password when demo fallback is disabled', async () => {
  mock(prisma.user.findFirst).mockResolvedValue({
    id: 'demo-admin',
    name: 'Adaeze Okonkwo',
    email: 'admin@greenfield.demo',
    password: await bcrypt.hash('Password1', 4),
    role: 'ADMIN',
    schoolId: 'school',
    groupId: null,
    avatar: null,
    gender: null,
    phone: null,
    bio: null,
  });
  const valid = await request(app).post('/api/auth/login').send({ email: 'admin@greenfield.demo', password: 'Password1' });
  expect(valid.body.ok).toBe(true);
  expect(valid.body.data.authToken).toEqual(expect.any(String));
  const invalid = await request(app).post('/api/auth/login').send({ email: 'admin@greenfield.demo', password: 'wrong' });
  expect(invalid.body.ok).toBe(false);
});

test('results publication allows admins and blocks teachers before saving', async () => {
  const publish = jest.spyOn(appService, 'publishResults').mockResolvedValue({ ok: true, data: { success: true } });
  const payload = [{ studentId: 'student', subjectName: 'Maths', average: 80, grade: 'A', status: 'Published' }];
  expect((await request(app).post('/api/results').set('Authorization', auth(UserRole.ADMIN)).send(payload)).body.ok).toBe(true);
  expect((await request(app).post('/api/results').set('Authorization', auth(UserRole.TEACHER)).send(payload)).status).toBe(403);
  expect(publish).toHaveBeenCalledTimes(1);
  publish.mockRestore();
});

test('form masters can read all subjects in their grade; unassigned teachers see no assessments', async () => {
  mock(prisma.classMaster.findFirst).mockResolvedValue({ id: 'master', schoolId: 'school', teacherId: 'teacher', grade: 'JSS1' });
  mock(prisma.schoolClass.findFirst).mockResolvedValue({ id: 'class' } as never);
  mock(prisma.student.findMany).mockResolvedValue([{ id: 'student' }] as never);
  await request(app).get('/api/assessments').set('Authorization', auth(UserRole.TEACHER)).expect(200);
  expect(prisma.assessment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ studentId: { in: ['student'] } }) }));
  jest.clearAllMocks();
  mock(prisma.classMaster.findFirst).mockResolvedValue(null);
  const regular = await request(app).get('/api/assessments?subjectId=subject').set('Authorization', auth(UserRole.TEACHER));
  expect(regular.body.data).toEqual([]);
  expect(prisma.assessment.findMany).not.toHaveBeenCalled();
});

test.each(['assignment', 'form-master'])('saving cannot cross the permitted class/grade via %s', async access => {
  mock(prisma.student.findMany).mockResolvedValue([{ id: 'student', schoolId: 'school', schoolClassId: 'other-class', grade: 'JSS2' }] as never);
  if (access === 'assignment') mock(prisma.teacherAssignment.findMany).mockResolvedValue([{ subjectId: 'subject', schoolClassId: 'class' }] as never);
  else mock(prisma.classMaster.findMany).mockResolvedValue([{ grade: 'JSS1', schoolId: 'school' }] as never);
  const response = await request(app).put('/api/assessments').set('Authorization', auth(UserRole.TEACHER)).send([score]);
  expect(response.body.ok).toBe(false);
  expect(prisma.assessment.create).not.toHaveBeenCalled();
  expect(prisma.assessment.upsert).not.toHaveBeenCalled();
});

test('payment overpayment is rejected without inserting a payment', async () => {
  mock(prisma.studentFeeLedgerItem.findUnique).mockResolvedValue({ id: 'item', payableAmount: 100, ledger: { schoolId: 'school', studentId: 'student', term: 'First' }, payments: [{ amount: 90 }] } as never);
  mock(prisma.$transaction).mockImplementation(async (callback: unknown) => (callback as Function)(prisma));
  const response = await request(app).post('/api/finance/payments').set('Authorization', auth(UserRole.ADMIN)).send({ ledgerItemId: 'item', amount: 20, clientRef: 'attempt' });
  expect(response.status).toBe(400);
  expect(prisma.studentFeePayment.create).not.toHaveBeenCalled();
  expect(prisma.$queryRaw).toHaveBeenCalled();
});

test('retry returns the original payment and conflicting reuse is rejected', async () => {
  mock(prisma.studentFeeLedgerItem.findUnique).mockResolvedValue({ id: 'item', payableAmount: 100, ledger: { schoolId: 'school', studentId: 'student', term: 'First' }, payments: [{ amount: 100 }] } as never);
  mock(prisma.studentFeePayment.findUnique).mockResolvedValue({ id: 'payment', ledgerItemId: 'item', amount: 100, method: null, paymentRef: null, clientRef: 'attempt', createdAt: new Date() });
  mock(prisma.$transaction).mockImplementation(async (callback: unknown) => (callback as Function)(prisma));
  const payload = { ledgerItemId: 'item', amount: 100, clientRef: 'attempt' };
  const retry = await request(app).post('/api/finance/payments').set('Authorization', auth(UserRole.ADMIN)).send(payload);
  expect(retry.body.data.id).toBe('payment');
  expect(prisma.studentFeePayment.create).not.toHaveBeenCalled();
  const conflict = await request(app).post('/api/finance/payments').set('Authorization', auth(UserRole.ADMIN)).send({ ...payload, amount: 50 });
  expect(conflict.status).toBe(409);
});
