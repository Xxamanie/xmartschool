-- Add term to Result table and update unique index to preserve historical results
ALTER TABLE "Result"
ADD COLUMN IF NOT EXISTS "term" TEXT NOT NULL DEFAULT 'Term 1';

DROP INDEX IF EXISTS "Result_schoolId_studentId_subjectName_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Result_schoolId_studentId_subjectName_term_key"
ON "Result" ("schoolId", "studentId", "subjectName", "term");
