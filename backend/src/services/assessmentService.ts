import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { UserRole } from '../types';
import { HttpError } from '../utils/httpError';
import { AcademicActor, academicStudentWhere, requireAcademicSchool, teacherCanAssess } from './academicAccess';
import { resolveTerm, termAliases } from './termService';

export const configurationSchema = z.object({
  caColumns: z.array(z.object({ id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/), label: z.string().trim().min(1).max(80), maxScore: z.number().positive().max(1000) })).max(20),
  examMax: z.number().min(0).max(1000), passMark: z.number().min(0).max(100),
  gradingScale: z.array(z.object({ grade: z.string().trim().min(1).max(10), minPercentage: z.number().min(0).max(100) })).min(1).max(20),
}).superRefine((config, context) => {
  if (new Set(config.caColumns.map(column => column.id)).size !== config.caColumns.length || config.caColumns.some(column => ['exam', 'total', 'maximum', 'percentage'].includes(column.id))) context.addIssue({ code: 'custom', message: 'CA identifiers must be unique and must not use reserved names' });
  if (config.examMax + config.caColumns.reduce((sum, column) => sum + column.maxScore, 0) <= 0) context.addIssue({ code: 'custom', message: 'The assessment maximum must be positive' });
  if (!config.gradingScale.some(grade => grade.minPercentage === 0)) context.addIssue({ code: 'custom', message: 'The grading scale must cover zero percent' });
});
export type AssessmentConfiguration = z.infer<typeof configurationSchema>;
export const defaultConfiguration: AssessmentConfiguration = { caColumns: [{ id: 'ca1', label: '1st CA', maxScore: 10 }, { id: 'ca2', label: '2nd CA', maxScore: 10 }, { id: 'ca3', label: '3rd CA', maxScore: 10 }], examMax: 70, passMark: 50, gradingScale: [{ grade: 'A+', minPercentage: 90 }, { grade: 'A', minPercentage: 80 }, { grade: 'B', minPercentage: 70 }, { grade: 'C', minPercentage: 60 }, { grade: 'D', minPercentage: 50 }, { grade: 'F', minPercentage: 0 }] };
export interface AssessmentInput { id?: string; studentId: string; subjectId: string; term: string; ca1: number; ca2: number; ca3: number; exam: number; scores?: Record<string, number> }
export async function loadConfiguration(schoolId: string, subjectId: string, term: string): Promise<AssessmentConfiguration> {
  const row = await prisma.assessmentConfig.findUnique({ where: { schoolId_subjectId_term: { schoolId, subjectId, term } } });
  return row ? configurationSchema.parse(row.configJson) : defaultConfiguration;
}
export function gradeFor(percentage: number, config: AssessmentConfiguration) { return [...config.gradingScale].sort((a, b) => b.minPercentage - a.minPercentage).find(grade => percentage >= grade.minPercentage)?.grade ?? ''; }
export function calculateAssessment(input: AssessmentInput, config: AssessmentConfiguration) {
  const scores = input.scores ?? { ca1: input.ca1, ca2: input.ca2, ca3: input.ca3 };
  const configured = new Set(config.caColumns.map(column => column.id));
  if (Object.keys(scores).some(key => !configured.has(key))) throw new HttpError(400, 'Scores include an unconfigured CA column');
  const normalized: Record<string, number> = {};
  for (const column of config.caColumns) {
    const value = scores[column.id] ?? 0;
    if (!Number.isFinite(value) || value < 0 || value > column.maxScore) throw new HttpError(400, `${column.label} must be between 0 and ${column.maxScore}`);
    normalized[column.id] = value;
  }
  if (!Number.isFinite(input.exam) || input.exam < 0 || input.exam > config.examMax) throw new HttpError(400, `Exam must be between 0 and ${config.examMax}`);
  const maximum = config.examMax + config.caColumns.reduce((sum, column) => sum + column.maxScore, 0);
  const total = Object.values(normalized).reduce((sum, value) => sum + value, 0) + input.exam;
  const average = Math.round(total / maximum * 10000) / 100;
  return { scores: normalized, average, grade: gradeFor(average, config), remarks: average >= config.passMark ? 'Pass' : 'Below pass mark', details: { ...normalized, exam: input.exam, total, maximum, percentage: average } };
}
const ok = <T>(data: T) => ({ ok: true as const, data });
export const assessmentService = {
  configuration: async (actor: AcademicActor, subjectId: string, termRef: string, config?: AssessmentConfiguration) => {
    if (!actor.schoolId) throw new HttpError(400, 'Select a school');
    await requireAcademicSchool(actor, actor.schoolId);
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId: actor.schoolId } });
    if (!subject) throw new HttpError(404, 'Subject not found');
    const term = await resolveTerm(actor.schoolId, termRef);
    if (config) {
      if (![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(actor.role)) throw new HttpError(403, 'Only an administrator can change the scoring configuration');
      const parsed = configurationSchema.parse(config);
      if (await prisma.result.count({ where: { subjectId, term: { in: termAliases(term) }, status: 'Published', student: { schoolId: actor.schoolId } } })) throw new HttpError(409, 'Unpublish approved results before changing their scoring configuration');
      await prisma.assessmentConfig.upsert({ where: { schoolId_subjectId_term: { schoolId: actor.schoolId, subjectId, term: term.id } }, update: { configJson: parsed }, create: { schoolId: actor.schoolId, subjectId, term: term.id, configJson: parsed } });
      return ok(parsed);
    }
    return ok(await loadConfiguration(actor.schoolId, subjectId, term.id));
  },
  list: async (actor: AcademicActor, subjectId?: string, termRef?: string, studentId?: string, classId?: string) => {
    const studentWhere = await academicStudentWhere(actor, studentId, classId, subjectId);
    const students = await prisma.student.findMany({ where: studentWhere, select: { id: true, schoolId: true } });
    const ids = students.map(student => student.id);
    const where: Prisma.AssessmentWhereInput = { studentId: { in: ids }, ...(subjectId ? { subjectId } : {}) };
    if (termRef) {
      const conditions: Prisma.AssessmentWhereInput[] = [];
      for (const schoolId of new Set(students.map(student => student.schoolId))) {
        const term = await resolveTerm(schoolId, termRef);
        conditions.push({ student: { schoolId }, term: { in: termAliases(term) } });
      }
      where.OR = conditions.length ? conditions : [{ studentId: '__none__' }];
    }
    const rows = await prisma.assessment.findMany({ where, include: { student: { select: { name: true } } } });
    return ok(rows.map(row => ({ ...row, studentName: row.student.name, scores: row.scores && typeof row.scores === 'object' && !Array.isArray(row.scores) ? row.scores as Record<string, number> : { ca1: row.ca1, ca2: row.ca2, ca3: row.ca3 }, ...(row.scores && typeof row.scores === 'object' && !Array.isArray(row.scores) ? row.scores as Record<string, number> : {}) })));
  },
  save: async (actor: AcademicActor, inputs: AssessmentInput[]) => {
    if (![UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN].includes(actor.role)) throw new HttpError(403, 'Cannot save assessments');
    const prepared: Array<{
      input: AssessmentInput;
      student: NonNullable<Awaited<ReturnType<typeof prisma.student.findUnique>>>;
      subject: NonNullable<Awaited<ReturnType<typeof prisma.subject.findFirst>>>;
      term: Awaited<ReturnType<typeof resolveTerm>>;
      calculated: ReturnType<typeof calculateAssessment>;
    }> = [];
    for (const input of inputs) {
      const student = await prisma.student.findUnique({ where: { id: input.studentId } });
      if (!student) throw new HttpError(404, 'Student not found');
      await requireAcademicSchool(actor, student.schoolId);
      const subject = await prisma.subject.findFirst({ where: { id: input.subjectId, schoolId: student.schoolId } });
      if (!subject) throw new HttpError(403, 'Subject is outside the student school');
      if (actor.role === UserRole.TEACHER && (!student.schoolClassId || !(await teacherCanAssess(actor, student.schoolId, student.schoolClassId, subject.id)))) throw new HttpError(403, 'Not authorized for this student and subject');
      const term = await resolveTerm(student.schoolId, input.term);
      if (input.id && !input.id.startsWith('temp-')) {
        const existing = await prisma.assessment.findUnique({ where: { id: input.id } });
        if (existing && (existing.studentId !== student.id || existing.subjectId !== subject.id || !termAliases(term).includes(existing.term))) throw new HttpError(403, 'Cannot change assessment ownership');
      }
      const config = await loadConfiguration(student.schoolId, subject.id, term.id);
      prepared.push({ input, student, subject, term, calculated: calculateAssessment(input, config) });
    }
    if (new Set(prepared.map(row => `${row.student.id}/${row.subject.id}/${row.term.id}`)).size !== prepared.length) throw new HttpError(400, 'Duplicate student/subject/term in this batch');
    await prisma.$transaction(async tx => {
      for (const { input, student, subject, term, calculated } of prepared) {
        const existingResult = await tx.result.findFirst({ where: { studentId: student.id, subjectName: subject.name, term: { in: termAliases(term) } }, orderBy: { term: 'asc' } });
        if (existingResult?.status === 'Published' && (existingResult.average !== calculated.average || existingResult.grade !== calculated.grade || Object.entries(calculated.details).some(([key, value]) => (existingResult.details as Record<string, number> | null)?.[key] !== value))) throw new HttpError(409, 'Published marks are locked. An administrator must return them to Draft before revision');
        const old = await tx.assessment.findFirst({ where: { studentId: student.id, subjectId: subject.id, term: { in: termAliases(term) } }, orderBy: { term: 'asc' } });
        const data = { studentId: student.id, subjectId: subject.id, term: term.id, scores: calculated.scores, ca1: calculated.scores.ca1 ?? 0, ca2: calculated.scores.ca2 ?? 0, ca3: calculated.scores.ca3 ?? 0, exam: input.exam };
        if (old) await tx.assessment.update({ where: { id: old.id }, data });
        else await tx.assessment.upsert({ where: { studentId_subjectId_term: { studentId: student.id, subjectId: subject.id, term: term.id } }, update: data, create: data });
        const resultData = { studentId: student.id, subjectId: subject.id, subjectName: subject.name, term: term.id, average: calculated.average, grade: calculated.grade, remarks: calculated.remarks, details: calculated.details, status: existingResult?.status ?? 'Draft' };
        if (existingResult) await tx.result.update({ where: { id: existingResult.id }, data: resultData });
        else await tx.result.upsert({ where: { studentId_subjectName_term: { studentId: student.id, subjectName: subject.name, term: term.id } }, update: resultData, create: resultData });
      }
    });
    return ok({ success: true });
  },
};
