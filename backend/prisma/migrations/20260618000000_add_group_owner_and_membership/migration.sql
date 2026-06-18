-- Add GROUP_OWNER to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'GROUP_OWNER' AFTER 'SUPER_ADMIN';

-- CreateTable: SchoolGroup
CREATE TABLE IF NOT EXISTS "SchoolGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolGroup_pkey" PRIMARY KEY ("id")
);

-- Add groupId to School
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

-- Add groupId to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

-- CreateTable: Membership
CREATE TABLE IF NOT EXISTS "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT,
    "groupId" TEXT,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Membership_userId_schoolId_role_key" ON "Membership"("userId", "schoolId", "role");
CREATE INDEX IF NOT EXISTS "Membership_userId_idx" ON "Membership"("userId");

-- AddForeignKey: School.groupId -> SchoolGroup.id
ALTER TABLE "School" ADD CONSTRAINT "School_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "SchoolGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: User.groupId -> SchoolGroup.id
ALTER TABLE "User" ADD CONSTRAINT "User_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "SchoolGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Membership.userId -> User.id
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Membership.schoolId -> School.id
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Membership.groupId -> SchoolGroup.id
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "SchoolGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
