/** Money is handled in INTEGER MINOR UNITS everywhere — convert only for display. */
export function formatMoney(amountMinor: number, currency = 'NGN'): string {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(major);
  } catch {
    return `${currency} ${major.toLocaleString()}`;
  }
}

export function toMinor(major: string | number): number {
  const n = typeof major === 'string' ? Number(major) : major;
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}

export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
