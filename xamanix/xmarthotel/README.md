# XmartHotel

**Hotel & Hospitality Management System** — a XamaniX product.

Front office, reservations, rooms, housekeeping, billing, restaurant POS,
inventory, staff, and analytics for hotels, lodges, and serviced apartments.

> Independent by design: its own backend, frontend, database, and deployment.
> No dependency on any other XamaniX product.

## Modules

| Group | Capabilities | In this scaffold |
|---|---|---|
| **Front Office** | Reservations, check-in / check-out, walk-ins, room allocation, room transfers, group bookings | ✅ core flow |
| **Guest Management** | Guest profiles, stay history, ID verification, loyalty, special requests | ✅ profiles + history |
| **Room Management** | Room types, room status, occupancy, maintenance blocks, pricing | ✅ |
| **Housekeeping** | Cleaning schedules, inspections, linen tracking, maintenance requests | ✅ |
| **Billing & Finance** | Invoicing, multiple payment methods, refunds, discounts, taxes, night audit | ✅ invoicing + payments |
| **Restaurant (optional)** | POS, kitchen orders, menu management, room service (auto-posts to guest folio) | ✅ menu + orders |
| **Inventory** | Consumables, amenities, stock movements, low-stock alerts | ✅ items + movements |
| **Staff** | Departments, staff records, shift scheduling | ✅ departments + shifts |
| **Reports** | Occupancy, revenue, ADR, RevPAR, room-status board | ✅ KPI dashboard + revenue series |

The **data model covers every module** (see `backend/prisma/schema.prisma`). The
core guest journey (reserve → check-in → housekeeping → bill → check-out) is built
end-to-end, and every module ships working REST endpoints plus a React UI page:
Dashboard, Front Desk, Reservations, Rooms, Housekeeping, Billing, Restaurant,
Inventory, and Staff.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind
- **Backend:** Express + Prisma + PostgreSQL + TypeScript
- **Auth:** JWT + Role-Based Access Control · bcrypt · zod validation · audit log

## Quick start

```bash
# 1. Backend
cd backend
cp .env.example .env          # set DATABASE_URL + JWT_SECRET
npm install
npx prisma migrate dev        # or: npx prisma db push
npm run seed                  # demo hotel, rooms, admin login
npm run dev                   # http://localhost:5050

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api → :5050)
```

Default login after seeding: **`admin@xmarthotel.demo` / `Password1`**.

## Guest-facing pages (no login)

- **Direct booking:** `/book` (or `/book/:propertyId`) — commission-free booking.
- **QR room-service:** `/order/:propertyId?room=201` — encode this in a room QR.
- **Payment return:** `/payment/callback` — where Paystack redirects after paying.

## Payments (Paystack — optional)

Set `PAYSTACK_SECRET_KEY` (use a `sk_test_...` key locally) and `PUBLIC_BASE_URL`
in the backend `.env`. Without them, payment buttons fall back to pay-on-arrival.
Checkout is **hosted by Paystack** — the app never handles card data. Configure
the Paystack dashboard webhook to `POST {API}/api/payments/webhook`. Payments are
recorded idempotently by reference (verify-on-return + webhook).

## Notifications (Termii — optional)

Set `TERMII_API_KEY` (and optionally `TERMII_SENDER_ID`, `TERMII_CHANNEL` =
`generic`/`dnd`/`whatsapp`) in the backend `.env`. The guest then receives an SMS
or WhatsApp **booking confirmation** on direct booking and a **payment receipt**
after paying. Unconfigured, these are silently skipped. Phone numbers are
normalised using `DEFAULT_COUNTRY_CODE` (e.g. `0803…` → `234803…`).

## Channel manager (OTA distribution)

Connect Booking.com / Expedia / Airbnb / generic channels under **Channels**
(manager+). Map each room type to the OTA's room code, then **Sync** to push
availability + rates (computed by the ARI engine — per-night inventory per room
type). Real OTA APIs need partner certification, so adapters are stubbed behind a
clean interface and currently compute without pushing live. Inbound OTA bookings
arrive at the per-channel webhook `POST /api/channels/:id/ingest?token=…` and are
created idempotently (deduped by the OTA's booking ref). After pulling this
update, run `npx prisma db push` to add the `Channel` table.

## Offline-first

XmartHotel is an installable PWA. It boots from a cached shell with no
connection, serves the last-known API reads from cache, and **queues any writes**
(check-in, status changes, charges…) in an on-device outbox that replays
automatically when you reconnect — a status bar shows offline/sync state.

## Insights (AI)

The **Insights** page (manager/accountant) turns your own data into decisions:
30-day KPIs with month-over-month deltas, a **demand forecast + suggested rates**
(transparent rules: rate multipliers driven by projected occupancy and weekends),
and **no-show risk** scoring for upcoming arrivals with explainable reasons. An
**Ask** box answers free-form questions; set `OPENAI_API_KEY` for narrative
answers, otherwise it returns a computed summary. The model only ever sees
pre-aggregated metrics — never raw guest records.

## Documentation

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — market positioning & feature priorities
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system & folder structure
- [`docs/SETUP.md`](docs/SETUP.md) — local development
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production deployment
- [`docs/API.md`](docs/API.md) — REST API reference
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — conventions
- [`CHANGELOG.md`](CHANGELOG.md)

## Roles

`OWNER` · `MANAGER` · `FRONT_DESK` · `HOUSEKEEPING` · `ACCOUNTANT` · `STAFF` —
enforced by RBAC middleware on every route.
