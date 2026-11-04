-- Preserve existing assignments by deriving their school from the assigned teacher.
ALTER TABLE "ClassMaster" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
UPDATE "ClassMaster" AS cm SET "schoolId" = u."schoolId"
FROM "User" AS u WHERE cm."teacherId" = u.id AND cm."schoolId" IS NULL;
-- Null ownership must be resolved explicitly; never silently attach to another school.
ALTER TABLE "ClassMaster" ALTER COLUMN "schoolId" SET NOT NULL;
DROP INDEX IF EXISTS "ClassMaster_grade_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ClassMaster_schoolId_grade_key" ON "ClassMaster"("schoolId", "grade");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassMaster_schoolId_fkey') THEN
    ALTER TABLE "ClassMaster" ADD CONSTRAINT "ClassMaster_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
ALTER TABLE "StudentFeePayment" ADD COLUMN IF NOT EXISTS "clientRef" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "StudentFeePayment_clientRef_key" ON "StudentFeePayment"("clientRef");
