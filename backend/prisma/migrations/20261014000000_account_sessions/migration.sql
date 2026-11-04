-- Preserve existing accounts while adding the fields required by sign-in and
-- authenticated requests. Existing sessions start at version zero.
ALTER TABLE "User"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "supabaseUserId" TEXT,
  ADD COLUMN "notificationPreferences" JSONB;

CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User"("supabaseUserId");

ALTER TABLE "Student"
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "notificationPreferences" JSONB;

ALTER TABLE "AuditLog" ADD COLUMN "impersonatedBy" TEXT;
