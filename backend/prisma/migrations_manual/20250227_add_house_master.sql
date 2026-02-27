-- House master assignments per school
CREATE TABLE IF NOT EXISTS "HouseMaster" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "house" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,

    CONSTRAINT "HouseMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HouseMaster_schoolId_house_key" ON "HouseMaster"("schoolId", "house");
CREATE INDEX IF NOT EXISTS "HouseMaster_schoolId_idx" ON "HouseMaster"("schoolId");

ALTER TABLE "HouseMaster" ADD CONSTRAINT "HouseMaster_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HouseMaster" ADD CONSTRAINT "HouseMaster_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
