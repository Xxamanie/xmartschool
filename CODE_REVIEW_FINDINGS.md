# SmartSchool — Code Review Findings

Date: 2026-06-14
Scope: full repo (`backend/` Express+Prisma API, root React/TS frontend)

This document summarizes bugs, lapses, faults, inconsistencies, and frontend↔backend
gaps found during a full review of the codebase.

---

## 0. Top Priority (fix first)

1. **Real secrets committed to the repo.** `backend/.env`, `backend/.env.development`,
   and `backend/.env.production.example` all contain a real Supabase Postgres password
   (`Hard2dieat427333`) and a real-looking `SUPABASE_SERVICE_ROLE_KEY` JWT, in plaintext.
   **Rotate the DB password and service role key immediately**, then scrub git history
   and remove secrets from any "`.example`" files.

2. **Authentication bypass via demo mode.** `appService.login` has a fallback path
   (active when `ENABLE_DEMO_AUTH=true`, which it is in `.env` / `.env.development`)
   that grants a session with **no password check** for any email containing
   `"admin"`/`"teacher"`/`"alex"`, or for `creator@smartschool.edu` (SUPER_ADMIN) with
   an empty password. If this flag is ever true in a deployed environment, anyone can
   log in as an admin. Confirm it's `false`/unset in production and consider removing
   the email-pattern fallback entirely (keep only an explicit allowlist of demo
   accounts, if needed at all).

3. **"Start Recording" in Live Classes is broken end-to-end.**
   `LiveClassRoom.tsx` builds `recordingUrl = "${classId}-recording-${Date.now()}"`
   (e.g. `abc123-recording-1718380800000`) and POSTs it to
   `/live-classes/:id/recording/start`. The backend schema is
   `z.object({ recordingUrl: z.string().url().max(2048) })` — a non-URL string fails
   Zod validation and the request 400s every time. Either generate/store a real URL
   (e.g. from the recording provider) or relax the backend validation.

4. **Cross-tenant data leak in teacher assignments.**
   `GET /api/teacher-assignments/?classId=xxx` has **no role check and no
   school-ownership check** on `classId`. Any authenticated user (including STUDENT/
   PARENT) can pass a `classId` from a different school and read that school's
   teacher/subject assignment data. Add `requireRole` + verify the class belongs to
   the caller's school (or is SUPER_ADMIN).

---

## 1. Backend Issues

