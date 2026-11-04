import { beforeEach, expect, jest, test } from '@jest/globals';
import nodemailer from 'nodemailer';
import { prisma } from '../src/lib/prisma';
import { emailRecipients } from '../src/services/emailService';

jest.mock('../src/config/env', () => ({ env: { smtpHost: 'smtp.test.invalid', smtpPort: 587, smtpFrom: 'school@example.com' } }));
jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport: jest.fn(() => ({ sendMail: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) })) } }));
jest.mock('../src/lib/prisma', () => ({ prisma: { user: { findMany: jest.fn() }, student: { findMany: jest.fn() } } }));
const mailer = nodemailer.createTransport as jest.MockedFunction<typeof nodemailer.createTransport>;
const transport = mailer.mock.results[0].value as { sendMail: jest.Mock };

beforeEach(() => { jest.clearAllMocks(); });
test('student and parent emails are deduplicated and delivered privately', async () => {
  (prisma.user.findMany as jest.MockedFunction<typeof prisma.user.findMany>).mockResolvedValue([{ email: 'parent@example.com' }] as never);
  (prisma.student.findMany as jest.MockedFunction<typeof prisma.student.findMany>).mockResolvedValue([{ email: 'student@example.com' }, { email: 'parent@example.com' }] as never);
  await emailRecipients(['student', 'parent'], 'Results published', 'Your results are available');
  expect(transport.sendMail).toHaveBeenCalledTimes(2);
  expect(transport.sendMail).toHaveBeenCalledWith({ from: 'school@example.com', to: 'student@example.com', subject: 'Results published', text: 'Your results are available' });
  expect(transport.sendMail).toHaveBeenCalledWith({ from: 'school@example.com', to: 'parent@example.com', subject: 'Results published', text: 'Your results are available' });
});
