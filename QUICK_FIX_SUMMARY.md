# Stabilization Summary

## Completed

- Unified API usage around `services/api.ts`.
- Kept `services/cloud-api.ts` and `services/firebase-api.ts` as compatibility wrappers only.
- Fixed auth contract drift (`/api/auth/student`, login fallback behavior).
- Hardened backend profile updates:
  - No implicit user creation
  - No default password creation path
  - Allowed update fields restricted to safe profile properties
- Updated setup docs (`README.md`, backend/deployment notes).
- TypeScript checks pass for frontend and backend.

## Current Baseline

- Frontend and backend compile cleanly.
- Canonical data flow is backend API -> Prisma -> PostgreSQL.
- Supabase remains optional for frontend auth session integration.

## Next Recommended Improvements

1. Add integration tests for auth, students, and attendance routes.
2. Add request-level auth/authorization middleware for protected endpoints.
3. Add CI checks for `tsc`, lint, and backend smoke tests.
