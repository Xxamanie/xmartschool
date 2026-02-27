-- Archive for graduating students
CREATE TABLE IF NOT EXISTS "GraduatedStudent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "house" TEXT NOT NULL DEFAULT 'Unassigned',
    "level" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraduatedStudent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GraduatedStudent_schoolId_level_idx" ON "GraduatedStudent"("schoolId", "level");
CREATE INDEX IF NOT EXISTS "GraduatedStudent_year_term_idx" ON "GraduatedStudent"("year", "term");

ALTER TABLE "GraduatedStudent" ADD CONSTRAINT "GraduatedStudent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GraduatedStudent" ADD CONSTRAINT "GraduatedStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