### Dead / duplicated code
- `backend/src/data/mockData.ts` — not imported anywhere, dead file.
- `POST /api/auth/student` is an exact duplicate of `POST /api/auth/verify-student`.
- `POST /api/assessments/save` duplicates `PUT /api/assessments/`.
- `POST /api/results/publish` duplicates `POST /api/results/`.
- `POST /api/attendance/batch` duplicates `POST /api/attendance/`.
- `/api/exam-sessions/*` and `/api/exams/:id/sessions/*` are two parallel
  implementations of the same start/progress/submit/reset flow, with slightly
  different validation (exam-sessions enforces 2000-char/500-key answer limits,
  the exams.ts builder path doesn't). Pick one and remove the other.
- `studentField.ts` imports `enforceTenantQuery` but never uses it.

### Inconsistent response shapes
- `GET /api/students/my-profile` returns `{ ok, data: {id, name, feeCleared} }`
  instead of the standard `ApiResponse<Student>`.
- `PUT /api/subjects/:id` / `DELETE /api/subjects/:id` return **raw Prisma rows**
  (nullable `schedule`/`room`/`teacherId`, includes `schoolId`) instead of going
  through `mapSubjectModel` like `GET /api/subjects/` does (which defaults
  `schedule`/`room` to `'TBD'`). Frontend code consuming the PUT/DELETE response
  could show `null` where it expects `'TBD'`.
- `GET /api/results/` for STUDENT role can return an extra top-level `feeStatus`
  field (`'not_cleared' | 'pin_required' | 'results_not_published'`) alongside
  `{ ok: false, data: null, message }` — not part of `ApiResponse<T>`. Frontend
  has to special-case this with `as any`.
- `/api/finance/templates*` responses skip the `message` field that most other
  endpoints include — harmless but inconsistent.
- Many handlers `catch (error)` generically and return `{ ok: false, message }`
  with **HTTP 200** rather than a 4xx/5xx — frontend must check `.ok` on every
  call, and several call sites don't (see Frontend section).

### Missing/weak validation
- `POST /api/live-classes/:id/participant-status` (`{cameraOn, microphoneOn}`) and
  `/raise-hand` (`{raised}`) and `/recording/stop` (`{duration}`) read `req.body`
  directly with **no zod schema** — bad input causes a Prisma type error (500)
  instead of a clean 400.
- `POST /api/students/` allows `field` as an arbitrary string (no enum), while
  `PUT /api/students/:studentId/field` enforces
  `'science'|'arts'|'business'|'general'`. A student can be created with an
  invalid `field` value via the first endpoint.

### Authorization edge cases
- `GET/POST /api/students/form-masters` use `req.auth!.schoolId!` — for a
  SUPER_ADMIN (no `schoolId`), this is `undefined!`, and Prisma treats
  `schoolId: undefined` as "no filter," returning **all schools'** class-master
  data instead of erroring like `GET /api/class-masters/` does.
- `GET/POST /api/staff-room/` 400 if `schoolId` is missing — meaning a
  SUPER_ADMIN (who never has a `schoolId`) can **never** use staff-room endpoints,
  with no way to pass a target school via query/body like other modules allow.
- `GET /api/exams/available` always passes `includeAnswers=false`, even for
  ADMIN/TEACHER/SUPER_ADMIN — `GET /api/exams/` includes answers for those roles.
  Confirm this asymmetry is intentional.

### Data-model / naming inconsistencies
- `NotificationAudience` has three different definitions that don't agree:
  Prisma enum and the zod schema in `notifications.ts` include `'class_students'`,
  but `backend/src/types.ts`'s `NotificationAudience` type omits it.
- `createNotification`'s `class_students` / `previewNotificationRecipients`
  branches **overload** `userIds[0]` and `schoolId` params to actually mean
  `classId` — documented in comments but fragile if these paths diverge.
- `appService.createParent` returns `authToken: tempPassword` — i.e. the field
  normally used for a signed session token here actually holds a **plaintext
  temporary password**. Rename to avoid confusion/misuse (e.g. `tempPassword`).

### Performance / race conditions
- `markAttendance`, `publishResults`, `getAssessments` (subject-teacher path), and
  `generateLedger` all do per-item DB calls in loops (N+1 patterns); `publishResults`
  even loops sequentially (not `Promise.all`) over students after publishing.
- `recordPayment`'s idempotency check (`clientRef` lookup) happens outside the
  creating transaction — two concurrent requests with the same `clientRef` can both
  pass the check and race on the DB's unique constraint, surfacing as an unhandled
  500 instead of a friendly "already recorded" response.
- `createStudent`'s access-code generation has the same check-then-insert race on
  the unique `accessCode` column.

### Other
- `appService.recordProctorFrame` is a stub (logs first 64 chars, never persists),
  yet the endpoint accepts payloads up to 2MB — wasted bandwidth for a no-op.
- `.env.production.example` is malformed: a duplicated, **unterminated** quoted
  `DATABASE_URL` string (missing closing `"` and `?sslmode=require`), and it's
  missing `SESSION_SECRET` (required, min 32 chars) — copying this file as-is
  will crash the app on startup.
- `.env.example` doesn't document `WHEREBY_API_KEY` or `ENABLE_DEMO_AUTH`, both of
  which are read by the app.

---

## 2. Frontend Issues

### Fabricated/demo data presented as real
- **Timetable.tsx** builds the entire weekly class timetable client-side from
  teacher-assignment data via a "distribute evenly" heuristic — there's no real
  scheduling data behind it, yet it's presented (and printable/exportable) as the
  actual class timetable.
- **StudentPortal.tsx** dashboard header has hardcoded `"Class of 2024 • Grade 10"`,
  `98%` attendance, and `"Term 1, 2024"` regardless of actual student data.
- **AuthContext.tsx** `impersonateSchool` fabricates a synthetic admin `User`
  (`id: imp_<schoolId>`, fake email, `ui-avatars.com` avatar) instead of using a
  real admin record.
- **SchemeOfWork.tsx** after upload, builds a fake local list entry
  (`id: Math.random()...`, `status: 'Pending'`) instead of using the server
  response, and hardcodes `year: '2024'` on every upload.
- `api.getSchemes()` silently falls back to an empty list on error, masking real
  backend failures as "no schemes yet."

### Dead UI / non-functional controls
- SuperAdmin.tsx: `handleViewUser` is a no-op; "Reset Password" and "Ban User"
  buttons have no handlers.
- SchoolDetail.tsx: "Settings" button has no `onClick`.
- StaffRoom.tsx: emoji button has no `onClick`.
- SchemeOfWork.tsx: preview/download buttons on history rows have no `onClick`.
- Settings.tsx: "Change Avatar" button has no `onClick`.
- Finance.tsx exists and is routed for ADMIN/SUPER_ADMIN, but there's no sidebar
  link to it (only reachable by typing the URL).

### Type-safety / env issues
- `vite-env.d.ts` declares `GEMINI_API_KEY` (missing required `VITE_` prefix, so it
  would never actually be exposed) and is **missing** `VITE_ENABLE_DEMO_AUTH`, which
  `AuthContext.tsx` actually reads.
- `VITE_GEMINI_API_KEY` is declared in `.env.production.example` but never read by
  any frontend code (AI calls go through the backend) — dead env var, possibly
  confusing for deployers.
- Several components use `any` for important state: `LiveClassRoom.tsx`
  (`liveClass`, `participants`, `messages`), `Settings.tsx` (`auditLogs`),
  `Finance.tsx` (`templates`, `lines`).

### React bugs / anti-patterns
- StudentPortal.tsx exam timer effect calls `handleSubmitExam()` on timeout but
  doesn't list it as a dependency (stale-closure risk).
- StudentPortal.tsx `handleExitExam()` does a full `window.location.reload()`,
  dropping SPA state.
- StudentPortal.tsx GPA is computed from `results` before the PIN unlock populates
  it, so it shows `0.00` until unlock.
- Notifications.tsx marks notifications read locally without checking
  `api.markNotificationRead(id)`'s `.ok` — UI can drift from server state on failure.
- PhotoUpload.tsx loading overlay uses `absolute inset-0` without the parent having
  `position: relative` — likely mispositioned.
- Print flows (Timetable, Finance receipt, ParentPortal receipt) silently no-op if
  the popup is blocked, with no user feedback, and duplicate the same
  `window.open` + `document.write` boilerplate three times.

### Duplicated logic
- The same character-sum "color from id/name" hash function is reimplemented in
  StaffRoom.tsx, PrivateMessages.tsx, and Timetable.tsx — extract to a shared util.

---

## 3. Frontend ↔ Backend Gaps (cross-check)

These are confirmed by reading both sides:

| Area | Frontend expectation | Backend reality | Impact |
|---|---|---|---|
| Live class recording start | Sends a non-URL id string as `recordingUrl` | Zod requires `.url()` | **Feature broken (400 every time)** — see Top Priority #3 |
| `PUT /subjects/:id`, `DELETE /subjects/:id` | Expects `Subject` shape matching `GET /subjects` (`schedule`/`room` default `'TBD'`, no `schoolId`) | Returns raw Prisma row (`schoolId` present, `schedule`/`room`/`teacherId` nullable) | Possible `null`/`undefined` rendering after edit/delete until next full refetch |
| `GET /results` (student) | Reads extra `feeStatus` via `(res as any).feeStatus` | Only present for STUDENT role and only on the failure path | Works today but fragile/undocumented coupling |
| Teacher assignments by `classId` | `api.getClassAssignments(classId)` used in Timetable/Classes | No tenant check server-side | Cross-tenant data exposure (Top Priority #4) |
| `NotificationAudience` | Frontend type includes `class_students` | Matches Prisma/zod, but **not** `backend/src/types.ts` | Internal backend inconsistency; frontend currently fine since it talks to the route, not `types.ts` |
| `/api/auth/change-password` | Frontend calls it (assumed POST) | Exists under `PUT`-style profile auth group — verify method matches frontend's axios call | Verify before relying on it; mismatch would 404 |
| Error responses | Frontend generally checks `response.data.ok` | Many backend errors return HTTP 200 with `ok:false`, others throw real 4xx/5xx (zod `ZodError` → 400) | Inconsistent — some `await api.x()` call sites don't check `.ok` (e.g. Notifications "mark read"), so failures are silently swallowed |
| Fee templates / audit logs | Typed as `any[]` on frontend | Backend returns concrete shapes (`FeeTemplate[]`, audit entries) | No compile-time safety; drift between the two will go unnoticed |

---

## 4. Suggested Next Steps (priority order)

1. Rotate leaked Supabase credentials; fix `.env.production.example`.
2. Disable/guard `ENABLE_DEMO_AUTH` for any non-local environment.
3. Fix the live-class recording URL mismatch (Top Priority #3).
4. Lock down `GET /api/teacher-assignments/?classId=` with role + tenant checks.
5. Decide on one implementation for exam sessions (`exams.ts` vs `examSessions.ts`)
   and one for assessments/results/attendance "save" duplicates, then remove the rest.
6. Normalize response shapes (`my-profile`, `subjects` PUT/DELETE, `feeStatus`)
   to reduce special-casing on the frontend.
7. Replace fabricated/hardcoded UI data (Timetable, StudentPortal header,
   SchemeOfWork post-upload state, impersonation user) with real data or clearly
   mark as placeholder.
8. Wire up or remove dead buttons (SuperAdmin user actions, SchoolDetail Settings,
   StaffRoom emoji, SchemeOfWork preview/download, Settings avatar change).
