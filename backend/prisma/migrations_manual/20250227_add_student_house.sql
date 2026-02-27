-- Add house assignment for students
ALTER TABLE "Student"
  ADD COLUMN IF NOT EXISTS "house" TEXT NOT NULL DEFAULT 'Unassigned';
