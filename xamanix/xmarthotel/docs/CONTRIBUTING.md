# Contributing to XmartHotel

## Conventions
- **TypeScript everywhere**, `strict` on. No `any` in new code unless unavoidable.
- **Feature folders**: add a new module under `src/modules/<feature>/` with
  `<feature>.routes.ts` + `<feature>.service.ts`. Routes do HTTP + zod validation;
  services do business logic.
- **Validation**: every request body/query validated with zod.
- **Money**: integer minor units only (kobo/cents). Format at the UI edge.
- **Auth**: never add a route without `requireAuth` (+ `requireRole` where needed).
- **Audit**: every create/update/delete calls `writeAudit(...)`.
- **Naming**: `camelCase` vars, `PascalCase` types/components, kebab-case files for
  routes (`rooms.routes.ts`).

## Frontend
- Reusable primitives live in `components/ui/`. Compose pages from them.
- Keep the shared design tokens (`theme.css`) — that's the XamaniX identity.
- Server-side pagination + debounced search for any list that can grow.

## Workflow
1. Branch from `main`.
2. `npm run typecheck` (both apps) must pass.
3. One feature per PR; update `CHANGELOG.md`.
4. Keep the product **independent** — no imports from other XamaniX products.
