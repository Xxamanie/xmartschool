import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../utils/httpError';
import { fromKobo, toKobo } from '../utils/money';

type PaymentInput = { ledgerItemId: string; amount: number; method?: string; paymentRef?: string; clientRef?: string; schoolId: string };

export async function insertPayment(input: PaymentInput) {
  const replay = (payment: Prisma.StudentFeePaymentGetPayload<object>) => {
    if (payment.ledgerItemId !== input.ledgerItemId || toKobo(payment.amount) !== toKobo(input.amount) ||
      payment.method !== (input.method ?? null) || payment.paymentRef !== (input.paymentRef ?? null)) {
      throw new HttpError(409, 'This payment reference was already used for different payment details');
    }
    return { payment, replayed: true };
  };
  try {
    return await prisma.$transaction(async tx => {
      // Serialise payments for the same fee line before calculating its balance.
      await tx.$queryRaw`SELECT id FROM "StudentFeeLedgerItem" WHERE id = ${input.ledgerItemId} FOR UPDATE`;
      const item = await tx.studentFeeLedgerItem.findUnique({
        where: { id: input.ledgerItemId },
        include: { ledger: { select: { schoolId: true } }, payments: { select: { amount: true } } },
      });
      if (!item || item.ledger.schoolId !== input.schoolId) throw new HttpError(403, 'Fee item is not accessible');
      if (input.clientRef) {
        const existing = await tx.studentFeePayment.findUnique({ where: { clientRef: input.clientRef } });
        if (existing) return replay(existing);
      }
      const amountKobo = toKobo(input.amount);
      const payableKobo = toKobo(item.payableAmount);
      const paidKobo = item.payments.reduce((sum, payment) => sum + toKobo(payment.amount), 0);
      if (amountKobo <= 0 || paidKobo + amountKobo > payableKobo) {
        throw new HttpError(400, 'Payment amount exceeds the outstanding balance or is invalid');
      }
      const payment = await tx.studentFeePayment.create({ data: {
        ledgerItemId: input.ledgerItemId, amount: fromKobo(amountKobo), method: input.method ?? null,
        paymentRef: input.paymentRef ?? null, clientRef: input.clientRef ?? null,
      } });
      return { payment, replayed: false };
    });
  } catch (error) {
    if (input.clientRef && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.studentFeePayment.findUnique({ where: { clientRef: input.clientRef } });
      if (existing) return replay(existing);
    }
    throw error;
  }
}
