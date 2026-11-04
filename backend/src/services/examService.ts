import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ExamQuestionInput, UserRole } from '../types';
import { HttpError } from '../utils/httpError';
import { AcademicActor, requireAcademicSchool, teacherCanAssess } from './academicAccess';
import { resolveTerm } from './termService';

type ExamWithQuestions = Prisma.ExamGetPayload<{ include: { questions: true } }>;
type ExamScope = { schoolId?: string; schoolClassId: string; subjectId: string; termId: string; duration?: number };
const staff = [UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN];
const ok = <T>(data: T) => ({ ok: true as const, data });
const mapExam = (exam: ExamWithQuestions, answers: boolean) => ({ ...exam, schoolId: exam.schoolId ?? undefined, schoolClassId: exam.schoolClassId ?? undefined, subjectId: exam.subjectId ?? undefined, termId: exam.termId ?? undefined, teacherId: exam.teacherId ?? undefined,
  questions: exam.questions.map(question => ({ ...question, options: Array.isArray(question.options) ? question.options as string[] : undefined, correctAnswer: answers ? question.correctAnswer : undefined })) });
function deadline(start: Date | null, duration: number) { return new Date((start?.getTime() ?? 0) + duration * 60_000); }
function mapSession(session: Prisma.ExamSessionGetPayload<object>, duration: number) { return { ...session, score: session.score ?? undefined, startTime: session.startTime?.toISOString(), endTime: session.endTime?.toISOString(), answers: (session.answers ?? {}) as Record<string, string>, deadline: deadline(session.startTime, duration).toISOString() }; }

async function authorizedExam(actor: AcademicActor, id: string, studentId?: string): Promise<ExamWithQuestions> {
  const exam = await prisma.exam.findUnique({ where: { id }, include: { questions: true } });
  if (!exam?.schoolId || !exam.schoolClassId || !exam.subjectId || !exam.termId) throw new HttpError(404, 'Exam is unavailable until its school, class, subject and term are configured');
  await requireAcademicSchool(actor, exam.schoolId);
  if (actor.role === UserRole.TEACHER && (exam.teacherId !== actor.userId || !(await teacherCanAssess(actor, exam.schoolId, exam.schoolClassId, exam.subjectId)))) throw new HttpError(403, 'You do not manage this exam');
  if (actor.role === UserRole.STUDENT || studentId) {
    const effectiveId = actor.role === UserRole.STUDENT ? actor.userId : studentId!;
    if (actor.role === UserRole.STUDENT && studentId && studentId !== effectiveId) throw new HttpError(403, 'You can only use your own exam session');
    const student = await prisma.student.findFirst({ where: { id: effectiveId, schoolId: exam.schoolId, schoolClassId: exam.schoolClassId }, select: { enrolledSubjects: true } });
    if (!student || (student.enrolledSubjects.length > 0 && !student.enrolledSubjects.includes(exam.subjectId))) throw new HttpError(403, 'Student is not enrolled in this exam');
  }
  if (!staff.includes(actor.role) && actor.role !== UserRole.STUDENT) throw new HttpError(403, 'Exam access is not available for this role');
  return exam;
}

