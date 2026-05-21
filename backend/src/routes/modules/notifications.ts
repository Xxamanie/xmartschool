import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

const sendSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  audience: z.enum(['all', 'school', 'admins', 'teachers', 'staff', 'students', 'teacher_students']),
  /**
   * Optional list for `specific_users`/targeted sends.
   * For now we also support direct `userIds` for targeted audience.
   */
  userIds: z.array(z.string()).optional(),
  schoolId: z.string().optional(),
  source: z.string().min(1),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const response = await appService.listNotifications(req.auth?.userId as string, req.auth?.role as UserRole);
    res.json(response);
  }),
);

router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER),
  asyncHandler(async (req, res) => {
    const payload = sendSchema.parse(req.body);
    const response = await appService.createNotification({
      title: payload.title,
      message: payload.message,
      audience: payload.audience,
      userIds: payload.userIds,
      schoolId: payload.schoolId,
      source: payload.source,
      senderId: req.auth?.userId as string,
      senderRole: req.auth?.role as UserRole,
    });
    res.json(response);
  }),
);

export { router as notificationsRouter };
