import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

const listQuery = z.object({
  studentId: z.string().optional(),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { studentId } = listQuery.parse(req.query);
    const effectiveStudentId = req.auth?.role === UserRole.STUDENT ? req.auth.userId : studentId;
    const response = await appService.getResults(req.auth?.schoolId, effectiveStudentId);
    res.json(response);
  }),
);

const publishSchema = z.array(z.any());

router.post(
  '/publish',
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = publishSchema.parse(req.body);
    const response = await appService.publishResults(req.auth?.schoolId, payload as any);
    res.json(response);
  }),
);

export { router as resultsRouter };
