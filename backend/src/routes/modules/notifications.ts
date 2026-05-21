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
  audience: z.enum(['all', 'school', 'admins', 'teachers', 'staff', 'students', 'class_students', 'teacher_students', 'specific_users']),
  userIds: z.array(z.string()).optional(),
  schoolId: z.string().optional(),
  classId: z.string().optional(),
  source: z.string().min(1),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const response = await appService.listNotifications(req.auth?.userId as string, req.auth?.role as UserRole);
    res.json(response);
  }),
);

router.get(
  '/preview',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      audience: z.string().min(1),
      schoolId: z.string().optional(),
      classId: z.string().optional(),
    });
    const { audience, schoolId, classId } = schema.parse(req.query);
    // For class_students preview, pass classId as the schoolId param (service uses it as classId)
    const response = await appService.previewNotificationRecipients({
      audience,
      schoolId: audience === 'class_students' ? classId : schoolId,
      senderId: req.auth?.userId as string,
    });
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
      // for class_students, pass classId as first element of userIds
      userIds: payload.audience === 'class_students' && payload.classId
        ? [payload.classId]
        : payload.userIds,
      schoolId: payload.schoolId,
      source: payload.source,
      senderId: req.auth?.userId as string,
      senderRole: req.auth?.role as UserRole,
    });
    res.json(response);
  }),
);

router.patch(
  '/:notificationId/read',
  asyncHandler(async (req, res) => {
    const userId = req.auth?.userId as string;
    const response = await appService.markNotificationRead(req.params.notificationId, userId);
    res.json(response);
  }),
);

export { router as notificationsRouter };