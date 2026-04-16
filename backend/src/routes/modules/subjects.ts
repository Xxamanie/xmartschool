import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schoolId = req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId;
    const response = await appService.getSubjects(schoolId);
    res.json(response);
  }),
);

const createSchema = z.object({
  name: z.string().min(1),
  teacherId: z.string().optional(),
  schoolId: z.string().optional(),
});

router.post(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body);
    const response = await appService.createSubject({
      ...payload,
      schoolId: payload.schoolId ?? req.auth?.schoolId,
    });
    res.json(response);
  }),
);

export { router as subjectsRouter };
