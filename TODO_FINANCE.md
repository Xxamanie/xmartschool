# Finance / Earnings section (dynamic fee breakdown) - Implementation Notes

Goal: provide an admin/accountant-facing **dynamic** finance/earnings table with per-student breakdown:
- amount payable
- amount payed
- outstanding
- clean table of fee/charge lines (tuition, PTA, lab, sports, etc.)
- columns and titles are created by admin/accountant (no hardcoding)
- serial number auto-generates starting after the title row
- total earning calculated afterwards by default
- NOT hardcoded: must support different schools/charge setups

## Current Repo State
- No finance-related Prisma models exist.
- No backend finance routes/services exist.
- Frontend only has navigation placeholders (e.g. `/finance`, `/fees/record`).

## Implementation Plan (approved)
1. **Prisma models** (school-scoped, term-scoped, and grade/class scoped):
   - Fee template/charge configuration (dynamic list of fee lines)
   - Student fee ledger/schedule for a term
   - Student fee line items mapping to charges
   - Payment records per student per fee line
   - (Outstanding and payable derived or stored)
2. **Migration**
3. **Backend endpoints**:
   - Create/update fee template (charge titles + order)
   - Generate ledger for a given term and scope (class/grade)
   - Record payments (update payed amounts)
   - Get fee breakdown table for a term/scope:
     - returns dynamic charge columns + rows per student
     - includes amount payable, amount payed, outstanding
     - total earning computed
4. **Frontend**:
   - Implement `/finance` page:
     - dynamic table header built from backend charge config
     - serial number auto-generation
     - show payable/payed/outstanding columns per row
     - calculate total earning after data load

## Progress
- [x] Added checklist file `TODO_FINANCE.md`
- [ ] Add Prisma models for finance
- [ ] Add migrations
- [ ] Add backend finance routes + appService
- [ ] Add frontend `/finance` page + dynamic table
- [ ] Run migrations & test end-to-end

