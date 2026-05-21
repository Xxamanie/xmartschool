import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

router.get(
  '/',
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const schoolId = req.auth!.schoolId!;
    const response = await appService.getStaffMessages(schoolId);
    res.json(response);
  }),
);

const sendSchema = z.object({
  type: z.enum(['text', 'image', 'video', 'audio']).default('text'),
  content: z.string().default(''),
  mediaUrl: z.string().url().optional(),
});

router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { type, content, mediaUrl } = sendSchema.parse(req.body);
    const { userId, schoolId } = req.auth!;
    const response = await appService.sendStaffMessage(schoolId!, userId, type, content, mediaUrl);
    res.json(response);
  }),
);

export { router as staffRoomRouter };
