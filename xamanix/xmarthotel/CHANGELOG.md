# Changelog

All notable changes to XmartHotel are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: SemVer.

## [0.1.0] — Unreleased (scaffold)
### Added
- Project scaffold: independent backend (Express + Prisma + TS) and frontend
  (React + Vite + TS + Tailwind).
- Complete Prisma data model across all modules (front office, rooms,
  housekeeping, billing, restaurant, inventory, staff, audit).
- JWT auth + Role-Based Access Control + audit logging.
- Core PMS flow: room types & rooms, reservations, front-desk check-in /
  check-out, housekeeping tasks & maintenance, billing folio (charges, payments,
  refunds, computed balance).
- Guest management: profiles, search, stay history, loyalty tier.
- Restaurant module: menu + kitchen orders (room-service orders auto-post to the
  guest folio). Inventory: items + stock movements with low-stock flags.
  Staff: departments, staff records, shift scheduling.
- Reports: KPI dashboard (occupancy, ADR, RevPAR, revenue, room-status board)
  plus a daily revenue series endpoint.
- Design system (sidebar + cards + toasts) and React pages: Login, Dashboard,
  Front Desk, Reservations, Rooms, Housekeeping, Billing.
- Seed script: demo property, room types, rooms, one user per role, sample
  in-house/arrival reservations, menu and inventory data.
- Full documentation set (README, ARCHITECTURE, SETUP, DEPLOYMENT, API,
  CONTRIBUTING) plus a product ROADMAP with market positioning.
- Restaurant, Inventory and Staff UI pages.
- **Direct booking engine** (commission-free): public, embeddable guest pages to
  list room types and book directly, reusing existing guests by phone.
- **QR room-service ordering**: guest-facing menu that posts orders to the folio.
- **Paystack payments** (optional, hosted checkout — no card data touched):
  initialize from a staff folio or a direct booking, verify on return, and a
  signature-verified webhook. Payments are recorded idempotently by reference.
- **Termii notifications** (optional SMS/WhatsApp): automatic booking
  confirmation on direct booking and payment receipt after a Paystack payment.
  Phone numbers are normalised to international format; sends are fire-and-forget
  and never block a booking or payment.
- **Channel manager (OTA distribution):** connect Booking.com / Expedia / Airbnb
  / generic channels, map room types to OTA room codes, an ARI availability
  engine (per-night inventory per room type), a one-click sync that pushes
  availability/rates through a pluggable adapter layer (OTA adapters stubbed
  pending certification), and a token-secured inbound webhook that ingests OTA
  bookings idempotently (by external ref). New Channels UI with an availability
  calendar. Schema: `Channel` model + `Reservation.channel/externalRef`
  (run `prisma db push`).
- **Offline-first PWA:** installable app (manifest + service worker) that boots
  offline from a cached shell, serves cached API reads, and queues writes in an
  IndexedDB outbox — replayed automatically on reconnect — with an offline/sync
  status banner.
- **AI / Insights:** an analytics engine over the property's own data — 30-day
  KPIs with month-over-month deltas, a transparent demand forecast with suggested
  dynamic rates, and explainable no-show risk scoring for upcoming arrivals. A
  natural-language Ask endpoint uses an optional OpenAI-compatible model (set
  `OPENAI_API_KEY`) and falls back to a deterministic summary; the model only
  sees pre-aggregated metrics.

### Verification
- Frontend passes a clean strict `tsc --noEmit` (TypeScript strict,
  noUnusedLocals/Parameters).
- Backend queries reconciled against the Prisma schema (enums, fields, relations).

### Pending (next iterations)
- More notification triggers (check-in welcome, pre-arrival reminders) and a
  WhatsApp booking bot.
- Channel manager (OTA sync) and offline-first PWA.
- Group bookings, room transfers, night audit, loyalty redemption.
