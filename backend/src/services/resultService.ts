import { prisma } from '../lib/prisma';
import { UserRole } from '../types';
import { HttpError } from '../utils/httpError';
import { AcademicActor, requireAcademicSchool } from './academicAccess';
import { authorizeResults } from './resultAccess';
import { resolveTerm, termAliases } from './termService';
import { calculateAssessment, defaultConfiguration, gradeFor, loadConfiguration } from './assessmentService';

const ok = <T>(data: T) => ({ ok: true as const, data });
export interface PublicationInput { studentId: string; subjectId?: string; subjectName?: string; term?: string; status: 'Published' | 'Draft' | 'withheld' }
export const resultService = {
  list: async (actor: AcademicActor, studentId?: string, termRef?: string, pin?: string) => {
    const access = await authorizeResults(actor, studentId, termRef, pin);
    const rows = await prisma.result.findMany({ where: { student: access.studentWhere, ...(access.terms ? { term: { in: access.terms } } : {}), ...(access.publishedOnly ? { status: 'Published' } : {}) }, include: { student: { select: { name: true } } } });
    return ok(rows.map(row => ({ ...row, studentName: row.student.name, term: access.term?.id ?? row.term, subjectId: row.subjectId ?? undefined, status: row.status as PublicationInput['status'], details: row.details as Record<string, number> | null })));
  },
  publish: async (actor: AcademicActor, inputs: PublicationInput[]) => {
    if (![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(actor.role)) throw new HttpError(403, 'Only an administrator can publish results');
    const prepared = [];
    for (const input of inputs) {
      if (!input.term) throw new HttpError(400, 'Select the academic term for every result');
      const student = await prisma.student.findUnique({ where: { id: input.studentId } });
      if (!student) throw new HttpError(404, 'Student not found');
      await requireAcademicSchool(actor, student.schoolId);
      const term = await resolveTerm(student.schoolId, input.term);
      const subjects = await prisma.subject.findMany({ where: { schoolId: student.schoolId, ...(input.subjectId ? { id: input.subjectId } : { name: input.subjectName }) }, take: 2 });
      if (subjects.length !== 1) throw new HttpError(400, 'Select a canonical subject in this school');
      prepared.push({ student, subject: subjects[0], term, status: input.status });
    }
    if (new Set(prepared.map(row => `${row.student.id}/${row.subject.id}/${row.term.id}`)).size !== prepared.length) throw new HttpError(400, 'Duplicate result in publication batch');
    await prisma.$transaction(async tx => {
      for (const studentId of [...new Set(prepared.map(row => row.student.id))].sort()) await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${studentId} FOR UPDATE`;
      for (const { student, subject, term, status } of prepared) {
        const assessment = await tx.assessment.findFirst({ where: { studentId: student.id, subjectId: subject.id, term: { in: termAliases(term) } } });
        if (!assessment) throw new HttpError(409, 'Save the assessment marks before publishing');
        const config = await loadConfiguration(student.schoolId, subject.id, term.id);
        const calculated = calculateAssessment({ ...assessment, scores: assessment.scores as Record<string, number> | undefined }, config);
        const data = { studentId: student.id, subjectId: subject.id, subjectName: subject.name, term: term.id, average: calculated.average, grade: calculated.grade, status, remarks: calculated.remarks, details: calculated.details };
        const existing = await tx.result.findFirst({ where: { studentId: student.id, subjectName: subject.name, term: { in: termAliases(term) } } });
        if (existing) await tx.result.update({ where: { id: existing.id }, data });
        else await tx.result.upsert({ where: { studentId_subjectName_term: { studentId: student.id, subjectName: subject.name, term: term.id } }, update: data, create: data });
      }
    });
    return ok({ success: true });
  },
  status: async (actor: AcademicActor, id: string, status: PublicationInput['status']) => {
    const row = await prisma.result.findUnique({ where: { id }, include: { student: true } });
    if (!row) throw new HttpError(404, 'Result not found');
    if (status === 'Published') return resultService.publish(actor, [{ studentId: row.studentId, subjectId: row.subjectId ?? undefined, subjectName: row.subjectName, term: row.term, status }]);
    if (![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(actor.role)) throw new HttpError(403, 'Only an administrator can revise result status');
    await requireAcademicSchool(actor, row.student.schoolId);
    await prisma.result.update({ where: { id }, data: { status } });
    return ok(true);
  },
};
