# XmartHR — Architecture

## Shape

Mirrors the XamaniX reference architecture (same as XmartHotel) so the suite stays
consistent while each product remains independently deployable.

```
xmarthr/
  backend/
    prisma/schema.prisma     # Org, User, Department, Position, Employee,
                             # AttendanceRecord, LeaveType, LeaveBalance,
                             # LeaveRequest, SalaryComponent, PayrollRun,
                             # Payslip, AuditLog
    src/
      core/                  # env, prisma, auth (JWT), rbac, http, audit
      modules/
        auth/                # login, me (token carries orgId + employeeId)
        employees/           # CRUD + self (/employees/me)
        org/                 # departments, positions
        attendance/          # clock-in / clock-out / me / team
        leave/               # types, requests, decide, balances
        payroll/             # components, runs, generate, finalize, payslips/me
        reports/             # HR dashboard KPIs
      routes.ts              # mounts everything under /api
      server.ts              # helmet, CORS allow-list, rate limits, error handler
  frontend/
    src/
      lib/                   # api (axios + JWT), format (money/date), types
      context/AuthContext    # session, login/logout
      components/            # Layout (role-aware nav), Toast, ui primitives
      pages/                 # Login, Dashboard, Employees, Attendance, Leave,
                             # Payroll, MyProfile
```

## Security model

- **JWT** bearer tokens (12h). Payload carries `sub`, `role`, `orgId`, and
  `employeeId` so self-service endpoints resolve the caller's own records.
- **RBAC:** `requireRole(...)` — OWNER and HR_ADMIN always pass; MANAGER and
  EMPLOYEE are granted per route. Self-service routes (`/me`, clock-in,
  leave request, payslips) work for any authenticated employee.
- **Audit log** on every state-changing action via `writeAudit`.
- Org-scoping: every query is filtered by the caller's `orgId`.

## Money & correctness

- All monetary values are **integer minor units** (kobo/cents). Payroll computes
  gross = base + earnings, net = gross − deductions, entirely in minor units.
- Attendance is keyed by `(employeeId, date)`; payroll payslips by
  `(runId, employeeId)`; leave balances by `(employeeId, leaveType, year)` — so
  re-running generation or clocking in twice is idempotent.

## Notes

- Single-org per deployment today; the `Org` model and `orgId` scoping leave room
  for multi-tenant later without reshaping the data model.
- Payroll runs are Draft → Finalized; employee payslips surface only once the run
  is finalized.
