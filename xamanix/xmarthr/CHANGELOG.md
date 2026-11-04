# Changelog

All notable changes to XmartHR are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: SemVer.

## [0.1.0] — Unreleased (scaffold)
### Added
- Independent backend (Express + Prisma + TS) and frontend (React + Vite + TS +
  Tailwind), reusing the XamaniX reference architecture.
- Complete Prisma data model: Org, User, Department, Position, Employee,
  Attendance, Leave (types/requests/balances), Payroll (components/runs/payslips),
  AuditLog. Money in integer minor units.
- JWT auth + RBAC (OWNER, HR_ADMIN, MANAGER, EMPLOYEE) + audit logging; tokens
  carry orgId and employeeId for self-service.
- Modules: employees (CRUD + self), org (departments/positions), attendance
  (clock in/out, team overview), leave (requests, approvals, balances), payroll
  (components, runs, generate, finalize, self-service payslips), reports
  (HR dashboard KPIs).
- Frontend pages: Login, Dashboard, Employees, Attendance, Leave, Payroll,
  My profile — with the shared design system and role-aware navigation.
- Seed: demo org, departments, positions, leave types, three employees (one
  linked to an EMPLOYEE login), sample attendance and a pending leave request.

### Verification
- Frontend passes a clean strict `tsc --noEmit`.
- Backend queries reconciled against the Prisma schema (run `prisma db push`).

### Added (deepening)
- **Payroll statutory engine** — configurable rules (pension %, levies, and
  progressive PAYE bands with relief) that are **auto-applied** when a run is
  generated, so HR never hand-keys tax/pension. Seeded with Nigeria-style
  defaults; payslips store tax/pension/statutory totals + a full breakdown.
- **Performance** — review cycles, per-employee reviews (rating, strengths,
  improvements, submit), and self-service goals.
- **Printable payslips** — a per-payslip view with print-to-PDF (HR or the owning
  employee), linked from Payroll and My profile.
- **AI / Insights** — workforce KPIs, explainable **attrition-risk** scoring,
  a **leave-coverage forecast** (next 14 days, by department), and a
  natural-language Ask (optional OpenAI-compatible model with deterministic
  fallback; the model only sees aggregated metrics).

### Added (WhatsApp & automation)
- **Termii SMS/WhatsApp notifications** (optional, fire-and-forget): employees are
  auto-notified when payroll is finalized (payslip ready + net pay), when a leave
  request is approved/rejected, and when a performance review is submitted; an
  employee's manager is pinged when they request leave.
- **Announcements** — HR broadcasts a message to everyone or a department over
  WhatsApp or SMS, with delivery counts and history.
- **Mark absentees** — one click flags every active employee with no attendance
  record today as Absent, replacing manual roll-call.

### Added (scheduler & checklists)
- **In-process scheduler** (no external dependency): runs daily automations on a
  cron without anyone clicking — auto-mark absentees, morning clock-in reminders,
  and a pending-leave nudge to managers. Times configurable via env; runs at most
  once per day per job, across all orgs.
- **Onboarding/offboarding checklists** — reusable templates; a checklist
  **auto-starts when an employee is hired** (onboarding) or **terminated**
  (offboarding). HR and the employee tick items; progress and completion track
  automatically. Seeded with standard templates.

### Added (documents & e-signatures)
- **Document storage** — upload files against an employee (stored as base64 in the
  DB for portability; move to object storage in production), list, and secure
  download (HR or the owning employee only).
- **E-signatures** — sign a document by typed name or a drawn signature; each
  signature records the signer, timestamp, and a **SHA-256 hash** of the document
  for tamper-evidence.
- **Checklist automation** — link a document to a checklist step; **signing it
  auto-ticks that step** (and completes the checklist when all steps are done).

### Added (S3 storage & email e-sign)
- **Pluggable document storage** — a storage driver behind one interface: `db`
  (base64, default) or `s3` (any S3-compatible bucket: AWS, MinIO, R2, Spaces).
  Switch with `STORAGE_DRIVER`; the S3 SDK loads lazily so db-only setups don't
  need it. Upload/download/hash all go through the driver.
- **Email e-sign requests** — HR requests a signature from any email address; the
  recipient signs via a secure, expiring **public token link** with no login
  (`/sign/:token`). Optional HTTP email provider sends the link; unconfigured, the
  link is returned to HR to share. Public signing records the tamper-evident hash
  and auto-ticks the linked checklist step, exactly like an in-app signature.

### Pending (next iterations)
- Document templates, reminders on unsigned requests, public API, multi-org
  tenancy, distributed scheduler for multi-replica setups.
