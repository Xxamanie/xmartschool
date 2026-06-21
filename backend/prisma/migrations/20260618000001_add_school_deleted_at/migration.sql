-- Add soft-delete support to School
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