export const examService = {
  list: async (actor: AcademicActor, available = false) => {
    if (!actor.schoolId) throw new HttpError(400, 'Select a school to view exams');
    await requireAcademicSchool(actor, actor.schoolId);
    if (!staff.includes(actor.role) && actor.role !== UserRole.STUDENT) throw new HttpError(403, 'Exam access is not available for this role');
    let classId: string | undefined;
    if (actor.role === UserRole.STUDENT) {
      const student = await prisma.student.findUnique({ where: { id: actor.userId } });
      if (!student?.schoolClassId) return ok([]);
      classId = student.schoolClassId;
    }
    const exams = await prisma.exam.findMany({ where: { schoolId: actor.schoolId, schoolClassId: classId ?? { not: null }, subjectId: { not: null }, termId: { not: null }, ...(available ? { status: 'active' } : {}), ...(actor.role === UserRole.TEACHER ? { teacherId: actor.userId } : {}) }, include: { questions: true }, orderBy: { id: 'asc' } });
    const permitted: ExamWithQuestions[] = [];
    for (const exam of exams) {
      try { await authorizedExam(actor, exam.id); permitted.push(exam); } catch (error) { if (!(error instanceof HttpError) || error.status !== 403) throw error; }
    }
    return ok(permitted.map(exam => mapExam(exam, staff.includes(actor.role) && !available)));
  },
  save: async (actor: AcademicActor, questions: ExamQuestionInput[], title: string, examId: string | undefined, teacherId: string | undefined, scope: ExamScope) => {
    if (!staff.includes(actor.role)) throw new HttpError(403, 'Cannot edit exams');
    const schoolId = actor.schoolId ?? scope.schoolId;
    if (!schoolId) throw new HttpError(400, 'School context is required');
    await requireAcademicSchool(actor, schoolId);
    const term = await resolveTerm(schoolId, scope.termId);
    const [schoolClass, subject] = await Promise.all([prisma.schoolClass.findFirst({ where: { id: scope.schoolClassId, schoolId } }), prisma.subject.findFirst({ where: { id: scope.subjectId, schoolId } })]);
    if (!schoolClass || !subject) throw new HttpError(400, 'Select a class and subject in this school');
    const owner = actor.role === UserRole.TEACHER ? actor.userId : teacherId;
    if (actor.role === UserRole.TEACHER && teacherId && teacherId !== actor.userId) throw new HttpError(403, 'Cannot assign another exam owner');
    if (owner && !(await prisma.user.findFirst({ where: { id: owner, schoolId, role: 'TEACHER' } }))) throw new HttpError(400, 'Exam owner must be a teacher in this school');
    if (!(await teacherCanAssess(actor, schoolId, schoolClass.id, subject.id))) throw new HttpError(403, 'You do not teach this class and subject');
    const duration = scope.duration ?? 60;
    if (!Number.isInteger(duration) || duration < 1 || duration > 240) throw new HttpError(400, 'Exam duration must be between 1 and 240 minutes');
    const data = { schoolId, schoolClassId: schoolClass.id, subjectId: subject.id, termId: term.id, teacherId: owner, title, duration, questions: { create: questions.map(({ id: _id, ...question }) => ({ ...question, options: question.options ?? undefined })) } };
    const exam = await prisma.$transaction(async tx => {
      if (!examId) return tx.exam.create({ data, include: { questions: true } });
      await tx.$queryRaw`SELECT id FROM "Exam" WHERE id = ${examId} FOR UPDATE`;
      const existing = await tx.exam.findUnique({ where: { id: examId }, include: { _count: { select: { sessions: true } } } });
      if (!existing || existing.schoolId !== schoolId || (actor.role === UserRole.TEACHER && existing.teacherId !== actor.userId)) throw new HttpError(403, 'You do not manage this exam');
      if (existing.status === 'active' || existing._count.sessions > 0) throw new HttpError(409, 'Questions are locked after an exam starts. Create a new exam to revise them');
      return tx.exam.update({ where: { id: examId }, data: { ...data, questions: { deleteMany: {}, ...data.questions } }, include: { questions: true } });
    });
    return ok(mapExam(exam, true));
  },
  status: async (actor: AcademicActor, id: string, status: 'scheduled' | 'active' | 'ended') => {
    const exam = await authorizedExam(actor, id);
    if (!staff.includes(actor.role)) throw new HttpError(403, 'Cannot manage exam status');
    if (status === 'active' && exam.status === 'ended') throw new HttpError(409, 'Ended exams cannot be reopened');
    if (status === 'scheduled' && exam.status !== 'scheduled') throw new HttpError(409, 'Started exams cannot return to scheduled');
    return ok(mapExam(await prisma.exam.update({ where: { id }, data: { status }, include: { questions: true } }), true));
  },
  sessions: async (actor: AcademicActor, id: string) => {
    const exam = await authorizedExam(actor, id);
    if (!staff.includes(actor.role)) throw new HttpError(403, 'Cannot view other exam sessions');
    const sessions = await prisma.examSession.findMany({ where: { examId: id, student: { schoolId: exam.schoolId! } }, include: { frames: { orderBy: { createdAt: 'desc' }, take: 1 } } });
    return ok(sessions.map(session => ({ ...mapSession(session, exam.duration), latestFrame: session.frames[0] ? { frameData: session.frames[0].frameData, createdAt: session.frames[0].createdAt.toISOString() } : undefined })));
  },
  start: async (actor: AcademicActor, id: string, studentId: string) => {
    const exam = await authorizedExam(actor, id, studentId);
    if (exam.status !== 'active') throw new HttpError(409, 'Exam is not active');
    const session = await prisma.examSession.upsert({ where: { examId_studentId: { examId: id, studentId } }, update: {}, create: { examId: id, studentId, status: 'in-progress', progress: 0, answers: {} } });
    return ok(mapSession(session, exam.duration));
  },
  progress: async (actor: AcademicActor, id: string, studentId: string, _progress: number, answers?: Record<string, string>) => {
    const exam = await authorizedExam(actor, id, studentId);
    if (exam.status !== 'active') throw new HttpError(409, 'Exam is not active');
    validateAnswers(exam, answers ?? {});
    const updated = await prisma.examSession.updateMany({ where: { examId: id, studentId, status: 'in-progress', startTime: { gte: new Date(Date.now() - exam.duration * 60_000) } }, data: { ...(answers ? { answers, progress: Math.round(Object.values(answers).filter(value => value.trim()).length / exam.questions.length * 100) } : {}) } });
    if (!updated.count) throw new HttpError(409, 'Session is complete or its deadline has passed');
    return ok(true);
  },
  submit: async (actor: AcademicActor, id: string, studentId: string, answers: Record<string, string>) => {
    const exam = await authorizedExam(actor, id, studentId);
    validateAnswers(exam, answers);
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Exam" WHERE id = ${id} FOR UPDATE`;
      const currentExam = await tx.exam.findUnique({ where: { id } });
      if (currentExam?.status !== 'active') throw new HttpError(409, 'Exam is not active');
      await tx.$queryRaw`SELECT id FROM "ExamSession" WHERE "examId" = ${id} AND "studentId" = ${studentId} FOR UPDATE`;
      const session = await tx.examSession.findUnique({ where: { examId_studentId: { examId: id, studentId } } });
      if (!session) throw new HttpError(409, 'Start the exam before submitting');
      if (session.status === 'submitted') return { score: session.score ?? 0, sessionId: session.id };
      if (session.status !== 'in-progress' || !session.startTime) throw new HttpError(409, 'Session is not active');
      // After the server deadline, finalize only the last answers saved before it.
      const finalAnswers = Date.now() > deadline(session.startTime, exam.duration).getTime() ? (session.answers ?? {}) as Record<string, string> : answers;
      const total = exam.questions.reduce((sum, q) => sum + q.points, 0);
      const earned = exam.questions.reduce((sum, q) => sum + (normalize(finalAnswers[q.id]) === normalize(q.correctAnswer) ? q.points : 0), 0);
      const score = total ? Math.round(earned / total * 100) : 0;
      await tx.examSession.update({ where: { id: session.id }, data: { status: 'submitted', progress: 100, score, answers: finalAnswers, endTime: new Date() } });
      return { score, sessionId: session.id };
    });
    return ok(result);
  },
  reset: async (actor: AcademicActor, id: string, studentId: string) => {
    await authorizedExam(actor, id, studentId);
    if (![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(actor.role)) throw new HttpError(403, 'Only an administrator can reset an attempt');
    await prisma.examSession.delete({ where: { examId_studentId: { examId: id, studentId } } });
    return ok(true);
  },
  frame: async (actor: AcademicActor, id: string, studentId: string, frameData: string) => {
    const exam = await authorizedExam(actor, id, studentId);
    if (!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+=*$/.test(frameData) || frameData.length > 200_000) throw new HttpError(400, 'Use a JPEG or PNG snapshot smaller than 150 KB');
    const session = await prisma.examSession.findUnique({ where: { examId_studentId: { examId: id, studentId } } });
    if (exam.status !== 'active' || session?.status !== 'in-progress' || Date.now() > deadline(session.startTime, exam.duration).getTime()) throw new HttpError(409, 'An active exam session is required');
    await prisma.proctorFrame.create({ data: { examSessionId: session.id, frameData } });
    const older = await prisma.proctorFrame.findMany({ where: { examSessionId: session.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 30, select: { id: true } });
    if (older.length) await prisma.proctorFrame.deleteMany({ where: { id: { in: older.map(frame => frame.id) } } });
    return ok({ stored: true });
  },
};
function normalize(value?: string) { return value?.normalize('NFKC').trim().toLocaleLowerCase() ?? ''; }
function validateAnswers(exam: ExamWithQuestions, answers: Record<string, string>) {
  const ids = new Set(exam.questions.map(question => question.id));
  if (Object.keys(answers).some(id => !ids.has(id))) throw new HttpError(400, 'Answers contain questions outside this exam');
}
