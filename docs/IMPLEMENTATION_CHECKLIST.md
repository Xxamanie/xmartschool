# Implementation and production setup

The requested changes are represented in the application and versioned migration files. Some product features were already present and are now connected to the requested flows. External delivery, storage, payments, and video services require the deployment settings below.

| Request | Implementation |
| --- | --- |
| 1. Class-master school scope | School ownership, unique `(schoolId, grade)` assignments, and school-filtered queries. |
| 2. Prisma migration history | Full historical baseline, incremental migrations, migration-only production startup, and CI schema comparison. See the [migration guide](../backend/prisma/README.md). |
| 3. Payment idempotency | Unique optional `clientRef`, frontend retry reference, and backend handling of repeated payment requests. |
| 4. Assessment ownership | Assignment or form-master ownership is required for teacher gradebook writes. |
| 5. Password reset | Login recovery email, recovery password entry, and administrator temporary-password actions. |
| 6. Scheme upload | Supabase Storage upload stores the resulting public URL on the submission. |
| 7. Term attendance | Current-term Present, Absent, and Late summaries on Attendance. |
| 8. Finance receipts/export | Payment print receipts and ledger CSV download. |
| 9. Student import | CSV template, file validation, and student creation with per-row feedback. |
| 10. Message SSE | Authenticated events stream refreshes Staff Room and Private Messages after inserts. |
| 11. Assessments components | `GradebookView`, `ExamBuilderView`, `ProctoringView`, and `AssessmentsControls` are separate components, with shared state in `useAssessmentsModel`. |
| 12. Critical-path tests | Jest/Supertest authentication, authorization, payment, and assessment coverage, with PostgreSQL integration checks. |
| 13. CI | Pull requests and main/master pushes run both TypeScript checks, migrations, schema comparison, and backend tests. |
| 14. Mock imports | Unused mock data imports removed from the API service. |
| 15. Service query types | Prisma query payload types replace `as any` casts in `appService`. |
| 16. Parent portal | Parent role, linked-child results/attendance/balances, and Paystack payment flow. |
| 17. Live video | Stored meeting links use Whereby with configured credentials and the existing Jitsi fallback. |
| 18. Notification emails | SMTP delivery for notification recipients and student/linked-parent result and payment notifications. |
| 19. Timetable | Class weekly grid connects teacher assignments, subjects, and teachers. Rooms derive from the current `Subject.room` value and appear in the grid, printable view, and CSV; unset rooms display as "Not set". |

## Verification

Local verification passed: 60 backend tests across seven suites, both TypeScript checks, and the frontend/backend production builds. All nine migrations applied to a fresh isolated PostgreSQL database with no schema drift. Browser checks covered the three assessment views, current-term attendance, individual receipt HTML, timetable rooms/printing, and the linked-child parent portal with payment controls. External providers were disabled or mocked for these checks.

Run from the repository root:

```sh
npm ci
npm run typecheck
npm run build
```

Run from `backend`:

```sh
npm ci
npm run prisma:generate
npm run typecheck
npm test
```

Set `TEST_DATABASE_URL` to a dedicated disposable PostgreSQL database to include database-backed tests. Apply the migrations to that database first. Never point the test suite at production data. CI supplies a fresh PostgreSQL database and runs all database-backed checks automatically.

Provider credentials are not supplied by the repository. A successful local test run does not verify actual SMTP delivery, Supabase email/storage permissions, Paystack processing, or hosted video calls; check these configured flows in staging before launch.

## Production environment

- Set `DATABASE_URL` to managed PostgreSQL and use the [migration guide](../backend/prisma/README.md) before upgrading an existing database. Production uses `prisma migrate deploy`.
- Set backend `NODE_ENV=production`, `ENABLE_DEMO_AUTH=false`, and a cryptographically random `SESSION_SECRET` of at least 64 characters. Shorter secrets and enabled demo authentication are rejected in production. For example, generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and store it in the deployment secret manager.
- Set `FRONTEND_URL` to the public application URL. Set **`CORS_ORIGIN`** to a comma-separated list of the actual allowed origins, including scheme and port where applicable. The implemented variable is singular; `CORS_ORIGINS` is not read.
- Configure frontend `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_STORAGE_BUCKET`, and `VITE_ENABLE_DEMO_AUTH=false` at build time. Keep the Supabase service-role key exclusively on the backend.
- Configure Supabase Auth recovery redirect allowlisting for the frontend origin followed by `/?recovery=1`. Recovery tokens are consumed before hash-based routing starts. Verify a complete email-link-to-new-password flow in staging.
- Configure the Supabase Storage bucket and its upload/public-read policies for the intended authenticated users. Scheme submissions retain a public file URL; choose bucket access appropriate to the school's documents.
- Set `SMTP_HOST`, `SMTP_PORT` (usually 587 or 465), `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` for email. Leaving the host unset disables outgoing email while retaining in-app notifications. Set the student email and link the correct parent accounts to deliver results and receipt emails to the intended recipients.
- Set `PAYSTACK_SECRET_KEY` and verify checkout, return, signed webhook, duplicate callback, and balance reconciliation in staging. Use provider test credentials before live credentials.
- Set `WHEREBY_API_KEY` for Whereby room creation, or verify Jitsi room joining in the deployment. Check camera/microphone permissions and the provider's recording support where used.
- Keep real credentials out of tracked files. Production Compose forwards SMTP, video, payment, and optional Termii messaging settings from the deployment environment.
- Run no demo seeds against production. `seed.ts` refuses `NODE_ENV=production`; create real school accounts separately. Check `/api/health` and the Docker health status after deployment.

## Runtime considerations

Message SSE uses in-process pub/sub. Multiple backend replicas need a shared event bus to deliver events across instances. Configure reverse proxies to pass through the event stream without response buffering and permit long-lived connections.

Live-class recording controls currently track recording metadata. Provider recording capture and durable recording storage require additional integration; starting the in-app recording indicator does not create a video file.

SMTP notifications are best effort. Failed delivery is logged and does not roll back the saved notification, published result, or payment. There is no durable retry queue; add a queue and delivery monitoring if guaranteed or retried delivery is required.
