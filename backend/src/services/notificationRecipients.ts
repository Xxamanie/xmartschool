import { NotificationAudience, Prisma, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

export type NotificationTarget = { id: string; kind: 'user' | 'student' };

/** Resolve real identities before saving or emailing; never trust supplied recipient IDs. */
export async function resolveNotificationRecipients(ids: string[], schoolId?: string, userRoles?: UserRole[]): Promise<NotificationTarget[]> {
  const uniqueIds = [...new Set(ids.map(id => id.trim()).filter(Boolean))];
  if (!uniqueIds.length) return [];
  const [users, students] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { in: uniqueIds },
        ...(userRoles ? { role: { in: userRoles } } : {}),
        ...(schoolId ? { OR: [
          { schoolId },
          { role: 'PARENT', parentLinks: { some: { student: { schoolId } } } },
        ] } : {}),
      },
      select: { id: true },
    }),
    prisma.student.findMany({ where: { id: { in: uniqueIds }, ...(schoolId ? { schoolId } : {}) }, select: { id: true } }),
  ]);
  const userIds = new Set(users.map(user => user.id));
  const studentIds = new Set(students.map(student => student.id));
  return uniqueIds.map(id => {
    const isUser = userIds.has(id);
    const isStudent = studentIds.has(id);
    if (isUser === isStudent) throw new Error('One or more recipients are unavailable or outside the permitted school and roles');
    return { id, kind: isUser ? 'user' : 'student' };
  });
}

export async function saveNotificationRecipients(notificationId: string, targets: NotificationTarget[], db: Pick<Prisma.TransactionClient, 'notificationRecipient'> = prisma) {
  if (!targets.length) return;
  await db.notificationRecipient.createMany({
    data: targets.map(target => ({ notificationId, ...(target.kind === 'user' ? { userId: target.id } : { studentId: target.id }) })),
    skipDuplicates: true,
  });
}

export async function createNotificationRecipients(notificationId: string, ids: string[], schoolId?: string) {
  const targets = await resolveNotificationRecipients(ids, schoolId);
  await saveNotificationRecipients(notificationId, targets);
  return targets;
}

export function validateNotificationAudience(audience: string, senderRole: UserRole, schoolId?: string) {
  if (!Object.values(NotificationAudience).includes(audience as NotificationAudience)) throw new Error('Invalid notification audience');
  if (!new Set<UserRole>([UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN]).has(senderRole)) {
    throw new Error('Only school staff may send notifications');
  }
  if (senderRole !== UserRole.SUPER_ADMIN && !schoolId) throw new Error('School context is required');
  if (senderRole !== UserRole.SUPER_ADMIN && audience === 'all') throw new Error('Only super admins may broadcast to all schools');
  if (senderRole === UserRole.TEACHER && !['teacher_students', 'specific_users'].includes(audience)) {
    throw new Error('Teachers may notify only their assigned students');
  }
}

export async function teacherNotificationStudentIds(teacherId: string, schoolId: string) {
  const assignments = await prisma.teacherAssignment.findMany({
    where: { teacherId, schoolClass: { schoolId } }, select: { schoolClassId: true },
  });
  if (!assignments.length) return [];
  const students = await prisma.student.findMany({
    where: { schoolId, schoolClassId: { in: [...new Set(assignments.map(assignment => assignment.schoolClassId))] } },
    select: { id: true },
  });
  return students.map(student => student.id);
}

export async function resolveNotificationAudience(params: {
  audience: NotificationAudience; schoolId?: string; classId?: string; userIds?: string[]; senderId: string; senderRole: UserRole;
}): Promise<NotificationTarget[]> {
  const { audience, schoolId, classId, senderRole, senderId, userIds } = params;
  validateNotificationAudience(audience, senderRole, schoolId);
  let ids: string[] = [];
  if (audience === 'specific_users') {
    ids = [...new Set((userIds ?? []).map(id => id.trim()).filter(Boolean))];
    if (!ids.length) throw new Error('Select at least one notification recipient');
    if (senderRole === UserRole.TEACHER) {
      const allowed = new Set(await teacherNotificationStudentIds(senderId, schoolId!));
      if (ids.some(id => !allowed.has(id))) throw new Error('Teachers may notify only their assigned students');
    }
  } else if (audience === 'all' || audience === 'school') {
    if (audience === 'school' && !schoolId) throw new Error('Select a school');
    const where = audience === 'school' ? { schoolId } : {};
    const [users, students] = await Promise.all([
      prisma.user.findMany({ where, select: { id: true } }),
      prisma.student.findMany({ where, select: { id: true } }),
    ]);
    ids = [...users.map(user => user.id), ...students.map(student => student.id)];
  } else if (['admins', 'teachers', 'staff'].includes(audience)) {
    if (!schoolId && !(audience === 'admins' && senderRole === UserRole.SUPER_ADMIN)) throw new Error('Select a school');
    const roles: UserRole[] = audience === 'admins' ? ['ADMIN'] : audience === 'teachers' ? ['TEACHER'] : ['ADMIN', 'TEACHER'];
    const users = await prisma.user.findMany({ where: { ...(schoolId ? { schoolId } : {}), role: { in: roles } }, select: { id: true } });
    ids = users.map(user => user.id);
  } else if (audience === 'students' || audience === 'class_students') {
    if (!schoolId) throw new Error('Select a school');
    if (audience === 'class_students') {
      if (!classId || !await prisma.schoolClass.findFirst({ where: { id: classId, schoolId }, select: { id: true } })) {
        throw new Error('Class not found in the permitted school');
      }
    }
    const students = await prisma.student.findMany({ where: { schoolId, ...(audience === 'class_students' ? { schoolClassId: classId } : {}) }, select: { id: true } });
    ids = students.map(student => student.id);
  } else if (audience === 'teacher_students') {
    if (!schoolId) throw new Error('Select a school');
    ids = await teacherNotificationStudentIds(senderId, schoolId);
  }
  const allowedRoles: UserRole[] | undefined = senderRole === UserRole.SUPER_ADMIN || audience !== 'specific_users' ? undefined : ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'];
  return resolveNotificationRecipients(ids, schoolId, allowedRoles);
}
