import { prisma } from '../lib/prisma';
import { resolveTerm, termAliases } from './termService';
import { toKobo } from '../utils/money';

export async function getStudentTermClearance(studentId: string, schoolId: string, termReference?: string) {
  const term = await resolveTerm(schoolId, termReference);
  const ledgers = await prisma.studentFeeLedger.findMany({
    where: { studentId, schoolId, term: { in: termAliases(term) } },
    include: { lineItems: { include: { payments: true } } },
  });
  let totalPayableKobo = 0, totalPaidKobo = 0;
  let everyLinePaid = true;
  for (const ledger of ledgers) for (const item of ledger.lineItems) {
    const payable = toKobo(item.payableAmount);
    const paid = item.payments.reduce((sum, payment) => sum + toKobo(payment.amount), 0);
    totalPayableKobo += payable;
    totalPaidKobo += paid;
    if (paid < payable) everyLinePaid = false;
  }
  return { term, totalPayableKobo, totalPaidKobo, outstandingKobo: Math.max(0, totalPayableKobo - totalPaidKobo), cleared: totalPayableKobo > 0 && everyLinePaid };
}
