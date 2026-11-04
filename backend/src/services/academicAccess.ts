import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../lib/prisma';
import { UserRole } from '../types';
import { HttpError } from '../utils/httpError';
import { canAccessSchool, getAccessibleSchoolIds, getEffectiveSchoolId } from '../utils/tenant';

export interface AcademicActor { userId: string; role: UserRole; schoolId?: string; groupId?: string }
export function academicActor(req: Request): AcademicActor {
  if (!req.auth) throw new HttpError(401, 'Authentication required');
  return { ...req.auth, schoolId: getEffectiveSchoolId(req) ?? req.auth.schoolId };
}
export async function requireAcademicSchool(actor: AcademicActor, schoolId: string) {
  if (!schoolId || !(await canAccessSchool(actor, schoolId))) throw new HttpError(403, 'School is not accessible');
}
export async function teacherCanAssess(actor: AcademicActor, schoolId: string, classId: string, subjectId?: string): Promise<boolean> {
  if (actor.role !== UserRole.TEACHER) return true;
  const schoolClass = await prisma.schoolClass.findFirst({ where: { id: classId, schoolId }, select: { name: true } });
  if (!schoolClass) return false;
  const [master, assignment] = await Promise.all([
    prisma.classMaster.findFirst({ where: { schoolId, teacherId: actor.userId, grade: schoolClass.name } }),
    prisma.teacherAssignment.findFirst({ where: { teacherId: actor.userId, schoolClassId: classId, ...(subjectId ? { subjectId } : {}) } }),
  ]);
  return !!master || !!assignment;
}
export async function academicStudentWhere(actor: AcademicActor, studentId?: string, classId?: string, subjectId?: string): Promise<Prisma.StudentWhereInput> {
  const where: Prisma.StudentWhereInput = { ...(studentId ? { id: studentId } : {}), ...(classId ? { schoolClassId: classId } : {}) };
  if (actor.role === UserRole.STUDENT) {
    if (studentId && studentId !== actor.userId) throw new HttpError(403, 'You can only view your own records');
    return { ...where, id: actor.userId, schoolId: actor.schoolId };
  }
  if (actor.role === UserRole.PARENT) {
    const links = await prisma.parentStudent.findMany({ where: { parentId: actor.userId }, select: { studentId: true } });
    const ids = links.map(link => link.studentId);
    if (studentId && !ids.includes(studentId)) throw new HttpError(403, 'Select one of your linked children');
    return { ...where, id: studentId ?? { in: ids } };
  }
  const schools = await getAccessibleSchoolIds(actor);
  if (actor.schoolId) {
    await requireAcademicSchool(actor, actor.schoolId);
    where.schoolId = actor.schoolId;
  } else if (schools !== null) where.schoolId = { in: schools };
  if (actor.role === UserRole.TEACHER) {
    const [masters, assignments] = await Promise.all([
      prisma.classMaster.findMany({ where: { teacherId: actor.userId, schoolId: actor.schoolId }, select: { grade: true } }),
      prisma.teacherAssignment.findMany({ where: { teacherId: actor.userId, ...(subjectId ? { subjectId } : {}), schoolClass: { schoolId: actor.schoolId } }, select: { schoolClassId: true } }),
    ]);
    where.AND = [{ OR: [{ grade: { in: masters.map(master => master.grade) } }, { schoolClassId: { in: assignments.map(assignment => assignment.schoolClassId) } }] }];
  }
  return where;
}
