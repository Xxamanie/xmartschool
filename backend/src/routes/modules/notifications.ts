import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole } from '../../middleware/auth';
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
  requireAuth,
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
    const { audience, schoolId: querySchoolId, classId } = schema.parse(req.query);
    const effectiveSchoolId = req.auth?.role === UserRole.SUPER_ADMIN
      ? (querySchoolId ?? req.auth?.schoolId)
      : req.auth?.schoolId;
    const response = await appService.previewNotificationRecipients({
      audience,
      schoolId: effectiveSchoolId,
      classId,
      senderId: req.auth?.userId as string,
      senderRole: req.auth?.role as UserRole,
    });
    res.json(response);
  }),
);

router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER),
  asyncHandler(async (req, res) => {
    const payload = sendSchema.parse(req.body);

    if (payload.audience === 'all' && req.auth?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ ok: false, data: null, message: 'Only super admins can broadcast to all schools' });
      return;
    }

    const effectiveSchoolId = req.auth?.role === UserRole.SUPER_ADMIN
      ? payload.schoolId
      : req.auth?.schoolId;

    const response = await appService.createNotification({
      title: payload.title,
      message: payload.message,
      audience: payload.audience,
      userIds: payload.userIds,
      classId: payload.classId,
      schoolId: effectiveSchoolId,
      source: payload.source,
      senderId: req.auth?.userId as string,
      senderRole: req.auth?.role as UserRole,
    });
    res.json(response);
  }),
);

router.patch(
  '/:notificationId/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth?.userId as string;
    const response = await appService.markNotificationRead(req.params.notificationId, userId);
    res.json(response);
  }),
);

export { router as notificationsRouter };
