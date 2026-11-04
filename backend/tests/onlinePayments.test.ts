import { afterEach, expect, jest, test } from '@jest/globals';
import { appService } from '../src/services/appService';
import { verifyTransaction } from '../src/services/paystackService';

jest.mock('../src/services/paystackService', () => ({ verifyTransaction: jest.fn() }));
const verify = verifyTransaction as jest.MockedFunction<typeof verifyTransaction>;
const transaction = { status: 'success', currency: 'NGN', amountKobo: 5000, metadata: { ledgerItemId: 'item', schoolId: 'school', actorUserId: 'parent' } };
afterEach(() => { jest.restoreAllMocks(); });

test('a verified gateway payment retains the provider reference for retry deduplication', async () => {
  verify.mockResolvedValue(transaction);
  const record = jest.spyOn(appService, 'recordPayment').mockResolvedValue({ ok: true, data: { id: 'payment', ledgerItemId: 'item', amount: 50, createdAt: '2026-10-05T00:00:00Z' } });
  expect((await appService.recordOnlinePayment('paystack-reference')).data.recorded).toBe(true);
  expect(record).toHaveBeenCalledWith({ ledgerItemId: 'item', schoolId: 'school', amount: 50, method: 'online', paymentRef: 'paystack-reference', clientRef: 'paystack-reference', actorUserId: 'parent' });
});

test.each([
  { currency: 'USD' }, { amountKobo: 0 }, { amountKobo: 50.5 }, { status: 'failed' },
])('invalid gateway transaction does not credit a fee ledger: %j', async invalid => {
  verify.mockResolvedValue({ ...transaction, ...invalid });
  const record = jest.spyOn(appService, 'recordPayment');
  expect((await appService.recordOnlinePayment('paystack-reference')).ok).toBe(false);
  expect(record).not.toHaveBeenCalled();
});
