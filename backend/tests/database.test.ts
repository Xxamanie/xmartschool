import { beforeAll, afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import app from '../src/server';
import { prisma } from '../src/lib/prisma';
import { insertPayment } from '../src/services/paymentService';
import { createSessionToken } from '../src/utils/session';
import { UserRole } from '../src/types';

// Explicit test URL only: never connect to an application's configured database.
const databaseTests = process.env.TEST_DATABASE_URL ? describe : describe.skip;
databaseTests('PostgreSQL integration', () => {
  const prefix = `test-${crypto.randomUUID()}`;
  const schoolId = `${prefix}-school`;
  const teacherId = `${prefix}-teacher`;
  const studentId = `${prefix}-student`;
  const subjectId = `${prefix}-subject`;
  const classId = `${prefix}-class`;
  let itemId: string;
  const authorization = (role: UserRole) => `Bearer ${createSessionToken({ id: teacherId, name: 'Test', role, schoolId })}`;
  beforeAll(async () => {
    await prisma.school.create({ data: { id: schoolId, name: 'Integration school' } });
    await prisma.user.create({ data: { id: teacherId, name: 'Integration teacher', email: `${prefix}@example.com`, password: await bcrypt.hash('correct-password', 4), role: 'TEACHER', schoolId } });
    await prisma.schoolClass.create({ data: { id: classId, name: 'JSS1', schoolId } });
    await prisma.student.create({ data: { id: studentId, name: 'Student', gender: 'Male', grade: 'JSS1', enrollmentDate: new Date(), accessCode: prefix, schoolId, schoolClassId: classId } });
    await prisma.subject.create({ data: { id: subjectId, name: 'Mathematics', schoolId } });
    await prisma.assessment.create({ data: { studentId, subjectId, term: 'First', ca1: 10 } });
    const template = await prisma.feeTemplate.create({ data: { schoolId, name: 'Tuition', term: 'First', lines: { create: { title: 'Tuition', key: 'tuition' } } }, include: { lines: true } });
    const ledger = await prisma.studentFeeLedger.create({ data: { schoolId, studentId, term: 'First', scopeType: 'schoolClass', scopeId: classId, templateId: template.id,
      lineItems: { create: { templateLineId: template.lines[0].id, title: 'Tuition', key: 'tuition', payableAmount: 100 } } }, include: { lineItems: true } });
    itemId = ledger.lineItems[0].id;
  });
  beforeEach(async () => {
    await prisma.studentFeePayment.deleteMany({ where: { ledgerItemId: itemId } });
    await prisma.classMaster.deleteMany({ where: { schoolId } });
    await prisma.teacherAssignment.deleteMany({ where: { teacherId } });
  });
  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { schoolId } });
    await prisma.auditLog.deleteMany({ where: { schoolId } });
    await prisma.student.deleteMany({ where: { schoolId } });
    await prisma.feeTemplate.deleteMany({ where: { schoolId } });
    await prisma.subject.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await prisma.user.delete({ where: { id: teacherId } });
    await prisma.$disconnect();
  });

  test('valid and invalid credentials against stored password hashes', async () => {
    const login = (password: string) => request(app).post('/api/auth/login').send({ email: `${prefix}@example.com`, password });
    expect((await login('correct-password')).body.ok).toBe(true);
    expect((await login('invalid')).body.ok).toBe(false);
  });
  test('form-master and subject assignment reads are enforced', async () => {
    const list = () => request(app).get(`/api/assessments?subjectId=${subjectId}`).set('Authorization', authorization(UserRole.TEACHER));
    expect((await list()).body.data).toHaveLength(0);
    await prisma.teacherAssignment.create({ data: { teacherId, subjectId, schoolClassId: classId } });
    expect((await list()).body.data).toHaveLength(1);
    await prisma.teacherAssignment.deleteMany({ where: { teacherId } });
    await prisma.classMaster.create({ data: { schoolId, teacherId, grade: 'JSS1' } });
    expect((await list()).body.data).toHaveLength(1);
  });
  test('admin can publish results and teacher is blocked', async () => {
    const payload = [{ studentId, subjectName: 'Mathematics', term: 'First', average: 75, grade: 'A', status: 'Published' }];
    const post = (role: UserRole) => request(app).post('/api/results').set('Authorization', authorization(role)).send(payload);
    expect((await post(UserRole.TEACHER)).status).toBe(403);
    expect((await post(UserRole.ADMIN)).body.ok).toBe(true);
    expect(await prisma.result.count({ where: { studentId, status: 'Published' } })).toBe(1);
  });
  test('HTTP overpayment rejection leaves the balance unchanged', async () => {
    const response = await request(app).post('/api/finance/payments').set('Authorization', authorization(UserRole.ADMIN)).send({ ledgerItemId: itemId, amount: 101, clientRef: crypto.randomUUID() });
    expect(response.status).toBe(400);
    expect(await prisma.studentFeePayment.count({ where: { ledgerItemId: itemId } })).toBe(0);
  });
  test('concurrent retries insert exactly one payment', async () => {
    const input = { ledgerItemId: itemId, amount: 100, schoolId, clientRef: crypto.randomUUID() };
    const payments = await Promise.all([insertPayment(input), insertPayment(input)]);
    expect(payments[0].payment.id).toBe(payments[1].payment.id);
    expect(await prisma.studentFeePayment.count({ where: { ledgerItemId: itemId } })).toBe(1);
  });
  test('concurrent distinct payments cannot overpay the same ledger item', async () => {
    const input = { ledgerItemId: itemId, amount: 60, schoolId };
    const results = await Promise.allSettled([insertPayment({ ...input, clientRef: crypto.randomUUID() }), insertPayment({ ...input, clientRef: crypto.randomUUID() })]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await prisma.studentFeePayment.aggregate({ where: { ledgerItemId: itemId }, _sum: { amount: true } }))._sum.amount).toBe(60);
  });
  test.each(['assignment', 'form-master'])('a teacher can save scores for the permitted class via %s', async access => {
    if (access === 'assignment') await prisma.teacherAssignment.create({ data: { teacherId, subjectId, schoolClassId: classId } });
    else await prisma.classMaster.create({ data: { teacherId, grade: 'JSS1', schoolId } });
    const response = await request(app).put('/api/assessments').set('Authorization', authorization(UserRole.TEACHER)).send([
      { studentId, subjectId, term: 'First', ca1: 10, ca2: 10, ca3: 10, exam: 50 },
    ]);
    expect(response.body.ok).toBe(true);
    expect(await prisma.result.findUnique({ where: { studentId_subjectName_term: { studentId, subjectName: 'Mathematics', term: 'First' } } })).toMatchObject({ average: 80, status: 'Draft' });
  });
  test('a parent cannot read an unlinked student ledger', async () => {
    const response = await request(app).get(`/api/finance/ledgers?studentId=${studentId}`).set('Authorization', authorization(UserRole.PARENT));
    expect(response.status).toBe(403);
  });
});
