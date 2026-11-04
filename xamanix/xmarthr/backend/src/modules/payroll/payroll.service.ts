import type { StatutoryRule } from '@prisma/client';

/**
 * Statutory deductions engine — auto-applied during payroll so HR never hand-keys
 * tax/pension. All amounts are integer minor units. Rules are configurable per
 * org; pension/levy reduce taxable income, then PAYE bands apply to the remainder.
 * Bands are evaluated on the monthly figure (payroll runs monthly). Simplified —
 * tune the seeded rates/bands to the exact statutory schedule for production.
 */
export interface StatutoryLine { name: string; kind: string; amountMinor: number; }
export interface StatutoryResult { lines: StatutoryLine[]; totalMinor: number; taxMinor: number; pensionMinor: number; }

interface Band { uptoMinor: number | null; rateBps: number }

export function computeStatutory(grossMinor: number, basicMinor: number, rules: StatutoryRule[]): StatutoryResult {
  const lines: StatutoryLine[] = [];
  let pensionMinor = 0;
  let preTaxDeductions = 0;

  const active = rules.filter((r) => r.active).sort((a, b) => a.order - b.order);

  // Pass 1 — pension / levy / other (these reduce taxable income).
  for (const r of active) {
    if (r.method === 'PayeBands') continue;
    let amt = 0;
    if (r.method === 'PercentOfBasic') amt = Math.round((basicMinor * r.rateBps) / 10000);
    else if (r.method === 'PercentOfGross') amt = Math.round((grossMinor * r.rateBps) / 10000);
    else if (r.method === 'Fixed') amt = r.fixedMinor;
    if (amt <= 0) continue;
    lines.push({ name: r.name, kind: r.kind, amountMinor: amt });
    if (r.kind === 'Pension') pensionMinor += amt;
    preTaxDeductions += amt;
  }

  // Pass 2 — PAYE on taxable = gross − relief − pre-tax deductions.
  let taxMinor = 0;
  const taxRule = active.find((r) => r.method === 'PayeBands');
  if (taxRule) {
    const relief = Math.round((grossMinor * taxRule.reliefBps) / 10000);
    const taxable = Math.max(0, grossMinor - relief - preTaxDeductions);
    const bands = (taxRule.bands as unknown as Band[] | null) ?? [];
    let remaining = taxable;
    let lower = 0;
    for (const band of bands) {
      const cap = band.uptoMinor == null ? Number.POSITIVE_INFINITY : band.uptoMinor;
      const slice = Math.max(0, Math.min(remaining, cap - lower));
      if (slice > 0) {
        taxMinor += Math.round((slice * band.rateBps) / 10000);
        remaining -= slice;
      }
      lower = cap;
      if (remaining <= 0) break;
    }
    if (taxMinor > 0) lines.push({ name: taxRule.name, kind: 'Tax', amountMinor: taxMinor });
  }

  const totalMinor = lines.reduce((s, l) => s + l.amountMinor, 0);
  return { lines, totalMinor, taxMinor, pensionMinor };
}
