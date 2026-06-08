-- Add ON DELETE CASCADE to Assessment, Result, ExamSession, and AttendanceRecord
-- so that deleting a Student removes all their related records rather than failing.

ALTER TABLE "Assessment"
  DROP CONSTRAINT IF EXISTS "Assessment_studentId_fkey",
  ADD CONSTRAINT "Assessment_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Result"
  DROP CONSTRAINT IF EXISTS "Result_studentId_fkey",
  ADD CONSTRAINT "Result_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamSession"
  DROP CONSTRAINT IF EXISTS "ExamSession_studentId_fkey",
  ADD CONSTRAINT "ExamSession_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceRecord"
  DROP CONSTRAINT IF EXISTS "AttendanceRecord_studentId_fkey",
  ADD CONSTRAINT "AttendanceRecord_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
