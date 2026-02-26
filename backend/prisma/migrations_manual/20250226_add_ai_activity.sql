-- Manual migration for AIActivity (Supabase SQL editor friendly)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AIActivityScope') THEN
    CREATE TYPE "AIActivityScope" AS ENUM ('assessments', 'results', 'proctoring', 'live_classes', 'general');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AIActivityStatus') THEN
    CREATE TYPE "AIActivityStatus" AS ENUM ('success', 'failed', 'fallback');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "AIActivity" (
  id text PRIMARY KEY,
  action text NOT NULL,
  scope "AIActivityScope" NOT NULL DEFAULT 'general',
  status "AIActivityStatus" NOT NULL DEFAULT 'success',
  "actorId" text NULL,
  "actorRole" "UserRole" NULL,
  "schoolId" text NOT NULL,
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "AIActivity"
  ADD CONSTRAINT "AIActivity_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"(id)
  ON DELETE SET NULL;

ALTER TABLE "AIActivity"
  ADD CONSTRAINT "AIActivity_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "AIActivity_createdAt_idx" ON "AIActivity" ("createdAt");
CREATE INDEX IF NOT EXISTS "AIActivity_scope_status_idx" ON "AIActivity" ("scope", "status");
CREATE INDEX IF NOT EXISTS "AIActivity_actorId_createdAt_idx" ON "AIActivity" ("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AIActivity_schoolId_createdAt_idx" ON "AIActivity" ("schoolId", "createdAt");
