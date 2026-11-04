# XmartHotel — Architecture

## Overview

A classic two-tier SaaS app: a stateless **Express + Prisma** REST API over
**PostgreSQL**, and a **React + Vite** SPA. Auth is **JWT** (stateless), every
route is guarded by **RBAC**, and every state-changing action writes an **audit
log**. The app is single-tenant per deployment (one hotel/property group per
database) — multi-property is modelled but isolation is per-deployment.

```
┌────────────┐     HTTPS/JSON      ┌─────────────────────┐      ┌────────────┐
│  React SPA │  ───────────────▶   │  Express REST API   │ ───▶ │ PostgreSQL │
│  (Vite)    │   Bearer JWT        │  (feature modules)  │      │  (Prisma)  │
└────────────┘                     └─────────────────────┘      └────────────┘
```

## Backend — feature-based clean architecture

```
backend/
  prisma/
    schema.prisma          # complete domain model (all modules)
    seed.ts                # demo property, rooms, admin
  src/
    core/                  # cross-cutting, framework-level
      env.ts               # validated config (zod)
      prisma.ts            # Prisma client singleton
      auth.ts              # JWT sign/verify, password hashing
      rbac.ts              # requireAuth + requireRole middleware
      audit.ts             # writeAudit()
      http.ts              # asyncHandler, ApiResponse helpers
    modules/               # one folder per feature
      auth/        { auth.routes.ts, auth.service.ts }
      rooms/       { rooms.routes.ts, rooms.service.ts }
      reservations/{ reservations.routes.ts, reservations.service.ts }
      frontdesk/   { frontdesk.routes.ts, frontdesk.service.ts }
      housekeeping/{ housekeeping.routes.ts, housekeeping.service.ts }
      billing/     { billing.routes.ts, billing.service.ts }
      reports/     { reports.routes.ts, reports.service.ts }
    routes.ts              # mounts every module under /api
    server.ts              # bootstrap (helmet, cors, rate-limit, json)
```

**Rules**
- A module owns its routes + service; services hold business logic, routes hold
  HTTP/validation only.
- Cross-module reuse goes through `core/`, never by importing another module's
  internals.
- All input validated with **zod**; all money stored as **integer minor units**
  (kobo/cents) — never floats.

## Frontend — feature-based SPA

```
frontend/src/
  lib/         api.ts (axios + token), types.ts
  context/     AuthContext.tsx
  components/  Layout.tsx, Sidebar.tsx, ui/ (Button, Card, Stat, Table…)
  pages/       Login, Dashboard, Reservations, Rooms, FrontDesk,
               Housekeeping, Billing
  theme.css    design tokens (palette, spacing, radius)
```

The **design system** (palette, typography, sidebar, dashboard layout) is the
shared XamaniX identity — copy it into every product so they feel familiar.

## Security model

- **JWT** access token (12h), `Authorization: Bearer <token>`.
- **RBAC**: `requireRole(...roles)` per route; `OWNER` is unrestricted.
- **Audit**: every create/update/delete writes `{ actorId, action, entity,
  entityId, metadata }`.
- **Hardening**: helmet, CORS allow-list, express-rate-limit, bcrypt hashing,
  zod validation, HTTPS-only in production.

## Data model highlights

`Property` → `RoomType` → `Room`; `Guest` ↔ `Reservation` → `Folio` (`Invoice`
+ `Payment`); `HousekeepingTask`; `MaintenanceRequest`; plus `MenuItem` /
`KitchenOrder`, `InventoryItem` / `StockMovement`, `Staff` / `Shift`, and
`AuditLog`. See `prisma/schema.prisma`.

## Why this scales independently

No shared runtime, no shared DB, no shared package with other XamaniX products.
Promoting to its own repo is a folder copy. Horizontal scaling is the usual
stateless-API + managed-Postgres story.
