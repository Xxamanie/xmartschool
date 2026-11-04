import { prisma } from '../lib/prisma';
import type { NotificationTarget } from './notificationRecipients';

export const preferenceKeys = ['examSubmission', 'resultsPublished', 'paymentReceived', 'newAnnouncement', 'systemMaintenance'] as const;
export type PreferenceKey = typeof preferenceKeys[number];
export const defaultPreferences = Object.fromEntries(preferenceKeys.map(key => [key, true])) as Record<PreferenceKey, boolean>;
export function userAllowsNotification(preferences: unknown, key: PreferenceKey): boolean {
  return !preferences || typeof preferences !== 'object' || (preferences as Record<string, unknown>)[key] !== false;
}
export function notificationCategory(title: string, message = ''): PreferenceKey {
  const text = `${title} ${message}`.toLowerCase();
  if (/payment|receipt|fee balance|fee reminder/.test(text)) return 'paymentReceived';
  if (/result|report card/.test(text)) return 'resultsPublished';
  if (/exam/.test(text)) return 'examSubmission';
  if (/maintenance|system outage/.test(text)) return 'systemMaintenance';
  return 'newAnnouncement';
}
export async function filterNotificationTargets(targets: NotificationTarget[], title: string, message: string) {
  if (!targets.length) return [];
  const [users, students] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: targets.filter(target => target.kind === 'user').map(target => target.id) }, active: true }, select: { id: true, notificationPreferences: true } }),
    prisma.student.findMany({ where: { id: { in: targets.filter(target => target.kind === 'student').map(target => target.id) }, status: 'Active' }, select: { id: true, notificationPreferences: true } }),
  ]);
  const category = notificationCategory(title, message);
  const allowed = new Set([...users, ...students].filter(user => userAllowsNotification(user.notificationPreferences, category)).map(user => user.id));
  return targets.filter(target => allowed.has(target.id));
}
