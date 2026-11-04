# Database migrations

`schema.prisma` is the application schema. Every further schema change must include a reviewed SQL migration. Use `prisma migrate dev` against a development database to create it, and `prisma migrate deploy` to apply versioned migrations in production. Do not use `db push` or `migrate reset` on production data.

## Migration history

The reconstructed `20260501000000_baseline` creates the schema that precedes the existing incremental migrations. `baseline.prisma` records that historical schema; it is not the current application schema. The existing calendar, student result PIN, cascade-delete, group membership, and school deletion migrations follow it.

- `20261005000000_scope_class_masters_and_payment_refs` adds school ownership to class masters and unique payment retry references.
- `20261005000001_student_email` adds the optional student email used for notifications.
- `20261005000002_student_notification_recipients` adds student recipients alongside User recipients, enforces exactly one identity per row, and cascades recipient rows when either identity is deleted.

The class-master migration derives each existing assignment's school from its teacher. An assignment without a valid school owner stops the migration at the `NOT NULL` constraint. Resolve the orphan assignment explicitly before retrying; do not assign it to an arbitrary school or remove records to force the migration through.

## New, empty database

From `backend`, with `DATABASE_URL` set to the intended empty database:

```sh
npm run prisma:generate
npm run prisma:deploy
npx prisma migrate status
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
```

The final command must report no differences. The full chain is checked against a fresh PostgreSQL service in CI. The Docker production entry point applies migrations before starting the server.

## Existing databases created with `db push`

Do not run the baseline's creation SQL against an existing application database. Back up the database, verify that the backup can be restored, and rehearse the adoption on a restored staging copy before production startup.

1. Inspect the existing schema and `_prisma_migrations`, if present. Inventory which versioned changes already exist in the database.
2. Apply the corresponding historical migrations to a separate empty comparison database. Compare that cumulative schema to the staging copy with `prisma migrate diff`; review both schema differences and each migration's SQL. A comparison to `baseline.prisma` alone is insufficient when later historical changes already exist.
3. Only for migrations whose complete effects have been verified as already present, record them with `prisma migrate resolve --applied <migration-directory-name>`. For example, use `--applied 20260501000000_baseline` only after verifying its tables, columns, constraints, and indexes exist. Do not mark all migrations applied blindly, and do not mark the new school-scoping, payment-reference, email, or student-recipient migrations applied unless their changes already exist.
4. Apply the remaining migrations with `prisma migrate deploy`, then check `migrate status` and run the no-drift comparison against `schema.prisma`.
5. Repeat the verified sequence against production during the deployment window. Keep the backup until the application and its critical flows have been checked.

If a migration fails, inspect the failed step and existing data before using `migrate resolve`. Marking a migration applied does not execute its SQL or repair its data.

## Demo seed

`npm run db:seed` creates example schools and known demonstration credentials. The seed refuses to run when `NODE_ENV=production`, and the production Docker entry point does not call it. Provision real users separately.
