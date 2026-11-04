import { HttpError } from './httpError';

/** All ledger arithmetic uses integer kobo; Decimal values cross the API as numbers. */
export function toKobo(value: number | string | { toString(): string }): number {
  const number = Number(value);
  const scaled = number * 100;
  const rounded = Math.round(scaled);
  if (!Number.isFinite(number) || !Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > 0.000001) {
    throw new HttpError(400, 'Amounts must be finite values with at most two decimal places');
  }
  return rounded;
}

export const fromKobo = (value: number): number => value / 100;
