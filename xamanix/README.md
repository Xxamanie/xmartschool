# XamaniX Product Suite

A family of premium, **independent** SaaS products that share one design philosophy,
engineering standard, and user experience — while remaining completely separate
applications. Each product can be developed, deployed, scaled, monetised, and
evolved on its own.

> **This folder is a staging area.** Each product here is self-contained and is
> meant to be lifted out into its own repository
> (`github.com/xmart/<product>`). Nothing in this folder depends on the
> XmartSchool app that lives in the parent repo, and no product depends on
> another.

## Core philosophy

- Every XamaniX product is a **complete** software product. A customer can buy and
  use any one without needing another.
- The ecosystem grows by **adding products**, not by coupling them.
- **No cross-repository dependencies** until duplication clearly justifies a shared
  library (`xmart-ui`, `xmart-auth`, etc.) — and even then those stay *optional*.

## Products

| Product | Domain | Status |
|---|---|---|
| **XmartSchool** | School management | ✅ Flagship (in production prep, parent repo) |
| **XmartHotel** | Hotel / hospitality PMS | 🟢 Built here (`./xmarthotel`) — PMS, OTA channel manager, payments, WhatsApp, offline PWA, AI insights |
| **XmartHR** | Human resources | 🟡 Scaffolded here (`./xmarthr`) — employees, attendance, leave, payroll, self-service |
| **XmartHealth** | Hospital / clinic | 🔜 Planned |
| **XmartEstate** | Property / estate | 🔜 Planned |

Future: XmartFinance, XmartPOS, XmartCRM, XmartERP, XmartInventory, XmartLearn,
XmartCBT, XmartPay, XmartChurch, XmartNGO, XmartGov, XmartFleet, XmartAI.

## Shared engineering standards (every product follows these)

**Stack** — React + Vite + TypeScript + Tailwind (frontend); Express + Prisma +
PostgreSQL + TypeScript (backend). Chosen for a consistent identity across the suite.

**Architecture** — Clean, **feature-based** folders; reusable local components;
strong typing; modular services; clear naming.

**Security** — JWT auth, Role-Based Access Control, password hashing (bcrypt),
input validation (zod), audit logs, rate limiting, secure uploads, HTTPS-only.

**Performance** — fast first load, code splitting, lazy loading, server-side
pagination, debounced search, optimistic UI, efficient caching.

**Design** — one palette, typography, spacing, dashboard layout, navigation,
iconography, and motion across products. Inspiration: Stripe · Linear · Atlassian ·
Notion · Microsoft 365 · Vercel. **No generic admin templates.**

**Docs** — every product ships a README, Architecture overview, Setup guide, Env
reference, Deployment guide, API docs, Contribution guide, and Changelog.

## Deployment model

Each product has its **own** backend, frontend, database, CI/CD, hosting, domain,
SSL, monitoring, and environment variables. Example domains:

```
school.XamaniX.africa   hr.XamaniX.africa
hotel.XamaniX.africa    health.XamaniX.africa   estate.XamaniX.africa
```

## Working in this folder

```
xamanix/
  README.md          ← you are here
  xmarthotel/        ← independent app (backend/ + frontend/)
```

To promote a product to its own repo: copy its folder out, `git init`, push to
`github.com/xmart/<product>`. It will run unchanged.
