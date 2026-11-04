# Program gap review

Reviewed: 5 October 2026. **Recommendation: REQUEST CHANGES.** Confidence in the core findings below is high; deployment-dependent conditions and verification limits are stated explicitly.

This is an audit of the current working tree, including existing and recently changed code. It does not mean that every finding was introduced by the recent implementation work. Application code was not changed during this review.

The report contains **96 numbered findings**: 79 in XmartSchool/supporting files, eight each in the independent hotel and HR applications, and one shared standalone release-readiness finding. These include bugs, conditional deployment risks and explicitly identified incomplete capabilities; they are not 96 demonstrated exploitable vulnerabilities.

| Scope | P0 | P1 | P2 | Total |
| --- | ---: | ---: | ---: | ---: |
| XmartSchool and supporting files | 1 | 43 | 35 | 79 |
| XmartHotel | 0 | 7 | 1 | 8 |
| XmartHR | 0 | 8 | 0 | 8 |
| Shared standalone release readiness | 0 | 1 | 0 | 1 |
| Total | 1 | 59 | 36 | 96 |

Start with G01/G02, the exam/result access paths G17–G25, payment recovery G40–G43, and unsaved/cross-session work G34–G39. These affect privileges, private records, academic records and captured payments.

## Scope and evidence

Reviewed the core React application, routing and contexts, API clients, Express routes and middleware, Prisma schema and migrations, authentication and school/group access, student/staff/class workflows, attendance, schemes, assessment/exam/proctoring/result flows, finance and parent access, notifications and messaging, live classes, offline storage, Docker configuration, CI and tests. Separate staged products and supporting scripts are covered at the end of this report.

Evidence includes source tracing across client/server contracts, isolated execution of actual middleware/service/route code with in-memory dependencies, and `npm audit --omit=dev --json` for both installed dependency trees. No production records were modified and no real payment, email, storage, video or authentication-provider transactions were performed. Browser and provider behavior requiring live configuration remains unverified.

The earlier implementation verification passed 60 backend tests across seven suites, both TypeScript checks, both production builds and all nine migrations against a fresh isolated PostgreSQL database. Those checks were performed before this audit; they do not cover the additional failures listed here. Database-backed test suites require `TEST_DATABASE_URL`; ordinary local test runs can skip them.

Severity: **P0** critical authorization failure; **P1** major security, data integrity or blocked workflow; **P2** narrower defects, incomplete capabilities or operational gaps. Source references use current working-tree line numbers.

## Authentication, identity and school access

### G01 · P0 · Supabase user-editable metadata controls backend authorization

