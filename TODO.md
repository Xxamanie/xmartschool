# TODO

## High Priority

- [ ] Add route-level authentication middleware for protected backend modules.
- [ ] Add authorization checks (role-based) for admin-only write operations.
- [ ] Add integration tests for:
  - [ ] `POST /api/auth/login`
  - [ ] `POST /api/auth/student`
  - [ ] `GET/POST /api/students/form-masters`
  - [ ] `GET/POST /api/attendance`

## Medium Priority

- [ ] Replace `any` in backend service mappers with explicit Prisma model types.
- [ ] Normalize response shape handling in frontend API client (single helper).
- [ ] Add request/response schema tests for route contracts.

## Low Priority

- [ ] Remove legacy compatibility wrappers once downstream references are retired.
- [ ] Add architecture diagram to README.
