import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { prisma } from '../src/lib/prisma';
import { appService } from '../src/services/appService';
import { emailRecipients } from '../src/services/emailService';
import { UserRole } from '../src/types';

jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport: jest.fn(() => ({ sendMail: jest.fn<() => Promise<object>>().mockResolvedValue({}) })) } }));
jest.mock('../src/config/env', () => {
  const actual = jest.requireActual<{ env: Record<string, unknown> }>('../src/config/env');
  return { env: { ...actual.env, smtpHost: 'smtp.test.invalid', smtpPort: 587, smtpFrom: 'school@example.com' } };
});

const databaseTests = process.env.TEST_DATABASE_URL ? describe : describe.skip;
databaseTests('Student notification persistence and authorized email delivery', () => {
  const prefix = `notifications-${crypto.randomUUID()}`;
  const schoolId = `${prefix}-school`;
  const otherSchoolId = `${prefix}-other-school`;
  const adminId = `${prefix}-admin`;
  const teacherId = `${prefix}-teacher`;
  const parentId = `${prefix}-parent`;
  const studentId = `${prefix}-student`;
  const foreignStudentId = `${prefix}-foreign-student`;
  const classId = `${prefix}-class`;
  const foreignClassId = `${prefix}-foreign-class`;
  const subjectId = `${prefix}-subject`;
  const transport = jest.mocked(nodemailer.createTransport).mock.results[0].value as { sendMail: jest.Mock };
  const send = (audience: 'students' | 'school' | 'specific_users' | 'class_students' | 'teacher_students', overrides: Partial<Parameters<typeof appService.createNotification>[0]> = {}) => appService.createNotification({
    title: `${prefix}-${crypto.randomUUID()}`, message: 'Private school notice', source: 'Test',
    audience, schoolId, senderId: adminId, senderRole: UserRole.ADMIN, ...overrides,
  });

  beforeAll(async () => {
    await prisma.school.createMany({ data: [{ id: schoolId, name: 'Notification school' }, { id: otherSchoolId, name: 'Other school' }] });
    await prisma.user.createMany({ data: [
      { id: adminId, name: 'Admin', email: `${prefix}-admin@example.com`, password: 'unused', role: 'ADMIN', schoolId },
      { id: teacherId, name: 'Teacher', email: `${prefix}-teacher@example.com`, password: 'unused', role: 'TEACHER', schoolId },
      { id: parentId, name: 'Parent', email: `${prefix}-parent@example.com`, password: 'unused', role: 'PARENT' },
    ] });
    await prisma.schoolClass.createMany({ data: [{ id: classId, name: 'JSS1', schoolId }, { id: foreignClassId, name: 'JSS1', schoolId: otherSchoolId }] });
    await prisma.student.createMany({ data: [
      { id: studentId, name: 'Student', email: `${prefix}-student@example.com`, gender: 'Male', grade: 'JSS1', enrollmentDate: new Date(), accessCode: `${prefix}-access`, schoolId, schoolClassId: classId },
      { id: foreignStudentId, name: 'Foreign student', email: `${prefix}-foreign@example.com`, gender: 'Male', grade: 'JSS1', enrollmentDate: new Date(), accessCode: `${prefix}-foreign-access`, schoolId: otherSchoolId, schoolClassId: foreignClassId },
    ] });
    await prisma.parentStudent.create({ data: { parentId, studentId } });
    await prisma.subject.create({ data: { id: subjectId, name: 'Mathematics', schoolId } });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { schoolId: { in: [schoolId, otherSchoolId] } } });
    await prisma.student.deleteMany({ where: { schoolId: { in: [schoolId, otherSchoolId] } } });
    await prisma.teacherAssignment.deleteMany({ where: { teacherId } });
    await prisma.subject.deleteMany({ where: { schoolId } });
    await prisma.school.deleteMany({ where: { id: { in: [schoolId, otherSchoolId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, teacherId, parentId] } } });
    await prisma.$disconnect();
  });

  test('separate Student identities persist, receive their inbox, mark read, and resolve email', async () => {
    expect(await prisma.user.findUnique({ where: { id: studentId } })).toBeNull();
    const result = await send('students');
    expect(result.ok).toBe(true);
    expect(result.data.recipientCount).toBe(1);
    const recipient = await prisma.notificationRecipient.findFirst({ where: { notificationId: result.data.id } });
    expect(recipient).toMatchObject({ studentId, userId: null, readAt: null });
    expect((await appService.listNotifications(studentId, UserRole.STUDENT)).data).toEqual(expect.arrayContaining([expect.objectContaining({ id: result.data.id })]));
    expect((await appService.listNotifications(foreignStudentId, UserRole.STUDENT)).data).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: result.data.id })]));
    await appService.markNotificationRead(result.data.id, studentId);
    expect((await prisma.notificationRecipient.findUnique({ where: { id: recipient!.id } }))?.readAt).toBeInstanceOf(Date);
    await emailRecipients([studentId], result.data.title, result.data.message);
    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: `${prefix}-student@example.com`, subject: result.data.title }));
  });

  test('school notices persist a mix of User and Student recipients', async () => {
    const result = await send('school');
    expect(result.ok).toBe(true);
    const recipients = await prisma.notificationRecipient.findMany({ where: { notificationId: result.data.id } });
    expect(recipients).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: adminId, studentId: null }),
      expect.objectContaining({ userId: teacherId, studentId: null }),
      expect.objectContaining({ userId: null, studentId }),
    ]));
    expect(recipients).toHaveLength(3);
  });

  test('invalid IDs and cross-school recipients/classes fail before saving or emailing', async () => {
    for (const overrides of [{ userIds: [foreignStudentId] }, { userIds: ['missing-recipient'] }]) {
      const title = `${prefix}-forbidden-${crypto.randomUUID()}`;
      const result = await send('specific_users', { ...overrides, title });
      expect(result.ok).toBe(false);
      expect(await prisma.notification.count({ where: { title } })).toBe(0);
      expect(transport.sendMail).not.toHaveBeenCalledWith(expect.objectContaining({ subject: title }));
    }
    expect((await send('class_students', { classId: foreignClassId })).ok).toBe(false);
    const linkedParent = await send('specific_users', { userIds: [parentId] });
    expect(linkedParent.ok).toBe(true);
    expect(await prisma.notificationRecipient.findFirst({ where: { notificationId: linkedParent.data.id, userId: parentId } })).not.toBeNull();
  });

  test('unassigned teachers reach nobody; assigned class teachers reach students with default empty subject lists', async () => {
    const teacher = { senderId: teacherId, senderRole: UserRole.TEACHER };
    const unassigned = await send('teacher_students', teacher);
    expect(unassigned.ok).toBe(true);
    expect(unassigned.data.recipientCount).toBe(0);
    expect((await send('specific_users', { ...teacher, userIds: [studentId] })).ok).toBe(false);
    expect((await send('school', teacher)).ok).toBe(false);
    await prisma.teacherAssignment.create({ data: { teacherId, schoolClassId: classId, subjectId } });
    const assigned = await send('teacher_students', teacher);
    expect(assigned.ok).toBe(true);
    expect(assigned.data.recipientCount).toBe(1);
    expect((await send('specific_users', { ...teacher, userIds: [studentId] })).ok).toBe(true);
    expect((await send('specific_users', { ...teacher, userIds: [adminId] })).ok).toBe(false);
  });

  test('published results persist the student notification instead of failing its User foreign key', async () => {
    const published = await appService.publishResults(schoolId, [{ id: '', studentName: 'Student', studentId, subjectName: 'Mathematics', term: 'First', average: 80, grade: 'A', status: 'Published' }], adminId);
    expect(published.ok).toBe(true);
    expect(await prisma.notificationRecipient.count({ where: { studentId, notification: { title: 'Results Published', schoolId } } })).toBe(1);
  });

  test('database enforces exactly one recipient, per-student uniqueness, and cascades deleted students', async () => {
    const result = await send('specific_users', { userIds: [studentId] });
    const notificationId = result.data.id;
    await expect(prisma.notificationRecipient.create({ data: { notificationId } })).rejects.toThrow();
    await expect(prisma.notificationRecipient.create({ data: { notificationId, userId: adminId, studentId } })).rejects.toThrow();
    await expect(prisma.notificationRecipient.create({ data: { notificationId, studentId } })).rejects.toMatchObject({ code: 'P2002' });
    const disposableId = `${prefix}-disposable-student`;
    await prisma.student.create({ data: { id: disposableId, name: 'Disposable', gender: 'Male', grade: 'JSS1', enrollmentDate: new Date(), accessCode: disposableId, schoolId } });
    const disposable = await send('specific_users', { userIds: [disposableId] });
    expect(await prisma.notificationRecipient.count({ where: { studentId: disposableId } })).toBe(1);
    await prisma.student.delete({ where: { id: disposableId } });
    expect(await prisma.notificationRecipient.count({ where: { notificationId: disposable.data.id } })).toBe(0);
  });
});
