import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { UserRole } from '../types';
import { HttpError } from '../utils/httpError';
import { AcademicActor, academicStudentWhere } from './academicAccess';
import { getStudentTermClearance } from './clearanceService';
import { resolveTerm, termAliases } from './termService';

export class ResultAccessError extends HttpError {
  constructor(public feeStatus: 'not_cleared' | 'pin_required' | 'results_not_published', message: string) { super(403, message); }
}
export async function authorizeResults(actor: AcademicActor, studentId?: string, termRef?: string, pin?: string) {
  const studentWhere = await academicStudentWhere(actor, studentId);
  if (actor.role === UserRole.STUDENT) {
    const student = await prisma.student.findFirst({ where: studentWhere });
    if (!student?.resultPin || !student.resultPinTerm) throw new ResultAccessError('not_cleared', 'Your term fees must be cleared before result access');
    const term = await resolveTerm(student.schoolId, termRef ?? student.resultPinTerm);
    const pinTerm = await resolveTerm(student.schoolId, student.resultPinTerm);
    if (term.id !== pinTerm.id) throw new ResultAccessError('pin_required', 'This PIN is for a different term');
    const supplied = Buffer.from((pin ?? '').trim().toUpperCase());
    const stored = Buffer.from(student.resultPin);
    if (supplied.length !== stored.length || !crypto.timingSafeEqual(supplied, stored)) throw new ResultAccessError('pin_required', 'Enter your Result Access PIN');
    const clearance = await getStudentTermClearance(student.id, student.schoolId, term.id);
    if (!clearance.cleared) throw new ResultAccessError('not_cleared', 'Your term fees have not been fully cleared');
    if (!await prisma.result.count({ where: { studentId: student.id, term: { in: termAliases(term) }, status: 'Published' } })) throw new ResultAccessError('results_not_published', 'Results for this term have not been published');
    return { studentWhere, term, terms: termAliases(term), publishedOnly: true };
  }
  const publishedOnly = actor.role === UserRole.PARENT;
  if (studentId) {
    const student = await prisma.student.findFirst({ where: studentWhere });
    if (!student) throw new HttpError(403, 'Student is not accessible');
    const term = await resolveTerm(student.schoolId, termRef);
    return { studentWhere, term, terms: termAliases(term), publishedOnly };
  }
  if (termRef) {
    if (!actor.schoolId) throw new HttpError(400, 'Select a school or student to resolve the term');
    const term = await resolveTerm(actor.schoolId, termRef);
    return { studentWhere, term, terms: termAliases(term), publishedOnly };
  }
  return { studentWhere, term: undefined, terms: undefined, publishedOnly };
}
