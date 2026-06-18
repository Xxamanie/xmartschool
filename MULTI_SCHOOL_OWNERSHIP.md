# Multi-School Ownership — One Account, Many Branches

Goal: let an owner of several schools in different locations **log in once**,
see a **consolidated view**, and **drop into any one branch** to manage it — with
everything (especially earnings) correctly scoped to *their* schools only.

This builds directly on patterns already in the codebase, so it's an extension,
not a rewrite.

## What already gets us most of the way

- The **Creator dashboard** (`pages/SuperAdmin.tsx`) already aggregates across schools, switches into a school, and impersonates an admin — that's the exact UX a group owner needs, just scoped to *their* group instead of the whole platform.
- `AuthContext` already has **`viewingSchoolId` / `effectiveSchoolId` / `setViewingSchoolId`** and a real, audited **impersonation** flow (the work we did): pick a school → act inside it → exit. That's the "school switcher."
- The backend already resolves scope via **`getEffectiveSchoolId(req)` / `enforceTenantQuery`** (`utils/tenant.ts`) and per-school ownership checks. We generalize "is this *the* school" → "is this *one of my* schools."

The missing piece is a concept of **ownership of more than one school by a non-platform user**.

## 1. Data model — introduce the group + flexible membership

Two new ideas:

**A `SchoolGroup` (Organization) entity.** Schools optionally belong to a group:

```
model SchoolGroup {
  id        String   @id @default(cuid())
  name      String          // "Bright Future Education Group"
  ownerId   String          // the User who owns it
  createdAt DateTime @default(now())
  schools   School[]
}
// School gets: groupId String?  + group SchoolGroup? relation
```

**A `Membership` join table** to replace the single `User.schoolId` assumption.
This is the durable fix — one user can hold roles across many schools (and it
also cleanly solves "teacher at two branches", "parent with kids in two schools"):

```
model Membership {
  id        String   @id @default(cuid())
  userId    String
  schoolId  String?          // role at a specific school
  groupId   String?          // OR a group-wide role (owner)
  role      UserRole         // ADMIN, TEACHER, GROUP_OWNER, …
  @@unique([userId, schoolId, role])
}
```

Add a **`GROUP_OWNER`** role. A group owner has one `Membership` at the group
level granting access to *every* school in the group — no per-school account needed.

> Lighter interim option if you want to ship fast: skip the membership table and
> just add `User.groupId` + a `GROUP_OWNER` role. It's less flexible (a user is
> tied to one group) but unlocks the whole experience with a tiny migration. The
> membership table is the better long-term home.

## 2. Backend — one scope resolver, reused everywhere

Add a single helper that answers "**which schools may this user act on?**":

```
getAccessibleSchoolIds(user):
  SUPER_ADMIN  → all schools (platform)
  GROUP_OWNER  → all schools where school.groupId === user's group
  ADMIN        → [user.schoolId]
  others       → [user.schoolId]
```

Then generalize the existing checks: everywhere the code does
`req.auth.schoolId !== id → 403`, change to `!accessibleSchoolIds.includes(id) → 403`.
`getEffectiveSchoolId` already gives the *active* school (via the switcher); this
just adds the *set* the owner is allowed to switch among. The session/token keeps
carrying the **active school** (reuse `viewingSchoolId`), so all existing
school-scoped endpoints keep working unchanged once the active school is set.

This means **no per-endpoint rewrite** — tenant scoping flows through the two
existing choke points.

## 3. UX — portfolio view + one-tap branch switching

- **Group (portfolio) dashboard:** the owner's landing page — a consolidated roll-up across all their branches (total students, staff, collections, outstanding), plus a **per-branch comparison** table and a map/list of locations. This is essentially the Creator dashboard, scoped to the group.
- **Branch switcher** in the header: pick a school → `setViewingSchoolId` → the normal admin screens (Students, Finance, Staff Room, …) scope to that branch automatically via `effectiveSchoolId`. A persistent banner shows "Viewing: Lagos Campus — Switch" (we already render an impersonation/scope banner in `Layout`).
- **Per-branch admins still exist.** The owner delegates day-to-day running to a local `ADMIN` per branch; the owner gets the bird's-eye view and can drop in anywhere. Segregation of duties stays intact.

## 4. The earnings payoff (tie-in to the finance plan)

This is where multi-school ownership becomes compelling — consolidated money:

- **Group earnings dashboard:** total collected and total outstanding **across all branches**, with a per-location breakdown and trend. The owner sees the whole business in one screen.
- **Branch comparison & benchmarking:** collection rate, arrears aging, and average fee per student **side by side by location** — instantly spot the branch that's lagging.
- **Consolidated, drill-downable reports/exports:** one Payment Journal / Arrears report spanning every branch, filterable down to a single school — built on the same exports from the finance plan.
- **Group-level audit log:** every finance action across all branches in one timeline, with the branch as a column — the owner's single source of truth for accountability.
- **Per-location settings respected:** currency formatting, fee templates, term calendars, and branding stay **per school**, so a Lagos and an Abuja branch can differ while rolling up into one group total.

The finance hardening (integer money, immutable ledger, receipt numbers, daily
close, hash-chained journal) becomes *more* valuable here: a multi-branch owner
who can't physically be everywhere relies entirely on trustworthy, tamper-evident
numbers rolling up from each location.

## 5. Edge cases to design for

- **Owner ≠ platform Super Admin.** A `GROUP_OWNER` sees only their group; the Creator still sees everything. Keep them distinct.
- **Moving staff/students between branches** = changing their school membership, audited.
- **Subscription/billing per group** (if you monetize): bill the group, not each school.
- **Timezones/locations:** stamp finance entries and "close-of-day" in each branch's local time.

## Suggested phasing

**Phase 1 — Ownership model:** `SchoolGroup` + `GROUP_OWNER` role + `getAccessibleSchoolIds` + generalized tenant checks. (Interim: `User.groupId` to ship faster.)

**Phase 2 — Experience:** group/portfolio dashboard + branch switcher reusing `viewingSchoolId`; delegate per-branch admins.

**Phase 3 — Consolidated earnings:** group finance dashboard, branch comparison, cross-branch reports/exports, group-wide finance audit timeline.

**Phase 4 — Membership table** (replace single `schoolId`) for full flexibility: multi-branch staff, parents with children in different branches, group-level subscriptions.

Phases 1–2 are small and reuse existing infrastructure; Phase 3 is the headline
feature for owners; Phase 4 is the scalable foundation when you're ready.
