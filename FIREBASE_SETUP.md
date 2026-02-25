# Firebase Setup (Current State)

This project no longer uses Firebase as the primary data API layer.

## Current Architecture

- Frontend calls `services/api.ts` (canonical client).
- Backend serves data via Express + Prisma + PostgreSQL.
- Supabase is optional for auth/session in the frontend.
- `services/firebase-api.ts` exists only as a compatibility wrapper and delegates to `services/api.ts`.

## When to Use Firebase Here

Use Firebase only if you explicitly decide to move hosting/auth/storage concerns there.  
Do not replace the main data flow with direct Firebase CRUD unless you intentionally re-architect the backend.

## If You Need Hosting Only

You can deploy the frontend to Firebase Hosting while still using the Render backend:
- Frontend: Firebase Hosting
- Backend API: Render (`/api/*`)
- Database: PostgreSQL (via Prisma)

See [README.md](./README.md) and [DEPLOYMENT_SETUP.md](./DEPLOYMENT_SETUP.md) for the active setup flow.
