# Making Earnings an Audit-Grade, Dependable Core

A plan to evolve the fee/earnings module (`backend/src/routes/modules/finance.ts`,
`appService.recordPayment / generateLedger / getSchoolFinanceSummary`, the
`FeeTemplate / StudentFeeLedger / StudentFeeLedgerItem / StudentFeePayment`
models, and `pages/Finance.tsx`) into a tool school owners trust for
accountability, audit, and resilience.

## Where it stands today (the good base)

- `recordPayment` is **idempotent** (`clientRef @unique`), runs inside a **transaction**, and **rejects overpayment** (`alreadyPaid + amount > payableAmount`).
- Each payment writes a **`RECORD_PAYMENT` audit log** with the acting user, amount, method, student, and ledger item.
- Full payment auto-triggers **fee clearance → Result PIN → parent notification**.

So the principle of "every naira is a recorded event" already exists. The gaps
are about **accuracy, immutability, reconciliation, and provability**.

---

## 1. Accuracy & resilience — fix the money primitives first

These are non-negotiable for anything owners audit.

- **Stop storing money as `Float`.** `amount`, `payableAmount`, `defaultAmount` are `Float` — floating point silently loses kobo and creates totals that don't reconcile. Switch to **integer minor units (kobo)** or Prisma `Decimal`. Integer kobo is simplest and exact. Migration: multiply existing values ×100, change column type, and format at the edges (₦ in the UI).
- **Close the concurrency race.** `recordPayment` reads `payments` then writes — two simultaneous payments on the same item can both pass the overpayment check. Wrap the read+write in a **`Serializable` transaction** (Supabase Postgres supports it) or take a row lock (`SELECT … FOR UPDATE` on the ledger item) so the guard is atomic under load.
- **Validate at the boundary with money rules:** positive, within payable, sane max, allowed `method` (make it an **enum**: `cash | transfer | pos | cheque | online`), not free text.

## 2. Accountability — immutable ledger + reversals (never edit/delete)

Owners and auditors must be able to say "nothing here was quietly changed."

- **Make payments append-only.** Never UPDATE or DELETE a `StudentFeePayment`. Corrections happen by posting a **reversing entry** (a negative/contra payment that references the original `reversesPaymentId`, with a reason and approver). The net is always derivable; history is intact.
- **Add who/what to the row itself**, not only the audit log: `recordedBy` (User id), `recordedByName` (denormalized for receipts/statements), `reversedAt`, `reversedBy`, `reversalReason`. The row becomes self-describing for statements and disputes.
- **Receipt numbers.** Add a **monotonic, per-school receipt sequence** (`receiptNo`, e.g. `GFD-101/2025/000142`). Every payment and reversal gets one. This is what parents quote and auditors trace.
- **Treat discounts/waivers/scholarships as explicit, approved adjustments** — a typed ledger adjustment with an approver and reason — never a silent edit to `payableAmount`.

## 3. Ease of audit — coverage, statements, exports

- **Audit every finance mutation, not just payments.** Today `POST /templates`, `DELETE /templates/:id`, and `ledgers/generate` are **not** audited. Add `CREATE_FEE_TEMPLATE`, `DELETE_FEE_TEMPLATE`, `GENERATE_LEDGER`, `REVERSE_PAYMENT`, `WAIVE_FEE` audit entries with actor + before/after.
- **Block destructive template deletes.** `prisma.feeTemplate.delete` hard-deletes; if ledgers reference it this either fails or orphans history. **Soft-delete** templates (or refuse deletion when ledgers exist) so the basis of past charges is never lost.
- **Per-student Statement of Account:** a single view/endpoint listing every charge and payment with a **running balance** and receipt numbers — the document a parent or auditor asks for.
- **Exportable, timestamped reports** (CSV + PDF): Payment Journal (date range), Fee Register (who owes what), Outstanding/Arrears with **aging buckets (0–30 / 31–60 / 60+ days)**, and Daily Collection report by method and cashier. Exports should record who generated them and when.

## 4. Reconciliation — the owner's daily control

This is what turns "data entry" into "accountability."

- **Daily cash-up / close-of-day:** totals collected per day, **split by method and by cashier**, with a one-click **"Close Day"** that snapshots the totals and **locks** them. After close, that day's figures can't change without a visible, audited adjustment in a later period.
- **Bank/POS reconciliation:** let an admin mark each transfer/POS payment as *reconciled* against a bank statement line (import CSV later). Unreconciled vs reconciled is the owner's daily worry — surface it.
- **Segregation of duties (RBAC):** add a dedicated **`BURSAR`/`ACCOUNTANT`** role. The person who *sets fees* should differ from who *collects* and who *reconciles/closes*. Reversals and waivers require an `ADMIN` approver. This alone massively raises trust.

## 5. Tamper-evidence — the premium accountability feature

- **Hash-chain the finance journal.** Each payment/reversal stores `prevHash` + `hash = SHA256(prevHash + canonical(entry))`. Any later edit to a historical row breaks the chain, making tampering *detectable*, not just discouraged. Cheap to add, and a strong selling point: "our books are cryptographically verifiable."

## 6. Dependability — operations

- **Point-in-time recovery:** financial data warrants Supabase Pro **daily backups + PITR**, plus a periodic off-platform export of the payment journal.
- **Anomaly alerts:** notify the owner on large payments, any reversal, after-hours entries, or a day closed with a variance — turn the audit log into proactive signals.
- **Idempotency end-to-end:** keep the `clientRef` pattern and surface it in receipts so a retried request can never double-charge.
- **A finance audit view in-app:** a read-only, filterable timeline of every finance audit entry (already captured) so owners self-serve instead of asking for DB dumps.

---

## Suggested phasing

**Phase 1 — Integrity (do first, low risk, high trust)**
Integer kobo money · serializable/locked `recordPayment` · `method` enum · audit the template/ledger/reversal actions · soft-delete templates.

**Phase 2 — Accountability surface**
Append-only payments + reversing entries · `recordedBy` + receipt numbers · per-student Statement of Account · CSV/PDF exports with arrears aging.

**Phase 3 — Control & trust**
Daily close + lock · method/cashier reconciliation · `BURSAR` role + segregation of duties · anomaly alerts.

**Phase 4 — Premium assurance**
Hash-chained journal (tamper-evidence) · bank-statement import reconciliation · owner finance dashboard with snapshots.

Phase 1 is the foundation everything else relies on (you can't audit floating-point money). It's also the smallest, safest change set.
