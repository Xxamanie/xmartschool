import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { UserRole } from '../../types';

const router = Router();

const listQuery = z.object({
  role: z.nativeEnum(UserRole).optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { role } = listQuery.parse(req.query);
    const response = await appService.getAnnouncements(role);
    res.json(response);
  }),
);

const createSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  targetAudience: z.enum(['all', 'teachers', 'students']),
  source: z.string().min(1),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title, message, targetAudience, source } = createSchema.parse(req.body);
    const response = await appService.createAnnouncement(title, message, targetAudience, source);
    res.json(response);
  }),
);

export { router as announcementsRouter };