`backend/src/middleware/auth.ts:49`, `:58`, `:63` and `:64` fall back to `user_metadata` for role and school/group when database mapping is absent or nullable; `:67` accepts the unmapped provider identity. A valid, unmapped Supabase account can supply `role: SUPER_ADMIN`; nullable mapped school/group fields can also fall back to caller-editable values. This depends on the attacker having a valid account in the configured Supabase project. Supabase explicitly documents that [user metadata is editable by users and must not drive authorization](https://supabase.com/docs/guides/auth/users).

An isolated invocation of the actual middleware accepted an unmapped mocked provider account as SUPER_ADMIN. Require an active canonical database identity and derive all privileges from trusted application records or administrator-managed claims. Fail closed when mapping is missing.

### G02 · P1 · Student listings reveal peer login codes and result PINs

`backend/src/routes/modules/students.ts:47` and `:88` allow ordinary authenticated student reads. `backend/src/services/appService.ts:1217` returns a shared DTO containing `accessCode` at `:232` and `resultPin` at `:235`. Student login at `:561` accepts that code with the school code the student already used to log in.

A student can list peers, obtain a peer's credential and sign in as that peer. Restrict student/parent reads to the actor or linked children, restrict administrative lists, and remove login codes/PINs from ordinary responses.

### G03 · P1 · Disabled identities and old sessions remain usable

`backend/src/middleware/auth.ts:20` accepts signed legacy claims without looking up the current account, role, school or lifecycle state. Tokens last 12 hours (`backend/src/utils/session.ts:18`). An isolated check accepted a deleted-account session with zero database lookups. Student/backend staff login also omits school/account lifecycle checks (`backend/src/services/appService.ts:524`, `:562`), while soft deletion only marks a school inactive/deleted at `:905`.

Role changes, account deletion, password reset, school suspension and student suspension therefore do not consistently remove access; some identities can obtain fresh sessions as well. Resolve current identity and school state on requests, implement revocation/versioning, and enforce lifecycle rules at login.

### G04 · P1 · Schoolless Group Owners receive global records

Group Owners are created with a group but no school (`backend/src/services/appService.ts:650`) and are exempt from school-context enforcement (`backend/src/middleware/auth.ts:119`). Student, subject, scheme and attendance routes pass only `auth.schoolId`; service filters disappear when it is undefined (`appService.ts:1219`, `:1473`, `:1494`, `:2256`). The alternate form-master reader has the same behavior at `:2795`.

A legitimate owner can read other groups' school records, including student credentials. Apply an explicit accessible-school set, and distinguish a global creator query from a missing tenant.

### G05 · P2 · Selected schools are not checked against Group Owner membership

`backend/src/utils/tenant.ts:14` accepts any query school ID for Group Owners. Calendar (`backend/src/routes/modules/events.ts:20`), terms (`terms.ts:19`, `:34`) and timetable (`timetable.ts:13`) readers use it without verifying membership. The finance exposure is also covered in G43.

An owner who knows an unrelated school ID can query its calendar, terms and timetable. Validate the selection with the accessible-school set before reading.

### G06 · P1 · School admins can create subjects in another school

`backend/src/routes/modules/subjects.ts:35` gives submitted `payload.schoolId` priority over the authenticated school. `backend/src/services/appService.ts:1479` writes it without checking ownership. An ordinary School A admin can create a subject in School B. Derive tenant ownership from auth for single-school admins and explicitly authorize multi-school selection.

### G07 · P1 · Related class, subject and teacher IDs can cross school boundaries

Assignment replacement validates the teacher but not submitted classes/subjects (`backend/src/services/appService.ts:3076`). Student creation stores an unchecked class ID at `:1380`; subject updates accept an unchecked teacher ID (`backend/src/routes/modules/subjects.ts:43`, `:53`). Independent foreign keys do not enforce matching school ownership (`backend/prisma/schema.prisma:470`).

Administrators can create inconsistent cross-school rosters and permission-bearing assignments. Validate every related entity and its intended role in the same school before writing, and replace assignments transactionally.

### G08 · P1 · Admin PIN regeneration skips student-school ownership

`backend/src/routes/modules/students.ts:260` performs the student-school check only for non-admin actors. An ADMIN reaches the update by student ID at `:291` and receives the replacement PIN at `:320`, including for another school. Check ownership for every non-super actor before applying form-master permissions. This permits cross-school modification independently of G02's disclosure.

### G09 · P1 · Announcements are global and their audience can be spoofed

`backend/prisma/schema.prisma:236` gives announcements no tenant. School admins create them through `backend/src/routes/modules/announcements.ts:31`; `backend/src/services/appService.ts:2320` reads them globally. The reader trusts the requested role (`announcements.ts:18`), so a student can request `role=ADMIN` and bypass student/teacher audience filtering.

School broadcasts appear across tenants. Store school ownership, reserve explicit global broadcasts for the creator, and derive audience authorization from the authenticated role.

### G10 · P2 · School admins can edit schoolless privileged profiles

`backend/src/routes/modules/auth.ts:71` permits admins to edit other profiles. `backend/src/services/appService.ts:737` rejects a foreign school only when the target has a school ID, accepting schoolless SUPER_ADMIN/Group Owner targets. An admin who knows the ID can change name, phone, bio, gender or avatar at `:745`; this endpoint does not change role. Require exact school ownership and reject privileged global targets.

### G11 · P2 · Teacher-ID assignment reads are not tenant scoped

The teacher-ID branch at `backend/src/routes/modules/teacherAssignments.ts:40` accepts arbitrary IDs for non-teacher roles. `backend/src/services/appService.ts:3036` filters solely by that ID. A student, parent or foreign-school admin who knows a teacher ID can retrieve class/subject assignment details. Restrict reader roles and authorize the teacher's school.

### G12 · P1 · Production account creation does not provision Supabase identities

Group Owner, staff, parent and school-admin creation writes local Prisma users/password hashes (`backend/src/services/appService.ts:650`, `:1101`, `:3823`, `:785`) without a Supabase invite/create operation. Configured production login uses Supabase and refuses backend fallback when demo auth is disabled (`context/AuthContext.tsx:175`). Staff creation also discards its generated plaintext password; production reset at `appService.ts:495` refuses local reset.

New accounts without an existing provider identity cannot use the generated credentials. Provision/invite the provider account, retain a durable identity mapping, and deliver a usable onboarding flow with recoverable partial failures.

### G13 · P1 · Frontend Supabase identity differs from backend identity

`src/services/supabaseAuthService.ts:5` uses the provider UUID and metadata role/school. Backend middleware maps by email to the Prisma ID and privileges (`backend/src/middleware/auth.ts:50`). Settings sends the provider ID (`pages/Settings.tsx:40`), while the profile route compares it to the mapped database actor (`backend/src/routes/modules/auth.ts:73`). Teacher/form-master/exam/timetable filters also compare the raw ID (`pages/assessments/useAssessmentsModel.ts:241`, `:289`; `pages/Timetable.tsx:97`).

When the IDs differ, profile updates fail and legitimate assignments disappear from the UI. Load the canonical backend profile after authentication and use its identity and privileges throughout the client.

### G14 · P1 · Impersonation cannot restore a consistent session after reload

`context/AuthContext.tsx:259` stores the impersonation token while leaving the persisted user as the original account; recovery information lives only in memory. Reload at `:67` restores the original user with the impersonated token. Provider auth events at `:103` can also clear the impersonation token.

The displayed actor, authorized actor and exit context diverge. Persist a consistent impersonation/recovery session pair and handle provider refresh without silently replacing intentional impersonation.

### G15 · P1 · Creator's selected-school view mixes global and school data

`pages/superadmin/SchoolsTab.tsx:192` sets `viewingSchoolId`, but assessment reads remain unscoped (`pages/assessments/useAssessmentsModel.ts:244`) and classes depend on `user.schoolId` at `:279`. Results also uses unscoped reads (`pages/Results.tsx:171`).

The selected-school screen can show global students, subjects, exams and results while lacking that school's class context. Carry the effective school through every query/mutation or establish a consistent school session.

## Exams, grades and result access

### G16 · P1 · Saved branding can inject script into printable report cards

School admins may save an arbitrary color string (`backend/src/routes/modules/schools.ts:176`, `:187`; `backend/src/services/appService.ts:962`). `src/utils/printReportCard.ts:32` inserts it directly inside a style element at `:74`, then writes HTML into a same-origin blank window (`:159`, `:161`). A value containing a closing style tag and script tag can execute with same-origin storage/opener access unless an external hosting CSP blocks it.

The source-to-sink path was confirmed; no runtime exploit was attempted. Validate allowed colors server-side and render with context-safe output. Inspect other raw report values as part of the same fix.

### G17 · P1 · Exam listings expose foreign schools' answer keys

`backend/src/routes/modules/exams.ts:13` requests answers for every teacher/admin. `backend/src/services/appService.ts:2024` queries all exams without a school filter; available exams at `:2029` are global too. An isolated service invocation returned a foreign exam's answer key and showed the absence of a WHERE filter. Require school ownership and scope listings to authorized school/class/subject relationships.

### G18 · P1 · Exam ownership is optional and active question sets are mutable

Exams lack a required school relation (`backend/prisma/schema.prisma:396`) and depend on optional teacher ownership. Teacherless exams bypass school checks (`backend/src/services/appService.ts:2050`). Builder input accepts arbitrary teacher IDs (`backend/src/routes/modules/exams.ts:40`) and writes them at `appService.ts:2068`/`:2084`. Active edits delete/recreate question IDs at `:2070`.

Teacherless exams can be modified across schools, ownership can be assigned incorrectly, and attempts can lose their question references. Require immutable school ownership, validate editor/teacher relationships, and freeze or version questions once attempts start.

### G19 · P1 · Submission accepts foreign, ended, unstarted and final attempts

`backend/src/routes/modules/examSessions.ts:71` supplies no actor context to submission. `backend/src/services/appService.ts:2210` loads an exam without school/status/session/deadline checks, and `:2226` unconditionally upserts the attempt.

An isolated check submitted an ended foreign-school exam without starting it, then resubmitted and replaced score 100 with 0. Require an authorized active session, enforce a server deadline, and atomically reject repeated final submission.

### G20 · P1 · Session reads and resets lack school/exam authorization

`backend/src/services/appService.ts:2133` lists sessions for any supplied exam ID; `:2817` deletes any exam/student pair. The routes at `backend/src/routes/modules/examSessions.ts:10` and `:76` check role only. Teachers can read foreign attempts and admins can delete them. Apply school/class/ownership checks to listing, progress, reset and final submission consistently.

### G21 · P1 · Student exam client can crash, target the wrong exam and claim an unsaved submission

Available questions intentionally omit answer keys (`backend/src/services/appService.ts:2028`, `:365`), but `pages/StudentPortal.tsx:241` calls `correctAnswer.toLowerCase()` for answered questions. The client also omits `examId` (`services/api.ts:928`), causing the server to choose the first globally active exam (`appService.ts:2212`); isolated execution confirmed that fallback. The portal enters an exam after failed start at `StudentPortal.tsx:158` and marks completion before checking the submission response at `:246`.

Answered exams can throw before saving; other attempts can be graded under a different exam or appear complete after failure. Remove client answer-key grading, require the selected exam/session ID and display completion only after server confirmation, retaining retryable answers.

### G22 · P1 · Proctoring rejects its student caller and does not store evidence

Students send frames, but `backend/src/routes/modules/proctoring.ts:18` excludes STUDENT. Privileged calls reach `backend/src/services/appService.ts:2650`, which logs a prefix and claims `stored:true` without persistence or analysis. Authorize the actual session owner, implement evidence capture/review/retention, and report the real status of the capability.

### G23 · P1 · Report-card reads bypass fee/PIN/publication restrictions

`backend/src/routes/modules/students.ts:114` checks student self-access only and calls the report service at `:125` without the results gate. `backend/src/services/appService.ts:1820` fetches all statuses for the term. An isolated invocation returned a Draft mark.

An unpaid student can directly request their report and see Draft/withheld marks. Centralize student result access and apply it to every report and results endpoint.

### G24 · P1 · A term PIN unlocks other terms and unpublished marks

`backend/src/routes/modules/results.ts:57` checks for Published results in the PIN's term, but `:74` subsequently fetches the caller's requested term. `backend/src/services/appService.ts:1795` does not restrict publication status. An isolated route check used a valid Term1 PIN to receive a Term2 Draft result. Bind returned results to the authorized term and Published status.

### G25 · P1 · Parent and Group Owner marks lack student ownership checks

Results and assessment readers accept all authenticated roles (`backend/src/routes/modules/results.ts:20`; `assessments.ts:19`). They enforce self-ID for students but do not enforce linked children for parents or group membership for owners. Schoolless owners reach unscoped service queries (`backend/src/services/appService.ts:1795`, `:1627`). Validate the actor's authorized student/class/school set for each reader.

### G26 · P2 · A wrong-length PIN causes HTTP 500

`backend/src/routes/modules/results.ts:45` calls `timingSafeEqual` on buffers without checking equal byte length. An isolated check reproduced `RangeError` with a one-character PIN. Validate format and byte length before comparing and return the intended access-denied response.

### G27 · P1 · Imported exam percentages inflate academic totals

Server exam scores are percentages (`backend/src/services/appService.ts:2224`); gradebook sync copies them directly to an exam component configured for 70 marks (`pages/assessments/useAssessmentsModel.ts:167`, `:540`). The server adds CA values and clamps at 100 (`appService.ts:1742`). An 80% exam plus 30 CA becomes 100 instead of 86. Persist scoring configuration and convert percentages into the configured maximum before calculating authoritative totals.

### G28 · P1 · Saving assessments silently unpublishes approved results

`backend/src/services/appService.ts:1759` changes the derived result to Draft on every save, including previously Published results. An assigned teacher can remove approved publication simply by saving. Preserve state for unchanged marks and use an explicit revision/approval workflow for changed marks.

### G29 · P1 · Result publication loses term identity and can partially commit

`pages/assessments/useAssessmentsModel.ts:505` omits the selected term; `backend/src/services/appService.ts:1911` defaults it to `current`. `pages/assessments/GradebookView.tsx:73` also uses fixed term labels rather than configured school terms/sessions. Different terms can overwrite the same `current` result set.

Publication validates student ownership inside the write loop (`appService.ts:1901`), allowing earlier rows to commit before a later row fails. Submitted grade/average/details at `:1921` are not reconciled with saved assessments. Require canonical term identity, validate/recalculate the entire batch first, and publish atomically.

### G30 · P1 · Custom assessment columns and configuration disappear after saving

Custom CA columns/maximums live in component state (`pages/assessments/useAssessmentsModel.ts:159`, `:619`). The server schema accepts only ca1/ca2/ca3/exam (`backend/src/routes/modules/assessments.ts:36`) and strips added fields. Reload loses marks/configuration despite a successful save. Persist flexible scores/configuration or constrain the interface to supported fields.

### G31 · P2 · Assessment records lack a natural unique key and atomic derived writes

Missing IDs create new rows (`backend/src/services/appService.ts:1724`), while `backend/prisma/schema.prisma:195` has no student/subject/term uniqueness constraint. Assessment and derived result writes are separate. Retries can duplicate assessments and failures can leave results inconsistent. Use a unique natural key, upsert and transact the assessment/result change.

### G32 · P2 · Assessment class filtering disagrees with authorization

`backend/src/services/appService.ts:1558` considers only the first form-master class for reads, while save permissions consider all. Admin reads at `:1627` ignore the requested class ID. Multi-class form masters lose legitimate read access and admin filters include other classes. Use the same authorized class set and apply class predicates to all readers.

### G33 · P1 · Student creation and class moves leave class enrollment null or stale

`components/StudentForm.tsx:24`, `:83` submits a grade name without `schoolClassId`; creation stores a null FK (`backend/src/services/appService.ts:1380`). Class moves change only grade (`pages/Classes.tsx:116`; `appService.ts:1234`). Assignment-based grade access checks the class FK at `:1684`, as do live-class enrollment checks. Submit canonical class IDs and update grade/class membership together, including existing records.

### G34 · P1 · Rejected grade saves are reported as successful

`services/api.ts:839` converts any save exception, including 403/validation/500 failures, into `ok:true`. `pages/assessments/useAssessmentsModel.ts:482` clears modified rows and reports success. Preserve the error and dirty data; show queued state separately from confirmed server saves.

### G35 · P1 · Attendance load failures become Present registers

`services/api.ts:948` converts API failure into a successful empty list. `pages/Attendance.tsx:217` treats missing records as Present, so saving can overwrite existing absences after a failed load. Save at `:239` also ignores a failed response. Block editing/saving until the load is resolved, distinguish an empty register from an error, and check save outcomes.

### G36 · P2 · Other rejected mutations clear drafts or update the UI as if saved

Teacher create/update/delete (`pages/Teachers.tsx:300`, `:313`, `:326`) and staff messages (`pages/StaffRoom.tsx:199`) do not check `response.ok`. Forms close, local lists change or drafts clear after server rejection. Check response bodies, display rejection reasons and retain editable state. This is additional to grade, attendance and exam failures above.

## Offline behavior and session privacy

### G37 · P1 · Offline writes replay under the next logged-in account

`src/utils/offlineQueue.ts:6` stores a single queue with no actor/school. Replay at `:33` uses the current authenticated client. Logout and login as another teacher can replay the first teacher's changes under the second identity; cross-school failures then discard them. Partition operations by original actor/school and reconcile only under that identity.

### G38 · P1 · Offline replay can silently delete unsaved work

`src/utils/offlineQueue.ts:42` drops all HTTP failures, including retryable 500/503. HTTP-successful `ok:false` bodies are removed at `:37`. Replay persists an old queue snapshot after awaited requests, overwriting concurrently enqueued operations. Validate outcomes, retain recoverable failures, expose unrecoverable conflicts and remove completed IDs from the latest queue.

### G39 · P1 · Same-origin deployments cache authenticated API responses across accounts

`public/sw.js:25` excludes cross-origin requests but caches every successful same-origin GET (`:43`). In deployments using a same-origin `/api`, protected responses are served from the shared cache first; cache entries are not partitioned by account and logout does not clear them. This requires same-origin API hosting. Exclude API/auth paths and authorization-bearing requests from service-worker caching.

## Finance and parents

### G40 · P1 · Captured payments can be acknowledged without durable ledger credit

`backend/src/services/appService.ts:3510` converts posting exceptions into `ok:true, recorded:false`. `backend/src/server.ts:64` catches processing/verification failure and still returns HTTP 200 at `:68`. There is no durable webhook inbox, checkout intent or recovery record. Isolated checks reproduced successful capture plus posting failure and a webhook 200 after verification threw. [Paystack's webhook documentation](https://paystack.com/docs/payments/webhooks/) states that unsuccessful acknowledgments trigger retries; returning 200 suppresses that recovery path.

Two checkouts against the same outstanding balance can both capture; the second credit can fail the ledger overpayment check without leaving a recoverable record. Persist events before acknowledgment, retry posting idempotently and retain unmatched/overpaid captures for reconciliation/refund.

### G41 · P1 · Payment replay does not repair failed clearance/PIN work

Payment insertion commits at `backend/src/services/appService.ts:3363`. PIN/receipt work runs afterward in a caught block; recipient lookup at `:3402` can fail before PIN generation. Replay returns at `:3364` and skips repair. An isolated check committed a payment, failed recipient lookup, then replayed with no PIN repair. Make post-payment work durable and idempotent, and ensure clearance state cannot depend on a notification lookup succeeding.

### G42 · P1 · One paid ledger can unlock results despite other unpaid term charges

The PIN calculation loads only the paid ledger (`backend/src/services/appService.ts:3390`, `:3412`). Multiple ledgers per student/term are permitted for different scopes (`backend/prisma/schema.prisma:595`). Paying a smaller extra ledger can mint the term PIN while another ledger is outstanding. Define clearance across all applicable term obligations and use that calculation for both PIN issuance and result access.

### G43 · P1 · Finance readers expose unauthorized ledgers

`backend/src/routes/modules/finance.ts:310` restricts linked children only for parents; other student/teacher callers receive all same-school ledgers at `:326`. Group Owners can select any school via `backend/src/utils/tenant.ts:15`; ledger/summary readers (`finance.ts:368`) do not check membership. Restrict reader roles and authorize school/student scope before querying.

### G44 · P2 · Binary floats can reject valid final payments

Fee/payment amounts are Float (`backend/prisma/schema.prisma:612`, `:630`); `backend/src/services/paymentService.ts:29` compares their sum directly. An isolated check reproduced 0.10 + 0.20 exceeding 0.30 as 0.30000000000000004 and rejecting the payment. Store and compare integer kobo or exact decimals throughout the ledger.

### G45 · P2 · Donation verification claims recording without a donation record

`backend/src/routes/modules/finance.ts:67` returns `recorded:true` for provider success without inserting a donation. Donation metadata has no fee ledger IDs, so the generic webhook posting path cannot record it either. Persist donation intents/captures and reconcile duplicate callbacks idempotently.

### G46 · P2 · Parent creation/linking lacks atomicity and recipient-role validation

`backend/src/services/appService.ts:3826` creates the account before validating students or inserting links (`:3838`, `:3848`). A failure can occupy the email without returning usable onboarding credentials. Linking at `:3920` validates user ID/school but not PARENT role, permitting links to teacher/admin accounts. Validate all inputs first and create the parent and links transactionally; require the intended recipient role.

### G47 · P2 · Parent summaries mix academic periods and hide older debts

`backend/src/services/appService.ts:3872` returns Published marks across all terms and lifetime attendance. Fee lookup takes only five records (`:3882`), which can hide older unpaid obligations. Select a canonical term for the summary and retrieve all outstanding debts separately from a paged payment history.

## Data consistency and incomplete product behavior

### G48 · P1 · Current-term changes can leave zero or multiple current terms

`backend/src/services/appService.ts:3202`/`:3207` and `:3225`/`:3229` clear and set current state in separate writes. The schema only has a nonunique current-term index (`backend/prisma/schema.prisma:676`). Two isolated concurrent switches both succeeded and left two current terms; an isolated failed current-term creation left none. Dates accept any nonempty strings (`backend/src/routes/modules/terms.ts:48`).

Validate actual dates/ranges, transact the switch with concurrency protection, and enforce one current term per school in the database.

### G49 · P1 · Concurrent timetable changes can double-book a teacher

`backend/src/services/timetableService.ts:208` checks for a clash before a separate write at `:222`/`:226`. The schema enforces only class/day/period uniqueness (`backend/prisma/schema.prisma:498`). Two isolated simultaneous writes both succeeded for the same teacher/day/period in different classes. Enforce teacher-slot uniqueness or serialize edits within a suitable transaction and handle conflicts explicitly.

### G50 · P2 · Attendance batches can partially commit

`backend/src/services/appService.ts:2279` runs independent upserts with Promise.all. Route validation checks a date pattern only (`backend/src/routes/modules/attendance.ts:56`). A failing record can reject the request after other records commit. Validate calendar dates and student scope for the entire batch, then transact it.

### G51 · P2 · Message histories permanently omit new messages after their caps

Staff/private readers select the oldest 200 (`backend/src/services/appService.ts:2972`, `:2619`); live chat selects the oldest 100 (`:2912`). Once full, reload or SSE refresh never returns newer messages. Fetch the newest page, reverse for display and expose older history through cursors.

### G52 · P2 · Lists silently truncate without pagination or completeness signals

Student lists cap at 5,000 (`backend/src/services/appService.ts:1221`), users at 2,000 (`:978`, `:997`), parents at 2,000 (`:3952`), schemes at 500 (`:1497`) and notifications at 50 (`:2443`). UI searches, exports and selectors inherit incomplete data. Introduce server pagination/search and counts; make full exports retrieve all pages rather than exporting the currently loaded subset.

### G53 · P2 · Scheme submissions cannot complete administrative review

`backend/src/routes/modules/schemes.ts:10` exposes list/upload only. New submissions are always Pending (`backend/src/services/appService.ts:1517`); no approve/reject transition exists despite the frontend's review/status workflow (`pages/SchemeOfWork.tsx:212`, `:350`). Add authorized review transitions and reviewer feedback.

### G54 · P2 · Notification preferences do not control delivery

`pages/Settings.tsx:186` saves alert and summary preferences only to localStorage; no delivery/filtering code consumes these values. Connect preferences to persisted user settings and notification delivery, or remove the promised controls until supported.

### G55 · P2 · Notifications retain previous-session state

`context/NotificationContext.tsx:28`, `:52` depends on authenticated/not-authenticated rather than actor/school. It does not clear on logout or reject stale responses. Account/school changes and impersonation can show prior notifications until refresh, and late responses can replace the current list. Reset/refetch on canonical actor/school and guard asynchronous responses.

### G56 · P2 · Password settings select provider configuration instead of session provider

`pages/Settings.tsx:239` uses Supabase whenever configured, including backend student/legacy sessions. These users cannot manage the credential used by their current session through this screen. Route password management by active identity/provider and provide a usable student credential-management flow.

### G57 · P2 · Student timetable and teacher-message navigation is hidden

`components/Sidebar.tsx:81` defines student links, but `components/Layout.tsx:66` omits the student sidebar and `components/Header.tsx:29` hides its trigger. StudentPortal provides no replacement. Add visible portal navigation for the authorized timetable and Ask a Teacher screens.

### G58 · P2 · Live recording and media controls do not operate the provider

`pages/LiveClassRoom.tsx:121` stores a synthetic meeting URL as a recording without capturing/uploading video. Camera/microphone controls at `:97` change participant metadata without controlling the embedded provider. The recording limitation is documented in `docs/IMPLEMENTATION_CHECKLIST.md:70`; it remains an incomplete capability. Integrate provider recording/media APIs and durable storage, or label/remove controls that imply unsupported behavior.

### G59 · P2 · Camera streams are not reliably stopped on unmount

StudentPortal only stops capture through explicit exit (`pages/StudentPortal.tsx:258`), not submission/navigation/unmount. PhotoUpload similarly relies on `closeCamera` (`components/PhotoUpload.tsx:91`); late permission resolution can create a stream after closure. Add effect cleanup and cancel/stop late media results.

### G60 · P2 · Dashboard displays samples and links to missing routes

Static performance/top-scorer/activity data (`pages/Dashboard.tsx:67`, `:77`, `:126`) appears as school data. Destinations at `:129`, `:356`, `:525` include exams, parents, dashboard, fees, library and transport paths without matching App routes; the wildcard redirects silently (`App.tsx:155`). Use actual school data and supported routes, or explicit unavailable/sample states.

### G61 · P2 · Global search and creator user details are nonfunctional

`components/Header.tsx:39` renders a search input without a search handler. `pages/superadmin/UsersTab.tsx:23` has an empty details handler invoked by visible names/buttons. Implement the interactions or remove their interactive presentation.

### G62 · P2 · Official reports contain fabricated or inconsistent assessment metadata

Fixed behavior/psychomotor ratings are generated for every student (`backend/src/services/appService.ts:1848`, `:1855`). Results assigns missing sessions to 2025/2026 and a fixed score configuration (`pages/Results.tsx:182`, `:187`, `:164`), inconsistent with gradebook defaults. Term reports use all-time attendance (`Results.tsx:208`; `services/api.ts:1204`). Store teacher-entered ratings, canonical session/configuration and term-bounded attendance; do not present fallback samples as assessed facts.

### G63 · P2 · Gradebook CSV export does not escape cells

`pages/assessments/useAssessmentsModel.ts:585` joins cells directly with commas. Names/labels with commas, quotes or newlines produce malformed columns. Reuse `src/utils/csv.ts` and verify a round-trip with those inputs.

## Security operations, deployment and verification

### G64 · P1 · Caller-supplied forwarding headers bypass rate limits

`backend/src/middleware/rateLimit.ts:5` takes the first raw X-Forwarded-For value before the trusted request IP. Production Compose exposes the backend directly on port 4000 (`docker-compose.production.yaml:31`), and `backend/src/server.ts:24` trusts one proxy. A direct client can vary the header to obtain new authentication/brute-force/API buckets. Use request IP derived from an explicitly trusted proxy chain and prevent direct access that bypasses it.

### G65 · P2 · The API's school-aware limiter runs before authentication

`backend/src/server.ts:74` attaches the API limiter before route authentication. `backend/src/middleware/rateLimit.ts:14` therefore uses anonymous rather than school identity. Users behind a shared NAT consume the same 300-request/15-minute budget, making polling and concurrent school usage vulnerable to false throttling. Apply authenticated tenant/actor limiting after auth and keep a separate unauthenticated IP limit.

### G66 · P1 · Frontend Docker context includes local environment and working data

`.dockerignore:3` excludes only files named `.env`; it does not exclude `.env.local`, other environment variants, `.tmp` or local agent/tool directories. A root `.env.local` exists in this workspace. `Dockerfile:5` copies the entire context into an intermediate image. This exposes included files to the build context/layers; their secret contents were not inspected, and final-image disclosure is not established. Exclude `.env*`, temporary/runtime data and local tooling; provide needed settings explicitly at build/runtime.

### G67 · P1 · Default/debug Compose configurations do not match current startup requirements

`compose.yaml:8` omits SESSION_SECRET, now required by `backend/src/config/env.ts:28`, so clean production startup fails with its declared environment. `compose.debug.yaml:13` likewise omits it and requires an undeclared mounted backend .env or another configuration source to satisfy startup. Default Compose supplies Vite variables at runtime (`compose.yaml:24`) although the production frontend needs build arguments; both configurations use browser API URL `http://backend:4000/api`, a Docker-network hostname unavailable to the host browser. `docker-compose.yml` is empty.

Align or remove obsolete entry points, supply required secrets and a browser-reachable API URL, and pass frontend settings at the correct build stage. The explicit production Compose file already forwards the secret and frontend build arguments.

### G68 · P2 · The backend production image defaults to development mode

The production stage of `backend/Dockerfile:14` does not declare NODE_ENV=production; `backend/src/config/env.ts:12` defaults to development. Production Compose supplies the correct value, but running the image alone without it weakens production-only checks and error behavior. Set the image's production mode explicitly and verify the startup contract.

### G69 · P1 · Production dependency trees contain unreviewed high-severity advisories

Read-only npm audits of the current installed trees reported:

| Tree | High | Moderate | Total vulnerable package entries |
| --- | ---: | ---: | ---: |
| Frontend | 8 | 1 | 9 |
| Backend | 7 | 3 | 10 |

Frontend entries: @humanfs/node, axios, brace-expansion, fast-uri, form-data, js-yaml, react-router, react-router-dom, ws. Backend entries: body-parser, brace-expansion, express, ip-address, jws, minimatch, path-to-regexp, qs, uuid, ws. These are two dependency trees, not 19 unique vulnerabilities; advisory severity does not establish exploitability in a reachable application path. The audit reported available fixes for all entries.

Review affected paths, update direct/transitive dependencies with lockfiles, remove unused runtime dependencies and validate the resulting builds/tests. No automatic dependency changes were made. Docker also uses floating node:lts-alpine and npm install rather than a pinned runtime plus npm ci (`Dockerfile:1`, `:4`; `backend/Dockerfile:1`, `:4`), reducing reproducibility.

### G70 · P1 · Verification does not cover the highest-risk workflows

The root package has no frontend test script (`package.json:6`). CI performs TypeScript, migrations/drift and backend tests, but not production builds, Docker startup, browser flows, dependency auditing or coverage thresholds (`.github/workflows/ci.yml:29`; `backend/jest.config.cjs:1`). Database suites can be skipped without TEST_DATABASE_URL (`backend/tests/database.test.ts:12`; `student-notifications.test.ts:15`).

Existing tests omit much of the cross-role/tenant access matrix, actual exam lifecycle, publication/PIN/report-card restrictions, offline/session changes, provider failure recovery and onboarding. Add tests that reproduce these findings, then require critical browser, build/container and dependency checks in CI. Do not treat the previous 60 passing tests as verification of these paths.

### G71 · P2 · Health checks do not establish database readiness

`backend/src/services/appService.ts:506` always returns healthy without a database/dependency probe. Docker health checks only the HTTP response (`docker-compose.production.yaml:33`). A disconnected database can coexist with a healthy service status. Separate liveness from readiness and make readiness fail when required database operations cannot run.

### G72 · P2 · Some external-provider calls have no application deadline

Paystack initialization/verification (`backend/src/services/paystackService.ts:23`, `:52`) and Termii send (`messagingService.ts:31`) use fetch without an application-level timeout. These requests can retain handlers/work longer than the application intends during provider stalls. Add bounded deadlines and explicit failure/retry behavior. SMTP already has connection/socket timeouts and Whereby creation already uses a ten-second AbortSignal timeout; those are not unresolved timeout findings.

### G73 · P2 · Message events do not propagate between backend replicas

`backend/src/services/eventBus.ts:10` uses an in-process EventEmitter. A message written on replica A does not refresh clients connected to replica B. This is a documented scaling limitation (`docs/IMPLEMENTATION_CHECKLIST.md:68`), not a failure established for the current single-process configuration. Use a shared bus and verify stream proxy buffering/connection behavior before scaling.

### G74 · P2 · Notification email has no durable retry or delivery status

`backend/src/services/emailService.ts:23` sends best effort and logs failures; application callers launch delivery without a durable outbox (`backend/src/services/appService.ts:322`, `:2487`, `:3404`). A process restart or provider failure can lose delivery while the business operation remains saved. This is documented at `docs/IMPLEMENTATION_CHECKLIST.md:72`. Add persisted jobs, retry/backoff and delivery visibility if dependable delivery is required.

### G75 · P2 · Audit writes and impersonated actions are not fully attributable

`backend/src/services/appService.ts:3751` accepts only the acting user and catches failed audit insertion. Middleware retains `impersonatedBy` (`backend/src/middleware/auth.ts:29`), but mutation audit calls do not pass/persist that originating actor; the audit model has no dedicated impersonator field. The initial impersonation event does not by itself identify each later action. Carry the original actor into mutation audit metadata and make critical audit failures observable/recoverable with suitable durability.

## Separate products and supporting files

### G76 · P1 · An unrelated ransom/leak-payment artifact is present in the repository

`monetization_system/payments/raas_payments.py:3`, `:18` and `:60` explicitly describe ransom payment and data-leak processing. The file also contains trailing pasted XML/tool commands (`:89`), making it invalid Python. No runtime imports or school-payment integration were found. Treat this as repository contamination to remove or quarantine and investigate its provenance; source inspection establishes no evidence that it runs in XmartSchool. It was not executed during the audit.

### G77 · P2 · An old failed request can clear a newer session

`src/utils/api.ts:57` removes current credentials and broadcasts expiration for every 401 without comparing the failed request's token to the current session. `context/AuthContext.tsx:152` clears the displayed user immediately. A request started before logout/login or impersonation can log out the replacement session when its old 401 arrives. Bind expiration handling to the originating token/session generation.

### G78 · P2 · Deployment scripts print success after Docker failure

`deploy.sh:27` and `deploy.bat:27` invoke Compose without checking its exit status before printing Deployment complete. They also do not verify container readiness. Failed builds/startup can therefore be reported as successful. Propagate failure status and verify readiness before announcing completion.

### G79 · P2 · Subject workflows still ignore the assignment matrix

The teacher assignment matrix is saved at `pages/Teachers.tsx:346`, but subject/scheme/results views still filter by legacy Subject.teacherId (`pages/Subjects.tsx:192`; `pages/SchemeOfWork.tsx:58`; `pages/Results.tsx:264`). A teacher assigned only through TeacherAssignment can have grade access yet see no corresponding subjects or schemes. Use the canonical assignment matrix across every teacher workflow.

Unused alternate clients (`services/cloud-api.ts`, `src/services/api.ts`) and inactive MSW handlers have divergent legacy contracts but no active callers/interception. They are maintenance debt rather than demonstrated runtime bypasses. `setup.js` is also empty. These inventory observations are not additional numbered defects.

The untracked `xamanix/` directory stages independent XmartHotel and XmartHR products for separate repositories (`xamanix/README.md:3`). Their absence from XmartSchool routing is intentional. Their standalone findings are recorded separately below; they are not core XmartSchool integration defects.

### X01 · P1 · Standalone release instructions lack migration/test/build foundations

Both products have their own React/Express/Prisma stacks and routes. Their Prisma directories have schema and seed files without migration histories; backend packages have no test scripts or discovered tests. Documented setup relies on db push/development migration commands (`xamanix/xmarthotel/README.md:44`, `:87`; `xamanix/xmarthr/README.md:76`). Hotel production instructions require migrate deploy and npm ci (`xamanix/xmarthotel/docs/DEPLOYMENT.md:23`, `:24`, `:32`), but no hotel lockfiles or versioned migrations exist; its contribution guide also requires a missing frontend typecheck script (`xamanix/xmarthotel/docs/CONTRIBUTING.md:22`).

An empty database cannot be created by the documented migration deployment, and clean hotel npm ci installs are not reproducible. Add versioned migrations/lockfiles and automated authorization/business checks, then rehearse fresh deployment and upgrade separately from XmartSchool. No standalone builds were run.

### XmartHotel findings

Paths in H01–H08 are relative to `xamanix/xmarthotel/`. These are high-confidence source findings from a bounded audit, without real bookings/provider transactions or runtime build validation. Coverage included auth/RBAC, public reservations/room service, front desk/billing/payments, housekeeping/room ownership, inventory/staff references, channel ingestion and frontend offline behavior. Every screen and analytics/LLM internals were not exhaustively reviewed.

#### H01 · P1 · Public room-service orders can charge another guest

`backend/src/modules/public/public.routes.ts:163` identifies a checked-in stay using only public property ID and room number, then creates an order and folio charge at `:178`. No guest session or stay secret is required. A caller who knows the room can repeatedly charge its occupant. Require an expiring capability tied to the actual stay before accepting an order or charge.

#### H02 · P1 · Maintenance requests can change a foreign property's room

`backend/src/modules/housekeeping/housekeeping.routes.ts:123` accepts an unchecked room ID; the ownership check runs only if blockRoom is requested. A request in Property A can reference a room in Property B. Update verifies only the request's property (`:147`) before releaseRoom changes the foreign room to Dirty (`:154`). Validate room/property relationships before insertion and during the release transaction.

#### H03 · P1 · Walk-in/staff stays can check out without room charges

`backend/src/modules/reservations/reservations.routes.ts:98` records the nightly rate but creates an empty folio. Check-in (`backend/src/modules/frontdesk/frontdesk.routes.ts:60`) never posts accommodation charges. Checkout at `:90` sees a zero balance and allows departure. Generate rate/date-based room charges atomically and idempotently before checkout can succeed.

#### H04 · P1 · Concurrent provider callbacks can double-credit a payment

`backend/src/modules/payments/paystack.service.ts:81` checks whether a reference exists before a separate insertion at `:90`. `backend/prisma/schema.prisma:246` has no unique reference constraint. Verification and webhook requests can both observe no payment and insert the same capture. Add provider-reference uniqueness, atomic insert/upsert and request idempotency for cash posting.

#### H05 · P1 · Booking creation does not reserve available capacity

Public (`backend/src/modules/public/public.routes.ts:76`), staff (`backend/src/modules/reservations/reservations.routes.ts:73`) and channel creation (`backend/src/modules/channels/channels.routes.ts:157`) create reservations without availability checks/locking. Even sequential bookings can exceed the rooms available for those dates; the availability reader only clamps the displayed remainder to zero (`backend/src/modules/channels/availability.ts:55`). Check every occupied night and reserve inventory transactionally across all ingress paths.

#### H06 · P1 · Hotel caches and offline writes cross user/property sessions

`frontend/public/sw.js:7`, `:40` caches API data without actor/property partitioning. Logout clears only the token (`frontend/src/context/AuthContext.tsx:37`). The outbox lacks identity (`frontend/src/lib/offline.ts:17`) and replays with the current token (`frontend/src/lib/api.ts:16`, `:77`) on boot/reconnect. A shared device can expose the previous session's records and replay its changes as another user. Partition/clear sensitive caches and bind queued operations to the originating actor/property with conflict handling and idempotency.

#### H07 · P2 · Hotel users retain old JWT privileges after account changes

Login checks active state (`backend/src/modules/auth/auth.routes.ts:19`), but authorization trusts token role/property (`backend/src/core/rbac.ts:14`). Tokens last 12 hours (`backend/src/core/auth.ts:11`). Deletion, disablement, demotion or reassignment does not revoke existing access. Validate current membership/state or implement revocable sessions/token versions.

#### H08 · P1 · Documented separate-host frontend ignores its API URL

`docs/DEPLOYMENT.md:31` instructs setting VITE_API_URL to the API subdomain. `frontend/src/lib/api.ts:12` instead hardcodes /api; `frontend/vite.config.ts:6` provides a development proxy only. The documented static frontend host calls its own /api rather than the deployed backend. Consume the configured URL or provide and document a production reverse proxy.

### XmartHR findings

Paths in R01–R08 are relative to `xamanix/xmarthr/`. All eight were checked against actual TypeScript handlers with isolated in-memory dependencies. No database, browser, S3, email/SMS or provider operations were performed. Coverage included auth/RBAC, employee relations, private/public document signing and checklist automation, payroll generation/finalization, leave decisions and attendance automation. Cross-organization findings require multiple organizations sharing a database; current documentation describes single-organization deployment.

#### R01 · P1 · Salary/signature readers accept foreign-organization records

`backend/src/modules/payroll/payroll.routes.ts:74` filters salary components only by employee ID. `backend/src/modules/documents/documents.routes.ts:151` loads document organization but permits privileged readers without checking it at `:154`. Isolated route checks returned both foreign datasets. Scope employee/document reads to the authorized organization.

#### R02 · P1 · Uploaded documents can mutate a foreign checklist

`backend/src/modules/documents/documents.routes.ts:48` accepts employee/checklist IDs without organization or relationship validation. Signing changes the linked checklist directly (`:136`; `backend/src/modules/public/signing.routes.ts:80`). An isolated check accepted an Org A document linked to an Org B checklist and marked that checklist Done after signing. Validate all relationships before insertion and during automation.

#### R03 · P1 · Public one-time signing links can be used twice

`backend/src/modules/public/signing.routes.ts:20` checks Pending state before separately creating a signature (`:67`) and updating the request (`:70`). Concurrent requests can both pass, while a failure can leave the link Pending after a signature exists. An isolated check produced two successful signatures. Atomically consume Pending state within the signature transaction and enforce signature/request uniqueness.

#### R04 · P1 · Finalized payroll can change and keep obsolete payslips

`backend/src/modules/payroll/payroll.routes.ts:144` checks Draft only before generation, followed by unguarded writes at `:169`; finalization at `:190` does not lock/check completeness. An isolated interleaving finalized an empty run and then inserted a payslip after finalization. Regeneration only upserts Active employees, leaving old slips for employees no longer active. Serialize generation/finalization and atomically replace/validate a complete Draft snapshot.

#### R05 · P1 · One-off salary components recur in later payroll periods

`backend/src/modules/payroll/payroll.routes.ts:95` persists recurring=false, but generation at `:153` includes all components without testing that flag or a period. An isolated check applied one bonus to September and October payroll. Associate one-off components with the intended period/run and exclude them elsewhere.

#### R06 · P1 · Concurrent approvals double-consume leave

`backend/src/modules/leave/leave.routes.ts:103` checks Pending before separate unconditional approval (`:105`) and balance increment (`:112`). An isolated concurrent check consumed six days for one three-day request. Atomically transition Pending to Approved and update entitlement in the same transaction, rejecting duplicate approval and insufficient balance.

#### R07 · P1 · Pre-marked absent employees cannot clock in correctly

`backend/src/modules/attendance/attendance.routes.ts:25` uses an empty upsert update. If absentee automation already created today's row, a later clock-in leaves Absent status and clockIn=null while returning success; clock-out rejects it at `:44`. Isolated handlers reproduced that sequence. Record arrival/Late state on an existing row with no clockIn while preserving real prior arrivals.

#### R08 · P1 · HR deactivation/demotion does not revoke old access

`backend/src/core/auth.ts:12` creates 12-hour JWTs. `backend/src/core/rbac.ts:17` verifies only token claims; active state is checked at login only (`backend/src/modules/auth/auth.routes.ts:19`). An isolated check authorized old HR claims with zero account-state reads. Validate current account/session state and support revocation or token versions.

## Recommended repair sequence

1. Close G01/G02 and the tenant/result/exam access violations. Enforce canonical identities, lifecycle checks and role-specific accessible-school/student sets throughout.
2. Repair production onboarding, exam submission and grade/result contracts. Use canonical term/class identities, authoritative weighting and atomic publication.
3. Make captured-payment recovery, clearance/PIN work and offline saves durable. Preserve unsuccessful work and reconcile retries under the correct actor.
4. Correct Docker entry points/build exclusions and address dependency advisories; add regression, browser and container checks for these failures.
5. Finish or clearly label incomplete product controls and add pagination, delivery/replica support and readiness monitoring.

## Remaining verification limits

Actual Supabase project/signup settings, storage/RLS policies, provider email recovery, SMTP delivery, Paystack capture/refund/reconciliation, hosted meetings and proxy/CSP behavior require configured environment checks. No live deployment, production-data assessment or full browser regression was performed during this audit. The report establishes concrete code gaps and conditional deployment risks; it does not certify the rest of the system as defect-free.
