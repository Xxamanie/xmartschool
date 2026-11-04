-- Fields required by the announcements and exams queries on demo dashboards.
-- Existing records are preserved; existing rows remain unscoped until assigned.
ALTER TABLE "Announcement"
  ADD COLUMN "schoolId" TEXT,
  ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Announcement_schoolId_createdAt_idx" ON "Announcement"("schoolId", "createdAt");
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Exam"
  ADD COLUMN "schoolId" TEXT,
  ADD COLUMN "schoolClassId" TEXT,
  ADD COLUMN "termId" TEXT;
CREATE INDEX "Exam_schoolId_status_idx" ON "Exam"("schoolId", "status");
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_schoolClassId_fkey"
  FOREIGN KEY ("schoolClassId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_termId_fkey"
  FOREIGN KEY ("termId") REFERENCES "SchoolTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
