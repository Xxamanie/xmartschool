import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import type { NotificationTarget } from './notificationRecipients';

const transport = env.smtpHost ? nodemailer.createTransport({
  host: env.smtpHost, port: env.smtpPort, secure: env.smtpPort === 465,
  ...(env.smtpUser ? { auth: { user: env.smtpUser, pass: env.smtpPassword } } : {}),
  connectionTimeout: 10000, socketTimeout: 15000,
}) : undefined;

export async function emailRecipients(userIds: string[], title: string, message: string, targets?: NotificationTarget[]) {
  if (!transport || !env.smtpFrom || !userIds.length) return;
  const accountIds = targets ? targets.filter(target => target.kind === 'user').map(target => target.id) : userIds;
  const studentIds = targets ? targets.filter(target => target.kind === 'student').map(target => target.id) : userIds;
  const [users, students] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: accountIds }, email: { not: null } }, select: { email: true } }),
    prisma.student.findMany({ where: { id: { in: studentIds }, email: { not: null } }, select: { email: true } }),
  ]);
  const emails = [...new Set([...users, ...students].flatMap(user => user.email ? [user.email] : []))];
  // Individual messages keep recipient addresses private.
  for (const email of emails) {
    try { await transport.sendMail({ from: env.smtpFrom, to: email, subject: title, text: message }); }
    catch { console.error('[Email] Notification delivery failed'); }
  }
}
