# XmartHR

**HR & Workforce Management** — a XamaniX product.

Employees, departments & positions, attendance (clock in/out), leave management
(requests, approvals, balances), and payroll (salary components, runs, payslips),
with self-service for staff.

> Independent by design: its own backend, frontend, database, and deployment.
> No dependency on any other XamaniX product.

## Modules

| Group | Capabilities | In this scaffold |
|---|---|---|
| **Employees** | Profiles, staff numbers, department/position, manager, employment status, base salary | ✅ |
| **Org structure** | Departments and positions (grades) | ✅ |
| **Attendance** | Clock in/out, late detection, per-day records, team overview | ✅ |
| **Leave** | Leave types, requests, manager approval, yearly balances | ✅ |
| **Payroll** | Salary components, monthly runs, payslip generation, finalize, **auto-applied statutory engine** (pension/PAYE/levies), printable payslips | ✅ |
| **Performance** | Review cycles, reviews (ratings/strengths), self-service goals | ✅ |
| **Self-service** | My profile, my attendance, request leave, my reviews & goals, printable payslips | ✅ |
| **Insights (AI)** | Workforce KPIs, attrition-risk scoring, leave-coverage forecast, natural-language Ask | ✅ |
| **Reports** | Headcount, attendance rate, leave queue, payroll totals, by-department | ✅ KPI dashboard |

### Automation highlights

- **Payroll runs itself:** statutory deductions (pension, PAYE progressive bands,
  levies) are computed automatically from configurable rules — no manual tax math.
- **Notifications go out on their own:** finalize payroll and every employee gets
  a WhatsApp/SMS "payslip ready"; leave decisions, leave requests (to the manager),
  and submitted reviews all notify automatically. Configure `TERMII_API_KEY`
  (channel `whatsapp` or `generic`); unset, notices are skipped.
- **Broadcast in seconds:** Announcements send a message to everyone or a
  department over WhatsApp/SMS with delivery counts.
- **It runs on a schedule, untouched:** a built-in scheduler auto-marks absentees,
  sends morning clock-in reminders, and nudges managers about pending leave — daily,
  with no one clicking (`SCHEDULER_ENABLED`, `REMINDER_HOUR`, `ABSENTEE_HOUR`).
- **Onboarding/offboarding run themselves:** a checklist auto-starts the moment you
  hire or terminate someone; HR and the employee just tick items.
- **Documents & e-signatures close the loop:** upload a contract, link it to a
  checklist step, and when the employee e-signs it (typed or drawn, with a SHA-256
  integrity hash) that step ticks itself. No paper, no chasing.
- **Sign without a login:** email an e-sign request to anyone; they open a secure
  expiring link (`/sign/:token`) and sign — the checklist step still auto-ticks.
- **Storage your way:** documents live in the DB by default, or in S3 / any
  S3-compatible bucket by flipping `STORAGE_DRIVER=s3`.
- **Mark absentees in one click** too, when you want it on demand.
- **Insights surface problems for you:** attrition risk and leave-coverage gaps are
  scored and ranked with plain-language reasons; Ask answers questions over your
  own data.
- **Self-service everywhere:** staff clock in/out, request leave, set goals, and
  download payslips without HR intervention.

Money is stored as **integer minor units** (never floats). Every state-changing
action is recorded in an immutable audit log.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind (port 5174)
- **Backend:** Express + Prisma + PostgreSQL + TypeScript (port 5060)
- **Auth:** JWT + Role-Based Access Control · bcrypt · zod validation · audit log

## Roles

`OWNER` · `HR_ADMIN` · `MANAGER` · `EMPLOYEE` — OWNER and HR_ADMIN have full
access; MANAGER sees team/HR views; EMPLOYEE gets self-service only.

## Quick start

```bash
# 1. Backend
cd backend
cp .env.example .env          # set DATABASE_URL + JWT_SECRET
npm install
npx prisma db push
npm run seed                  # demo org, employees, leave, attendance
npm run dev                   # http://localhost:5060

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5174 (proxies /api → :5060)
```

Demo logins (all `Password1`): **`admin@xmarthr.demo`** (OWNER) ·
`hr@xmarthr.demo` (HR_ADMIN) · `employee@xmarthr.demo` (EMPLOYEE — try clock-in,
leave request, and payslips).

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — structure & data model
- [`CHANGELOG.md`](CHANGELOG.md)
