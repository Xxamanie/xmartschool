-- Student identities are stored separately from staff and parent User accounts.
ALTER TABLE "NotificationRecipient" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "NotificationRecipient" ADD COLUMN "studentId" TEXT;

ALTER TABLE "NotificationRecipient" DROP CONSTRAINT "NotificationRecipient_userId_fkey";
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_one_recipient_check"
  CHECK (num_nonnulls("userId", "studentId") = 1);

CREATE UNIQUE INDEX "NotificationRecipient_notificationId_studentId_key"
  ON "NotificationRecipient"("notificationId", "studentId");
CREATE INDEX "NotificationRecipient_studentId_idx" ON "NotificationRecipient"("studentId");
