import type { SchoolTerm } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/httpError';

export type ResolvedTerm = SchoolTerm;
const conventional: Record<string, string> = {
  first: 'first', firstterm: 'first', term1: 'first',
  second: 'second', secondterm: 'second', term2: 'second',
  third: 'third', thirdterm: 'third', term3: 'third',
};

/** Persist the returned id; names are accepted only as an explicit legacy bridge. */
export async function resolveTerm(schoolId: string, reference?: string): Promise<ResolvedTerm> {
  if (!schoolId) throw new HttpError(400, 'School context is required');
  const ref = reference?.trim();
  if (!ref || ref === 'current') {
    const current = await prisma.schoolTerm.findMany({ where: { schoolId, isCurrent: true }, take: 2 });
    if (current.length !== 1) throw new HttpError(400, 'Configure exactly one current academic term');
    return current[0];
  }
  const exact = await prisma.schoolTerm.findMany({ where: { schoolId, OR: [{ id: ref }, { name: ref }] }, take: 2 });
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) throw new HttpError(400, 'Select an academic term by its ID');
  const ordinal = conventional[ref.toLowerCase().replace(/[\s_-]/g, '')];
  if (ordinal) {
    const current = await resolveTerm(schoolId);
    const term = await prisma.schoolTerm.findUnique({ where: { schoolId_session_term: { schoolId, session: current.session, term: ordinal } } });
    if (term) return term;
  }
  throw new HttpError(400, 'Academic term is not configured in this school');
}

export function termAliases(term: ResolvedTerm): string[] {
  const ordinal = { first: ['first', 'First Term', 'Term 1', 'Term1'], second: ['second', 'Second Term', 'Term 2', 'Term2'], third: ['third', 'Third Term', 'Term 3', 'Term3'] };
  return [...new Set([term.id, term.name, ...(ordinal[term.term as keyof typeof ordinal] ?? []), ...(term.isCurrent ? ['current'] : [])])];
}
